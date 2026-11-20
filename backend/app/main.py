import logging
import random
import re
import time
import unicodedata
from collections import Counter

import anyio.from_thread
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import settings
from .models import (Card, ChatInput, ChatOutput, ExampleInput, ExampleOutput, ExampleText, GradeInput, GradeOutput,
                     QuizItem, StudyInput, StudyOutput, SummaryItem)
from .prompts import CHAT, EXAMPLE, GENERATE, GRADE, NO_SOURCE, TOPICS
from .providers import ai, budget, calls_today, fail, resolve_gemini_model

logger = logging.getLogger("cerebro.api")
# Esquema enviado ao provedor: o material já chega no formato que o backend valida.
# O chat fica sem esquema de propósito: com ele as respostas vinham sem quebras de linha (6 de 7 nos testes).
STUDY_SCHEMA = StudyOutput.model_json_schema()
# A revisão vai com esquema: são duas frases curtas, e o veredito tem de ser um dos três aceitos.
GRADE_SCHEMA = GradeOutput.model_json_schema()
# O exemplo também: é um campo só, e o JSON quebrado (o chat, que vai sem esquema, recebe 1 em ~20) gastaria a única
# segunda chamada do clique. Se as quebras de linha sumirem, como no chat com esquema, o texto fica num parágrafo só.
EXAMPLE_SCHEMA = ExampleText.model_json_schema()
ACCENTS = re.compile("[áàâãéêíóôõúç]", re.IGNORECASE)
# Listas do material e o modelo que valida cada item delas.
ITEMS = {"summary": SummaryItem, "flashcards": Card, "quiz": QuizItem}
# Citação de letra ou de posição: "alternativa A", "letra (b)", "todas as anteriores", "a última opção".
# O prompt proíbe, mas nada conferia. "opcao" e "ultima" cobrem o material que veio sem acento.
# "a" e "e" minúsculos e soltos só contam com parêntese ou no fim da frase: em "alternativas a seguir" e
# "letras e números" são palavras comuns, e a questão ficava sem embaralhar.
CITES_OPTION = re.compile(
    r"\b(?:alternativas?|letras?|op[çc](?:[ãa]o|[õo]es)|ite(?:m|ns))\s+\(?(?:[b-d]|(?-i:[AE])|[ae](?=\)|\s*(?:[.!?]|$)))\)?(?!\w)"
    r"|\banteriores\b"
    r"|\b(?:primeira|segunda|terceira|quarta|quinta|[úu]ltima)s?\s+(?:alternativa|op[çc](?:[ãa]o|[õo]es))",
    re.IGNORECASE)
# "acima" e "abaixo" só contam dentro de uma opção ("nenhuma das opções acima"): no enunciado e na explicação
# são palavras comuns ("acima de 10%").
POINTS_ASIDE = re.compile(r"\b(?:acima|abaixo)\b", re.IGNORECASE)
# Nome do campo de entrada na frase do erro 422.
FIELDS = {"content": "conteúdo", "question": "pergunta", "area": "área", "level": "nível", "history": "histórico",
          "expected": "gabarito", "answer": "resposta"}

class RequestBudget:
    # Abre o teto de cada pedido (providers.next_call_timeout): no máximo request_calls chamadas à IA, até
    # request_seconds, e nenhuma chamada nova depois que a tela desistiu. Middleware ASGI puro, para o teto (um
    # ContextVar) e o receive da ligação chegarem intactos à rota.
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope, receive)
        # As rotas da IA são def: rodam numa thread do AnyIO, de onde o gone() pergunta ao laço se a ligação caiu.
        token = budget.set({"deadline": time.monotonic() + settings.request_seconds, "calls": settings.request_calls,
                            "gone": lambda: anyio.from_thread.run(request.is_disconnected)})
        try:
            await self.app(scope, receive, send)
        finally:
            budget.reset(token)

app = FastAPI(title="Cérebro API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.add_middleware(RequestBudget)
# Fecha o DNS rebinding: só os nomes de ALLOWED_HOSTS passam (a porta não conta), e o resto volta 400 sem chegar à IA.
# Fica por último porque o último adicionado roda por fora e recusa antes de tudo.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

@app.exception_handler(RequestValidationError)
def invalid_input(_, exc: RequestValidationError):
    # Sem isto o aluno lia a mensagem do Pydantic em inglês ("String should have at most 20000 characters").
    # A frase sai do tipo do primeiro erro, do limite e do nome do campo: o valor recebido nunca volta na resposta.
    error = exc.errors()[0]
    kind, limits, where = error["type"], error.get("ctx") or {}, error["loc"]
    field = FIELDS.get(where[-1], where[-1]) if len(where) > 1 else ""
    if kind == "string_too_long":
        message = f"O texto passou do limite de {limits['max_length']:,} caracteres.".replace(",", ".")
    elif kind == "string_too_short":
        message = "Escreva alguma coisa." if limits["min_length"] == 1 else f"Escreva pelo menos {limits['min_length']} caracteres."
    elif kind == "missing" and field:
        message = f"Faltou o campo {field}."
    elif kind == "literal_error":
        message = f"Valor inválido em {field}."
    elif kind == "too_long":
        message = f"O histórico passou do limite de {limits['max_length']} mensagens."
    else:
        message = "Pedido em formato inválido."
    return JSONResponse(status_code=422, content={"detail": {"code": "INVALID_INPUT", "message": message, "provider_status": ""}})

@app.exception_handler(400)
def unreadable_body(*_):
    # O FastAPI responde 400, em inglês e sem código, ao corpo que não consegue ler (texto fora do UTF-8, número com
    # milhares de dígitos). Nenhum erro deste backend usa 400: vale a resposta do corpo que não é JSON.
    return JSONResponse(status_code=422, content={"detail": {"code": "INVALID_INPUT", "message": "Pedido em formato inválido.", "provider_status": ""}})

@app.get("/api/health")
def health():
    # Somente estado local: não confirma validade de chave ou cota no provedor.
    # Com AI_MODEL=auto o modelo é escolhido na primeira chamada à IA. Esta rota nunca chama o provedor: só usa a
    # escolha que resolve_gemini_model já guardou; antes disso, mostra o configurado ("auto").
    chosen = settings.model == "auto" and resolve_gemini_model.cache_info().currsize
    return {
        "status": "ok",
        "ai_configured": bool(settings.api_key),
        "provider": settings.provider,
        "model": settings.model,
        "model_in_use": resolve_gemini_model() if chosen else settings.model,
        "calls_today": calls_today(),
    }

def reasons(exc: ValidationError, *where) -> list:
    # Registra só o campo e o motivo: o texto gerado pode conter dados do aluno.
    return [(".".join(map(str, (*where, *error["loc"]))), error["msg"])
            for error in exc.errors(include_input=False, include_url=False, include_context=False)]

def build_material(raw: dict) -> StudyOutput:
    # Uma questão inválida em seis custava 2 chamadas e podia terminar em 502. Cada item passa sozinho pelo seu
    # modelo e só o inválido sai. Título, formato e quantidade de itens (mínimos e máximos) ficam com o StudyOutput.
    material = dict(raw)
    for name, model in ITEMS.items():
        items, kept, dropped = raw.get(name), [], []
        if not isinstance(items, list):
            continue
        for position, item in enumerate(items):
            try:
                kept.append(model.model_validate(item))
            except ValidationError as exc:
                dropped += reasons(exc, name, position)
        if dropped:
            logger.warning("generate: %s de %s itens de %s descartados %s", len(items) - len(kept), len(items), name, dropped)
        if name != "summary":
            # Cartão ou questão que repete a pergunta de outro também sai (sem contar maiúsculas, acentos e espaços a
            # mais). O tópico não tem pergunta. O log leva só as contagens: as perguntas são texto da IA.
            first = {}
            for item in kept:
                first.setdefault(plain(item.question), item)
            if len(first) < len(kept):
                logger.warning("generate: %s de %s itens de %s com pergunta repetida descartados", len(kept) - len(first), len(items), name)
            kept = list(first.values())
        material[name] = kept
    return StudyOutput.model_validate(material)

def shuffle_options(quiz: list[QuizItem]) -> None:
    # Sem embaralhar dava para acertar no chute: o modelo punha a certa em B ou C (36 de 45 nos testes)
    # e, depois do aviso no prompt, em A (11 de 19).
    for item in quiz:
        if item.type != "multiple":
            continue
        # Questão que cita letra ou posição fica na ordem em que veio: embaralhada, a explicação
        # "A alternativa A está correta" apontaria a opção errada. Os passos são mostrados junto com a explicação.
        texts = (item.question, item.explanation, *item.options, *item.steps)
        if any(map(CITES_OPTION.search, texts)) or any(map(POINTS_ASIDE.search, item.options)):
            continue
        right = item.options[item.answer]
        random.shuffle(item.options)
        item.answer = item.options.index(right)

def plain(text: str) -> str:
    # Sem maiúsculas, sem acentos e com os espaços em sequência (e quebras de linha) reduzidos a um.
    letters = unicodedata.normalize("NFD", text.casefold())
    return " ".join("".join(char for char in letters if not unicodedata.combining(char)).split())

def grounded(source: str, content: str) -> str:
    # A tela mostra o trecho como prova de que o tópico saiu do texto do aluno, e o modelo pode inventar ou
    # reescrever o trecho: só fica o que existe mesmo no texto. Trecho muito curto casaria por acaso.
    # O modelo fecha a cópia fiel com ponto, reticências ou aspas que não estão no texto: se o trecho não existe como
    # veio, vale sem essas pontas, e é essa versão que volta. Pontuação no meio do trecho continua tendo de bater.
    text = plain(content)
    for piece in (source, source.strip(" .,;:…\"'“”‘’«»")):
        clean = plain(piece)
        if len(clean) >= 15 and clean in text:
            return piece[:200]
    return ""

@app.post("/api/generate", response_model=StudyOutput)
def generate(data: StudyInput):
    payload, instruction = data.model_dump(), GENERATE

    def ask() -> dict:
        # Copiar trechos do texto do aluno pode fazer o provedor interromper a resposta (finishReason RECITATION);
        # isso nunca foi visto na API real. Se acontecer, o pedido segue sem os trechos: uma chamada a mais, uma vez
        # só. Se a interrupção se repetir, o erro sobe como os outros.
        nonlocal instruction
        try:
            return ai(payload, instruction, STUDY_SCHEMA)
        except HTTPException as exc:
            recited = (exc.detail.get("code"), exc.detail.get("provider_status")) == ("AI_INCOMPLETE_RESPONSE", "RECITATION")
            if not recited or instruction != GENERATE:
                raise
            logger.warning("generate: resposta interrompida por RECITATION; nova chamada sem os trechos de origem")
            instruction = GENERATE + "\n" + NO_SOURCE
            return ai(payload, instruction, STUDY_SCHEMA)

    for last in (False, True):
        try:
            material = build_material(ask())
            break
        except ValidationError as exc:
            logger.warning("generate: material rejeitado %s", reasons(exc))
            # Material inválido é raro (1 em 14 gerações reais, por índice da resposta fora das opções; hoje esse caso
            # só perde a questão). A segunda chamada costuma vir certa.
            if last:
                fail(502, "AI_INVALID_MATERIAL", "O material gerado não passou pela validação. Tente novamente.")
    # Texto em português sem nenhum acento = o modelo "comeu" a acentuação (4 de 23 respostas nos testes).
    # Tenta mais uma vez; se a segunda falhar, fica com a primeira (sem acento é melhor que erro).
    # O trecho de origem fica fora da conta: é cópia do texto do aluno e tem acento mesmo quando o resto veio sem.
    # A mesma nova chamada, uma só, vale para metade ou mais dos cartões com a mesma resposta: na rodada real de 17/11
    # uma ordem escondida no texto pôs "ABACAXI" nos 6 cartões. Se a repetição voltar, fica o segundo material:
    # recusar puniria casos legítimos, como vários cartões com a resposta "2" em Matemática.
    same = max(Counter(plain(card.answer) for card in material.flashcards).values())
    repeated = same * 2 >= len(material.flashcards)
    if repeated:
        logger.warning("generate: %s de %s cartões com a mesma resposta; nova chamada", same, len(material.flashcards))
    if repeated or not ACCENTS.search(material.model_dump_json(exclude={"summary": {"__all__": {"source"}}})):
        try:
            material = build_material(ask())
        except (HTTPException, ValidationError):
            pass
    cited = [item for item in material.summary if item.source]
    for item in cited:
        item.source = grounded(item.source, data.content)
    dropped = sum(not item.source for item in cited)
    if dropped:
        # Só a contagem: o trecho é texto do aluno e nunca vai para o log.
        logger.warning("generate: %s de %s trechos de origem apagados por não estarem no texto do aluno", dropped, len(cited))
    shuffle_options(material.quiz)
    return material

@app.post("/api/chat", response_model=ChatOutput)
def chat(data: ChatInput):
    result = ai(data.model_dump(), CHAT)
    if not isinstance(result.get("answer"), str) or not result["answer"].strip():
        fail(502, "AI_INVALID_ANSWER", "A IA devolveu uma resposta fora do formato. Tente novamente.")
    # As sugestões são um extra para a tela: o que vier fora do formato é descartado, sem derrubar a resposta.
    # Também saem as repetidas e a que só devolve a pergunta que o aluno acabou de fazer.
    raw, asked = result.get("suggestions"), data.question.strip().casefold()
    suggestions = list(dict.fromkeys(
        s.strip() for s in raw if isinstance(s, str) and 0 < len(s.strip()) <= 120 and s.strip().casefold() != asked
    ))[:3] if isinstance(raw, list) else []
    return {"answer": result["answer"], "suggestions": suggestions}

@app.post("/api/grade", response_model=GradeOutput)
def grade(data: GradeInput):
    # Segundo uso da IA: julgar a resposta curta que a comparação de texto da tela marcou como errada.
    # Revisão fora do formato ganha uma segunda chamada, como o material.
    for last in (False, True):
        try:
            review = GradeOutput.model_validate(ai(data.model_dump(), GRADE, GRADE_SCHEMA))
            break
        except ValidationError as exc:
            logger.warning("grade: revisão rejeitada %s", reasons(exc))
            if last:
                fail(502, "AI_INVALID_ANSWER", "A IA devolveu uma revisão fora do formato. Tente novamente.")
    review.feedback = review.feedback[:600]
    return review

@app.post("/api/example", response_model=ExampleOutput)
def example(data: ExampleInput):
    # "Usar um exemplo" punha sempre o texto da fotossíntese. Agora o tema é sorteado aqui, da lista da área, sem o que
    # já está na tela (avoid). O avoid não vai para o modelo: ele recebe só a área, o nível e o tema.
    topic = random.choice([name for name in TOPICS[data.area] if name.casefold() != data.avoid.casefold()])
    payload = {"area": data.area, "level": data.level, "topic": topic}

    def write() -> str:
        # Uma chamada; "" quando a resposta vem fora do formato. Com retry=False o JSON quebrado não ganha a nova
        # chamada própria do ai(): usa a segunda chamada desta rota, e o clique nunca passa de 2 chamadas.
        try:
            return ExampleText.model_validate(ai(payload, EXAMPLE, EXAMPLE_SCHEMA, retry=False)).text
        except ValidationError as exc:
            logger.warning("example: texto rejeitado %s", reasons(exc))
        except HTTPException as exc:
            if exc.detail.get("code") != "AI_INVALID_JSON":
                raise
            logger.warning("example: resposta fora do formato JSON")
        return ""

    # A segunda chamada vale para o texto fora do formato e, como em /api/generate, para o texto sem nenhum acento.
    # Nesse caso, se ela falhar, fica o primeiro texto (sem acento é melhor que erro).
    text = write()
    if not ACCENTS.search(text):
        try:
            text = write() or text
        except HTTPException:
            if not text:
                raise
    if not text:
        fail(502, "AI_INVALID_ANSWER", "A IA devolveu um exemplo fora do formato. Tente novamente.")
    return {"topic": topic, "text": text}
