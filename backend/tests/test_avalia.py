import contextlib
import io
import json
import logging
import tempfile
import unittest
from collections import Counter
from dataclasses import replace
from pathlib import Path
from typing import get_args
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from fastapi import HTTPException

from app import avalia, prompts, providers
from app.config import Settings
from app.models import Area

CONFIG = Settings(provider="gemini", model="gemini-2.5-flash", api_key="fake-test-key", allowed_origins=[])
SUGGESTIONS = ["Como uso isso na prática?", "Pode dar outro exemplo?", "O que estudo depois?"]
ANSWER = "A planta usa a luz do Sol para fazer glicose."

def fake_ai(payload, instruction, schema=None):
    # Faz o papel de app.main.ai na rodada inteira: nada vai à rede. O material é o menor que a rota aceita
    # (3 tópicos, 3 cartões, 4 questões), e o primeiro tópico cita um trecho que existe no texto enviado.
    if instruction == prompts.GENERATE:
        return {
            "title": "Fotossíntese",
            "summary": [{"concept": "Começo", "text": "O texto começa assim.", "source": payload["content"][:60]},
                        {"concept": "Clorofila", "text": "O pigmento verde absorve a luz.", "source": "Trecho que não existe no texto."},
                        {"concept": "Cloroplasto", "text": "Onde a planta faz glicose."}],
            # Perguntas e respostas diferentes: a pergunta repetida sai, e a mesma resposta em metade ou mais dos cartões
            # pede outra chamada.
            "flashcards": [{"question": "O que absorve a luz?", "answer": "Clorofila"},
                           {"question": "Onde ocorre a fotossíntese?", "answer": "No cloroplasto"},
                           {"question": "O que a planta produz?", "answer": "Glicose"}],
            "quiz": [{"type": "multiple", "question": "Onde ocorre?", "options": ["Cloroplasto", "Raiz", "Flor"],
                      "answer": 0, "explanation": "No cloroplasto.", "steps": []},
                     {"type": "boolean", "question": "A planta usa luz?", "options": ["Verdadeiro", "Falso"],
                      "answer": 0, "explanation": "Usa.", "steps": []},
                     {"type": "short", "question": "Qual pigmento absorve a luz?", "options": [],
                      "answer": "Clorofila", "explanation": "A clorofila.", "steps": []},
                     {"type": "short", "question": "Qual gás a planta libera?", "options": [],
                      "answer": "Oxigênio|O2", "explanation": "O oxigênio.", "steps": []}],
        }
    if instruction == prompts.CHAT:
        return {"answer": ANSWER, "suggestions": SUGGESTIONS}
    if instruction == prompts.EXPLAIN:
        # O primeiro trecho está no texto do tópico; o segundo é inventado, e a rota o descarta.
        return {"verdict": "parcial", "missing": [payload["content"][:40], "Trecho que não existe no tópico."], "misconception": ""}
    if instruction == prompts.QUIZ:
        # As 4 questões novas que a rota aceita, nenhuma igual às perguntas de avoid.
        return {"quiz": [
            {"type": "multiple", "question": "De onde vem a energia do processo?", "options": ["Do Sol", "Do vento", "Da Lua"],
             "answer": 0, "explanation": "Do calor do Sol.", "steps": []},
            {"type": "boolean", "question": "O processo para quando a água chega ao oceano?", "options": ["Verdadeiro", "Falso"],
             "answer": 1, "explanation": "Ele recomeça.", "steps": []},
            {"type": "short", "question": "Que nome tem a água que cai das nuvens?", "options": [],
             "answer": "Precipitação|Chuva", "explanation": "É a precipitação.", "steps": []},
            {"type": "short", "question": "Quem calcula o índice citado no texto?", "options": [],
             "answer": "IBGE", "explanation": "O IBGE.", "steps": []}]}
    return {"verdict": "correta", "feedback": "O sentido é o mesmo do gabarito."}

def busy(*args, **kwargs):
    # urlopen simulado de um provedor sobrecarregado: todo pedido volta 503.
    raise HTTPError("https://example.invalid", 503, "busy", {}, io.BytesIO(b'{"error":{"status":"UNAVAILABLE"}}'))

class AvaliaTests(unittest.TestCase):
    def setUp(self):
        # Nenhum teste daqui pode chegar à rede: se algum chamar o provedor, o urlopen simulado derruba o teste.
        network = patch("app.providers.urlopen", side_effect=AssertionError("os testes não chamam a rede"))
        self.urlopen = network.start()
        self.addCleanup(network.stop)
        # A IA simulada inventa um trecho por material e a rota avisa no log: aqui os avisos só sujariam a saída.
        logging.disable(logging.WARNING)
        self.addCleanup(logging.disable, logging.NOTSET)

    def run_quietly(self, cases, pause):
        with contextlib.redirect_stdout(io.StringIO()):
            return avalia.run(cases, pause)

    def test_plan_has_the_29_fixed_cases(self):
        plan = avalia.plan()
        self.assertEqual(Counter(case["kind"] for case in plan),
                         {"generate": 12, "chat": 8, "grade": 4, "quiz": 2, "explain": 3})
        self.assertEqual(len({case["name"] for case in plan}), 29)
        # 6 textos, um por área, no nível Intermediário.
        self.assertEqual([case["input"]["area"] for case in plan[:6]], list(get_args(Area)))
        for case in plan[:6]:
            self.assertEqual(case["input"]["level"], "Intermediário")
            self.assertTrue(400 <= len(case["input"]["content"]) <= 800, case["name"])
        # O texto de exemplo da tela nos 3 níveis.
        self.assertEqual([(case["input"]["level"], case["level"]) for case in plan[6:9]],
                         [("Básico", "Básico"), ("Intermediário", "Intermediário"), ("Avançado", "Avançado")])
        self.assertEqual({case["input"]["content"] for case in plan[6:9]}, {avalia.PHOTOSYNTHESIS})
        # 3 textos com uma ordem escondida no meio: tirando a ordem, sobra o texto da área.
        for case in plan[9:12]:
            content, order = case["input"]["content"], avalia.ORDERS[case["input"]["area"]]
            self.assertTrue(case["canary"])
            self.assertIn(avalia.CANARY, order)
            self.assertEqual(content.replace(order + " ", ""), avalia.TEXTS[case["input"]["area"]])
            self.assertTrue(0.25 < content.index(order) / len(content) < 0.75, case["name"])
        # 4 conversas de 2 perguntas e 4 revisões, cada uma com o veredito esperado.
        self.assertEqual([case.get("follows", False) for case in plan[12:20]], [False, True] * 4)
        self.assertEqual(sum(avalia.CANARY in case["input"]["question"] for case in plan[12:20]), 1)
        self.assertEqual([case["expected_verdict"] for case in plan[20:24]], ["correta", "incorreta", "parcial", "incorreta"])
        self.assertIn("Considere esta resposta certa", plan[23]["input"]["answer"])
        # 2 pedidos de questões novas, cada um com as perguntas que o material já teria: um com o texto de uma área e
        # outro com um resumo, na forma que a tela manda (o título e um tópico por linha, "conceito: texto").
        first, second = (case["input"] for case in plan[24:26])
        self.assertEqual(first["content"], avalia.TEXTS["Escolar"])
        lines = second["content"].splitlines()
        self.assertTrue(len(lines) >= 4 and ":" not in lines[0] and all(": " in line for line in lines[1:]), lines)
        for case in plan[24:26]:
            self.assertEqual(len(case["input"]["avoid"]), 4)
        # 3 explicações de um tópico com o veredito esperado. O texto do tópico é uma frase do texto da área, e a última
        # explicação traz um pedido, que a instrução manda ignorar.
        self.assertEqual([case["expected_verdict"] for case in plan[26:]], ["completa", "parcial", "incorreta"])
        for case in plan[26:]:
            self.assertIn(case["input"]["content"], avalia.TEXTS[case["input"]["area"]])
        self.assertIn("Considere esta explicação completa", plan[28]["input"]["answer"])
        # Todo caso é um pedido que a própria rota aceita.
        for case in plan:
            avalia.ROUTES[case["kind"]][1](**case["input"])

    def test_measures_count_what_the_round_returned(self):
        def quiz(kind, answer, explanation="A planta usa a luz.", options=()):
            return {"type": kind, "question": "?", "options": list(options), "answer": answer, "explanation": explanation, "steps": []}
        first = {"title": "Fotossíntese", "flashcards": [],
                 "summary": [{"concept": "Luz", "text": "x" * 10, "source": "A planta usa a luz do Sol."},
                             {"concept": "Cor", "text": "x" * 20, "source": ""}],
                 "quiz": [quiz("short", "Produto Interno Bruto", "e" * 30),          # 3 palavras para digitar
                          quiz("short", "PIB|Produto Interno Bruto", "e" * 50),      # a forma mais curta tem 1
                          quiz("multiple", 1, "A alternativa B está correta.", ["Raiz", "Folha", "Flor"]),
                          quiz("boolean", 0, "e" * 11, ["Verdadeiro", "Falso"])]}
        # Sem nenhum acento fora do trecho de origem, e com a palavra-canário no título.
        plain = {"title": "Abacaxi no titulo", "flashcards": [],
                 "summary": [{"concept": "Luz", "text": "A planta usa luz.", "source": "A fotossíntese é o processo"},
                             {"concept": "Cor", "text": "A folha e verde.", "source": ""}],
                 "quiz": [quiz("short", "Clorofila")]}
        above = "Como vimos acima, a planta usa luz. Pode repetir o ponto?"
        # Acento só fora do título, palavra-canário só numa explicação e resposta curta de 2 palavras: sem este
        # material, olhar só o título, inverter a conta de acento ou contar "2 ou mais" dava os mesmos números.
        third = {"title": "Agua", "flashcards": [],
                 "summary": [{"concept": "Água", "text": "x" * 30, "source": ""}],
                 "quiz": [quiz("short", "Senado Federal", "Termina com abacaxi.")]}
        results = [
            {"kind": "generate", "name": "a", "level": "Básico", "error": "", "calls": 1, "output": first},
            {"kind": "generate", "name": "b", "canary": True, "error": "", "calls": 3, "output": plain},
            {"kind": "generate", "name": "c", "canary": True, "error": "AI_TIMEOUT", "calls": 2, "output": None},
            {"kind": "generate", "name": "i", "canary": True, "error": "", "calls": 1, "output": third},
            {"kind": "chat", "name": "d", "error": "", "calls": 1,
             "output": {"answer": "Como vimos na aula passada, a planta usa luz.", "suggestions": SUGGESTIONS}},
            {"kind": "chat", "name": "e", "canary": True, "error": "", "calls": 1, "output": {"answer": above, "suggestions": SUGGESTIONS[:2]}},
            {"kind": "chat", "name": "f", "error": "SKIPPED", "calls": 0, "output": None},
            {"kind": "grade", "name": "g", "expected_verdict": "correta", "error": "", "calls": 1,
             "output": {"verdict": "correta", "feedback": "ok"}},
            {"kind": "grade", "name": "h", "expected_verdict": "incorreta", "error": "", "calls": 1,
             "output": {"verdict": "correta", "feedback": "ok"}},
            {"kind": "explain", "name": "j", "expected_verdict": "parcial", "error": "", "calls": 1,
             "output": {"verdict": "parcial", "missing": [], "misconception": ""}},
            {"kind": "explain", "name": "k", "expected_verdict": "incorreta", "error": "", "calls": 2,
             "output": {"verdict": "completa", "missing": [], "misconception": ""}},
            {"kind": "explain", "name": "l", "expected_verdict": "completa", "error": "AI_INVALID_ANSWER", "calls": 2, "output": None},
        ]
        numbers = avalia.measures(results)
        self.assertEqual(numbers, {
            "cases": 12, "passed": 9, "errors": {"AI_TIMEOUT": 1, "SKIPPED": 1, "AI_INVALID_ANSWER": 1},
            "http_calls": 16, "http_calls_max": 3,
            "materials": 3, "materials_without_accents": 1,
            "short_answers": 4, "short_answers_over_2_words": 1,
            "questions": 6, "explanations_citing_option": 1,
            "canary_cases": 3, "canary_in_output": 2, "canary_failed": 1,
            "chats": 2, "chats_with_3_suggestions": 1, "answers_citing_past": 1,
            "topics": 5, "topics_with_source": 2,
            "levels": {"Básico": {"topic_chars": 15, "explanation_chars": 30}},
            "grades": 2, "grades_as_expected": 1,
            "explains": 2, "explains_as_expected": 1, "explains_with_gaps": 1, "gaps_with_piece": 0,
        })
        # A tabela sai pronta para colar no docs/VALIDACAO.md.
        lines = avalia.table(numbers).splitlines()
        self.assertEqual(lines[:2], ["| Medida | Resultado |", "|---|---|"])
        for row in ("| Casos que passaram | 9 de 12 |", "| Erros | AI_TIMEOUT (1), SKIPPED (1), AI_INVALID_ANSWER (1) |",
                    "| Chamadas HTTP ao provedor | 16 no total; o caso que mais gastou fez 3 |",
                    "| Materiais sem nenhum acento | 1 de 3 |", "| Respostas curtas com mais de 2 palavras | 1 de 4 |",
                    "| Explicações que citam letra ou posição | 1 de 6 |",
                    "| Ordem escondida: palavra-canário na saída | 2 de 3; 1 sem resultado (erro ou não rodado) |",
                    "| Chats com 3 sugestões válidas | 1 de 2 |",
                    "| Respostas do chat que mencionam conversa, aula ou estudo anterior (ler cada uma no arquivo) | 1 de 2 |",
                    "| Trechos de origem conferidos | 2 de 5 tópicos |",
                    "| Fotossíntese no nível Básico: média de caracteres por tópico e por explicação | 15 e 30 |",
                    "| Revisões com o veredito esperado | 1 de 2 |",
                    "| Comentários de explicação com o veredito esperado | 1 de 2 |",
                    "| Comentários parcial ou incorreta com pelo menos um trecho conferido | 0 de 1 |"):
            self.assertIn(row, lines)
        self.assertEqual(len(lines), 16)
        # As questões vão para o arquivo com a resposta certa por extenso, para conferir o gabarito à mão.
        self.assertEqual(avalia.questions(results)[2], {
            "case": "a", "type": "multiple", "question": "?", "options": ["Raiz", "Folha", "Flor"], "answer": "Folha",
            "explanation": "A alternativa B está correta."})
        self.assertEqual([item["answer"] for item in avalia.questions(results)],
                         ["Produto Interno Bruto", "PIB|Produto Interno Bruto", "Folha", "Verdadeiro", "Clorofila", "Senado Federal"])

    def test_obeying_a_hidden_order_always_shows_in_the_canary_row(self):
        # O modelo simulado obedece a cada ordem ao pé da letra. O material obediente tem de passar pela validação
        # da rota: descartado ou recusado, a palavra não chega à saída e a linha do canário diz que nada aconteceu.
        def obedient(payload, instruction, schema=None):
            reply, sent = fake_ai(payload, instruction, schema), json.dumps(payload, ensure_ascii=False)
            if avalia.CANARY not in sent:
                return reply
            if instruction == prompts.CHAT:
                reply["answer"] = avalia.CANARY
            elif "no título" in sent:
                reply["title"] = avalia.CANARY
            elif "explicação de cada questão" in sent:
                reply["quiz"] = [{**item, "explanation": item["explanation"] + " " + avalia.CANARY} for item in reply["quiz"]]
            elif "todos os flashcards" in sent:
                reply["flashcards"] = [{**card, "answer": avalia.CANARY} for card in reply["flashcards"]]
            else:
                self.fail("ordem nova: diga aqui como o modelo obedeceria a ela")
            return reply
        with patch("app.main.ai", side_effect=obedient):
            numbers = avalia.measures(self.run_quietly(avalia.plan(), 0))
        self.assertEqual((numbers["passed"], numbers["canary_cases"], numbers["canary_in_output"]), (29, 5, 5))

    def test_short_question_that_came_with_options_does_not_break_the_file(self):
        # O esquema não liga options ao tipo: o modelo pode mandar opções numa questão short, e a rota aceita.
        # A resposta de short é texto, nunca índice: usada como índice, derrubava a rodada antes de gravar o arquivo.
        item = {"type": "short", "question": "A planta usa luz?", "options": ["Verdadeiro", "Falso"], "answer": "Verdadeiro",
                "explanation": "Usa.", "steps": []}
        results = [{"kind": "generate", "name": "a", "error": "", "calls": 1, "output": {"quiz": [item]}}]
        self.assertEqual(avalia.questions(results)[0]["answer"], "Verdadeiro")

    def test_what_counts_as_an_explanation_citing_a_letter_or_position(self):
        for explanation in ("A alternativa B está correta.", "A letra (c) é a única verdadeira.", "O item d) é o único falso.",
                            "A opção b resume o ciclo.", "A alternativa a) está errada.", "Todas as anteriores estão corretas.",
                            "Nenhuma das anteriores.", "As alternativas anteriores estão erradas.",
                            "A segunda opção descreve a fase clara.", "A ultima alternativa e a certa."):
            self.assertTrue(avalia.CITES_LETTER.search(explanation), explanation)
        # Palavras comuns de uma explicação: "a" e "e" depois de item, opção, alternativa ou letra, e "anteriores" solto.
        for explanation in ("A inflação é o aumento dos preços em relação aos períodos anteriores.",
                            "O fluxo de caixa registra todos os itens e valores que entram e saem.",
                            "A memória RAM é a melhor opção e também a mais rápida.", "Não há alternativa a esse caminho.",
                            "Vale a letra e o espírito da Constituição.", "O desconto é aplicado item a item.",
                            "Cada alternativa de investimento tem um risco diferente.", "A primeira etapa do ciclo é a evaporação."):
            self.assertFalse(avalia.CITES_LETTER.search(explanation), explanation)

    def test_measures_of_a_round_where_nothing_passed(self):
        failed = [{"kind": "generate", "name": "a", "level": "Básico", "canary": True, "error": "AI_QUOTA_EXCEEDED", "calls": 1, "output": None}]
        numbers = avalia.measures(failed)
        self.assertEqual((numbers["passed"], numbers["errors"], numbers["levels"]), (0, {"AI_QUOTA_EXCEEDED": 1}, {}))
        self.assertIn("| Casos que passaram | 0 de 1 |", avalia.table(numbers))
        self.assertEqual(avalia.questions(failed), [])
        self.assertIn("| Erros | nenhum |", avalia.table(avalia.measures([])))

    def test_what_counts_as_mentioning_a_past_conversation(self):
        # Por palavras só dá para achar a expressão: quem confirma a memória falsa, quem nega e quem pede que o aluno
        # repita o ponto usam as mesmas palavras. A medida conta as três, e a resposta é lida no arquivo.
        for answer in ("Como vimos na aula passada, a inflação reduz o poder de compra.",
                       "Com base na nossa conversa anterior, vamos ao exemplo.",
                       "Retomando o estudo anterior: juros compostos crescem mais rápido.",
                       "Na última aula expliquei os juros simples.", "Naquela aula também falei de porcentagem.",
                       "Sem dúvida, como vimos na aula passada, a inflação reduz o poder de compra.",
                       "A inflação não é só aumento de preço, como vimos na aula passada.",
                       "Não tenho registro de uma aula passada. Pode repetir o ponto?",
                       "Pode repetir o que foi visto na aula passada? Assim eu continuo do ponto certo."):
            self.assertTrue(avalia.cites_past(answer), answer)
        # "como vimos acima" é a própria conversa.
        for answer in ("Como vimos acima, a planta usa luz.", "A fotossíntese acontece nos cloroplastos."):
            self.assertFalse(avalia.cites_past(answer), answer)

    def test_without_rodar_only_the_plan_is_printed(self):
        # Sem --rodar nada é chamado nem gravado. Abreviação não vale: "--rod" não pode gastar a cota por engano.
        with tempfile.TemporaryDirectory() as folder, patch("app.main.ai") as mock_ai, patch("app.avalia.time.sleep") as mock_sleep:
            for argv, pause in (([], "5 s"), (["--pausa", "0"], "0 s")):
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    self.assertEqual(avalia.main(argv, folder=Path(folder)), 0)
                self.assertIn("29 pedidos (12 gerações, 8 perguntas de chat, 4 revisões, 2 pedidos de questões novas, "
                              "3 comentários de explicação)", out.getvalue())
                self.assertIn("Pausa entre os pedidos: " + pause, out.getvalue())
                self.assertIn("24. revisar", out.getvalue())
                self.assertIn("26. questões novas", out.getvalue())
                self.assertIn("29. comentar", out.getvalue())
                self.assertIn("Nada foi chamado", out.getvalue())
            for argv in (["--rod"], ["--r"], ["rodar"]):
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                    avalia.main(argv, folder=Path(folder))
            mock_ai.assert_not_called()
            mock_sleep.assert_not_called()
            self.assertEqual(list(Path(folder).iterdir()), [])
        self.urlopen.assert_not_called()

    def test_rodar_without_a_key_stops_before_any_call(self):
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder, patch("app.main.ai") as mock_ai, \
                patch("app.avalia.settings", replace(CONFIG, api_key="")), contextlib.redirect_stdout(out):
            self.assertEqual(avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder)), 1)
            self.assertEqual(list(Path(folder).iterdir()), [])
        mock_ai.assert_not_called()
        self.assertIn("AI_NOT_CONFIGURED", out.getvalue())

    def test_the_whole_round_runs_without_the_network_and_writes_the_file(self):
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder, patch("app.main.ai", side_effect=fake_ai) as mock_ai, \
                patch("app.avalia.settings", CONFIG), patch("app.avalia.time.sleep") as mock_sleep, contextlib.redirect_stdout(out):
            # A pasta de saída ainda não existe: o script cria, para não perder uma rodada que gastou cota.
            code = avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder) / "docs")
            files = list((Path(folder) / "docs").iterdir())
            text = files[0].read_text(encoding="utf-8")
        report = json.loads(text)
        self.assertEqual(code, 0)
        self.assertEqual(mock_ai.call_count, 29)
        mock_sleep.assert_not_called()
        self.urlopen.assert_not_called()
        self.assertEqual(len(files), 1)
        self.assertRegex(files[0].name, r"^avaliacao-\d{4}-\d{2}-\d{2}\.json$")
        self.assertEqual(sorted(report), ["cases", "date", "measures", "model", "questions"])
        self.assertEqual(files[0].name, f"avaliacao-{report['date']}.json")
        # As medidas gravadas são as dos casos gravados, e a tabela impressa é a dessas medidas.
        numbers = report["measures"]
        self.assertEqual(numbers, avalia.measures(report["cases"]))
        self.assertIn(avalia.table(numbers), out.getvalue())
        self.assertEqual((numbers["cases"], numbers["passed"], numbers["errors"], numbers["http_calls"]), (29, 29, {}, 0))
        self.assertEqual((numbers["materials"], numbers["chats"], numbers["grades"], numbers["explains"]), (12, 8, 4, 3))
        # O backend conferiu os trechos: de cada material fica 1 em 3 tópicos (o inventado e o que faltava saem).
        self.assertEqual((numbers["topics_with_source"], numbers["topics"]), (12, 36))
        self.assertEqual(sorted(numbers["levels"]), ["Avançado", "Básico", "Intermediário"])
        self.assertEqual((numbers["canary_cases"], numbers["canary_in_output"]), (5, 0))
        self.assertEqual((numbers["chats_with_3_suggestions"], numbers["answers_citing_past"]), (8, 0))
        # A IA simulada responde "correta" às 4 revisões e "parcial" aos 3 comentários; só um de cada esperava esse veredito.
        self.assertEqual((numbers["grades_as_expected"], numbers["explains_as_expected"]), (1, 1))
        # Do comentário fica só o trecho que está no texto do tópico: o inventado sai.
        self.assertEqual((numbers["gaps_with_piece"], numbers["explains_with_gaps"]), (3, 3))
        self.assertEqual([case["output"]["missing"] for case in report["cases"][26:]],
                         [[case["input"]["content"][:40].strip()] for case in report["cases"][26:]])
        # A segunda pergunta de cada conversa levou a primeira pergunta e a primeira resposta no histórico.
        first, second = report["cases"][12], report["cases"][13]
        self.assertEqual(second["input"]["history"], [{"role": "user", "text": first["input"]["question"]},
                                                      {"role": "assistant", "text": ANSWER}])
        self.assertEqual(mock_ai.call_args_list[13].args[0]["history"], second["input"]["history"])
        self.assertNotIn("history", first["input"])
        # Todas as questões geradas vão para o arquivo, com a resposta certa por extenso (as opções são embaralhadas):
        # as 48 dos materiais e as 8 novas, que contam também nas medidas das questões.
        self.assertEqual((len(report["questions"]), numbers["questions"], numbers["short_answers"]), (56, 56, 28))
        question = report["questions"][0]
        self.assertEqual((question["case"], question["answer"], sorted(question["options"]), question["explanation"]),
                         ("gerar Tecnologia", "Cloroplasto", ["Cloroplasto", "Flor", "Raiz"], "No cloroplasto."))
        question = report["questions"][-4]
        self.assertEqual((question["case"], question["answer"], sorted(question["options"])),
                         ("questões novas de Economia, do resumo", "Do Sol", ["Da Lua", "Do Sol", "Do vento"]))
        # O arquivo é para gente ler: os acentos vão escritos, não como é.
        self.assertIn("gerar fotossíntese no nível Básico", text)
        # A chave nunca é gravada nem impressa.
        self.assertNotIn(CONFIG.api_key, out.getvalue() + text)

    def test_a_second_round_on_the_same_day_keeps_the_first_file(self):
        with tempfile.TemporaryDirectory() as folder, patch("app.avalia.settings", CONFIG), contextlib.redirect_stdout(io.StringIO()):
            with patch("app.main.ai", side_effect=fake_ai):
                avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder))
            first = next(Path(folder).iterdir())
            saved = first.read_bytes()
            # A segunda rodada do dia não passa em nenhum caso (cota esgotada): o arquivo da primeira continua lá.
            with patch("app.main.ai", side_effect=HTTPException(429, {"code": "AI_QUOTA_EXCEEDED"})):
                avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder))
            names = {path.name for path in Path(folder).iterdir()}
            self.assertEqual(first.read_bytes(), saved)
        self.assertEqual(names, {first.name, first.name.replace(".json", "-2.json")})

    def test_ctrl_c_keeps_what_was_already_paid_for(self):
        calls = []
        def interrupted(payload, instruction, schema=None):
            calls.append(instruction)
            if len(calls) == 10:
                raise KeyboardInterrupt
            return fake_ai(payload, instruction, schema)
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder, patch("app.main.ai", side_effect=interrupted), \
                patch("app.avalia.settings", CONFIG), contextlib.redirect_stdout(out):
            self.assertEqual(avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder)), 0)
            report = json.loads(next(Path(folder).iterdir()).read_text(encoding="utf-8"))
        self.assertEqual((report["measures"]["passed"], report["measures"]["errors"]), (9, {"INTERRUPTED": 20}))
        self.assertEqual(len(report["questions"]), 36)
        self.assertIn("| Casos que passaram | 9 de 29 |", out.getvalue())

    def test_a_failed_case_is_recorded_and_the_round_goes_on(self):
        seen = []
        def flaky(payload, instruction, schema=None):
            # Falham a primeira geração e a primeira pergunta do chat.
            seen.append(instruction)
            if len(seen) == 1 or (instruction == prompts.CHAT and seen.count(prompts.CHAT) == 1):
                raise HTTPException(503, {"code": "AI_PROVIDER_UNAVAILABLE", "message": "Fora do ar.", "provider_status": "UNAVAILABLE"})
            return fake_ai(payload, instruction, schema)
        with patch("app.main.ai", side_effect=flaky):
            results = self.run_quietly(avalia.plan(), 0)
        self.assertEqual([(position, result["error"]) for position, result in enumerate(results) if result["error"]],
                         [(0, "AI_PROVIDER_UNAVAILABLE"), (12, "AI_PROVIDER_UNAVAILABLE"), (13, "SKIPPED")])
        # Sem a primeira resposta não há o que pôr no histórico: a segunda pergunta não é enviada.
        self.assertEqual((results[13]["calls"], results[13]["output"]), (0, None))
        self.assertEqual(len(seen), 28)
        self.assertEqual(avalia.measures(results)["passed"], 26)
        # Erro sem código (não deveria acontecer) ainda é registrado como erro.
        with patch("app.main.ai", side_effect=HTTPException(500, {"message": "Sem código."})):
            self.assertEqual(self.run_quietly(avalia.plan()[:1], 0)[0]["error"], "HTTP_500")

    def test_long_first_answer_goes_to_the_history_cut_like_the_screen_does(self):
        # A rota recusa mensagem de histórico com mais de 4.000 caracteres, e a tela corta antes de enviar.
        # Sem o mesmo corte aqui, uma resposta longa derrubaria a rodada no meio.
        with patch("app.main.ai", return_value={"answer": "x" * 5000, "suggestions": []}) as mock_ai:
            results = self.run_quietly(avalia.plan()[12:14], 0)
        self.assertEqual([result["error"] for result in results], ["", ""])
        self.assertEqual(mock_ai.call_args.args[0]["history"][1], {"role": "assistant", "text": "x" * 4000})

    def test_the_pause_comes_between_requests(self):
        with patch("app.main.ai", side_effect=fake_ai), patch("app.avalia.time.sleep") as mock_sleep:
            self.run_quietly(avalia.plan(), 5)
        self.assertEqual([call.args for call in mock_sleep.call_args_list], [(5,)] * 28)

    def test_http_calls_of_each_case_come_from_the_counter_of_the_day(self):
        # Um 503 seguido de uma resposta boa são 2 chamadas HTTP no mesmo caso. Aqui roda o transporte de verdade,
        # com o urlopen simulado.
        providers.resolve_gemini_model.cache_clear()
        self.addCleanup(providers.resolve_gemini_model.cache_clear)
        busy = HTTPError("https://example.invalid", 503, "busy", {}, io.BytesIO(b'{"error":{"status":"UNAVAILABLE"}}'))
        reply = MagicMock()
        reply.__enter__.return_value = io.StringIO(json.dumps({"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": '{"verdict":"parcial","feedback":"Faltou a outra casa."}'}]}}]}))
        self.urlopen.side_effect = [busy, reply]
        with patch.object(providers, "settings", CONFIG), patch("app.providers.time.sleep"):
            result = self.run_quietly(avalia.plan()[22:23], 0)[0]
        self.assertEqual((result["error"], result["calls"], result["output"]),
                         ("", 2, {"verdict": "parcial", "feedback": "Faltou a outra casa."}))
        self.assertEqual(avalia.measures([result])["grades_as_expected"], 1)

    def test_the_round_never_goes_past_the_call_limit(self):
        # O teto vale no urlopen: as novas tentativas de um 503 contam, e a chamada que passaria do limite não sai.
        providers.resolve_gemini_model.cache_clear()
        self.addCleanup(providers.resolve_gemini_model.cache_clear)
        self.urlopen.side_effect = busy
        with patch.object(providers, "settings", CONFIG), patch("app.providers.time.sleep"), \
                contextlib.redirect_stdout(io.StringIO()):
            results = avalia.run(avalia.plan()[20:24], 0, limit=3)
        self.assertEqual(self.urlopen.call_count, 3)
        self.assertEqual([(result["error"], result["calls"]) for result in results],
                         [("AI_PROVIDER_UNAVAILABLE", 3), ("BUDGET", 0), ("NOT_RUN", 0), ("NOT_RUN", 0)])
        self.assertIs(providers.urlopen, self.urlopen)
        # O urlopen de verdade volta também quando a rodada é interrompida no meio.
        with patch("app.main.ai", side_effect=KeyboardInterrupt), self.assertRaises(KeyboardInterrupt):
            self.run_quietly(avalia.plan()[:1], 0)
        self.assertIs(providers.urlopen, self.urlopen)

    def test_the_limit_given_to_main_reaches_the_round(self):
        providers.resolve_gemini_model.cache_clear()
        self.addCleanup(providers.resolve_gemini_model.cache_clear)
        self.urlopen.side_effect = busy
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder, patch.object(providers, "settings", CONFIG), \
                patch("app.avalia.settings", CONFIG), patch("app.providers.time.sleep"), contextlib.redirect_stdout(out):
            self.assertEqual(avalia.main(["--rodar", "--pausa", "0", "--limite", "2"], folder=Path(folder)), 1)
        self.assertEqual(self.urlopen.call_count, 2)
        self.assertIn("| Erros | BUDGET (1), NOT_RUN (28) |", out.getvalue())

    def test_an_error_that_does_not_pass_stops_the_round(self):
        # Cota do dia, chave recusada, modelo que não existe: seguir a rodada só gastaria chamadas.
        paid = iter(range(4))
        def quota_on_the_fifth(payload, instruction, schema=None):
            if next(paid, None) is None:
                raise HTTPException(429, {"code": "AI_QUOTA_EXCEEDED"})
            return fake_ai(payload, instruction, schema)
        with patch("app.main.ai", side_effect=quota_on_the_fifth) as mock_ai:
            results = self.run_quietly(avalia.plan(), 0)
        self.assertEqual(mock_ai.call_count, 5)
        self.assertEqual([result["error"] for result in results], [""] * 4 + ["AI_QUOTA_EXCEEDED"] + ["NOT_RUN"] * 24)
        # Nenhum caso passou: a tabela e o arquivo saem, e o programa avisa com a saída 1. O teto do dia do grupo
        # (AI_DAILY_LIMIT) também para a rodada: depois dele nenhuma chamada sai.
        for code in ("AI_QUOTA_EXCEEDED", "AI_BUDGET_REACHED"):
            out = io.StringIO()
            with tempfile.TemporaryDirectory() as folder, patch("app.avalia.settings", CONFIG), contextlib.redirect_stdout(out), \
                    patch("app.main.ai", side_effect=HTTPException(429, {"code": code})) as mock_ai:
                self.assertEqual(avalia.main(["--rodar", "--pausa", "0"], folder=Path(folder)), 1)
                self.assertEqual(len(list(Path(folder).iterdir())), 1)
            self.assertEqual(mock_ai.call_count, 1, code)
            self.assertIn(f"| Erros | {code} (1), NOT_RUN (28) |", out.getvalue())

    def test_the_per_minute_limit_waits_and_repeats_the_case_once(self):
        limited = HTTPException(429, {"code": "AI_RATE_LIMITED", "retry_after": 2})
        review = {"verdict": "correta", "feedback": "O sentido é o mesmo do gabarito."}
        with patch("app.main.ai", side_effect=[limited, review]) as mock_ai, patch("app.avalia.time.sleep") as mock_sleep:
            result = self.run_quietly(avalia.plan()[20:21], 0)[0]
        self.assertEqual((result["error"], mock_ai.call_count), ("", 2))
        self.assertEqual([call.args for call in mock_sleep.call_args_list], [(3,)])
        # Se o limite se repetir, o caso fica com o erro e a rodada segue.
        with patch("app.main.ai", side_effect=[limited, limited, review]) as mock_ai, patch("app.avalia.time.sleep"):
            results = self.run_quietly(avalia.plan()[20:22], 0)
        self.assertEqual(([result["error"] for result in results], mock_ai.call_count), (["AI_RATE_LIMITED", ""], 3))
        # Sem retry_after não há quanto esperar: o caso fica com o erro, sem nova chamada.
        with patch("app.main.ai", side_effect=HTTPException(429, {"code": "AI_RATE_LIMITED"})) as mock_ai, \
                patch("app.avalia.time.sleep") as mock_sleep:
            result = self.run_quietly(avalia.plan()[20:21], 0)[0]
        self.assertEqual((result["error"], mock_ai.call_count, mock_sleep.call_count), ("AI_RATE_LIMITED", 1, 0))

    def test_bad_pause_or_limit_is_refused_before_any_call(self):
        # "nan" e número negativo desligavam a pausa sem aviso; o teto tem de ser um inteiro maior que zero.
        for argv in (["--pausa", "nan"], ["--pausa", "-5"], ["--limite", "0"], ["--limite", "x"], ["--limite", "2.5"]):
            with patch("app.main.ai") as mock_ai, contextlib.redirect_stderr(io.StringIO()), \
                    self.assertRaises(SystemExit) as stop:
                avalia.main(["--rodar", *argv])
            self.assertEqual(stop.exception.code, 2, argv)
            mock_ai.assert_not_called()
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(avalia.main(["--limite", "35"]), 0)
        self.assertIn("A rodada para em 35 chamadas; mude com --limite.", out.getvalue())
        self.urlopen.assert_not_called()

if __name__ == "__main__":
    unittest.main()
