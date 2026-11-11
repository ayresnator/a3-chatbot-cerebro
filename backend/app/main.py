import logging
import random
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .config import settings
from .models import ChatInput, StudyInput, StudyOutput
from .providers import ai

logger = logging.getLogger("cerebro.api")
# Esquema enviado ao provedor: o material já chega no formato que o backend valida.
# O chat fica sem esquema de propósito: com ele as respostas vinham sem quebras de linha (6 de 7 nos testes).
STUDY_SCHEMA = StudyOutput.model_json_schema()
ACCENTS = re.compile("[áàâãéêíóôõúç]", re.IGNORECASE)

app = FastAPI(title="Cérebro API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

@app.get("/api/health")
def health():
    # Somente estado local: não confirma validade de chave ou cota no provedor.
    return {
        "status": "ok",
        "ai_configured": bool(settings.api_key),
        "provider": settings.provider,
        "model": settings.model,
    }

@app.post("/api/generate", response_model=StudyOutput)
def generate(data: StudyInput):
    instruction = """Gere um título, de 6 a 12 tópicos de resumo, 6 a 12 flashcards
e 6 questões (misture multiple, boolean e short). Extraia do texto ou explique a matéria
quando o usuário informar um tema. Formato exato:
{"title":"...","summary":[{"concept":"...","text":"..."}],
"flashcards":[{"question":"...","answer":"..."}],
"quiz":[{"type":"multiple","question":"...","options":["...","...","...","..."],
"answer":0,"explanation":"...","steps":[]}]}
answer é índice inteiro começando em zero para multiple e boolean.
Para boolean, options deve ser ["Verdadeiro","Falso"].
Para short, answer é uma única palavra ou número de correção inequívoca e options é [].
Se outra forma também estiver certa (sinônimo, sigla, plural), junte as formas com |, por exemplo "PIB|Produto Interno Bruto".
Não use questões discursivas como short.
As opções de multiple são embaralhadas depois: não use "todas as anteriores" nem "nenhuma das anteriores", e não cite a letra ou a posição de uma opção.
steps contém passos da resolução para matemática. Para outros temas pode ser [].
Faça cada tópico de resumo independente para permitir selecionar quantos exibir."""
    payload = data.model_dump()
    for last in (False, True):
        try:
            material = StudyOutput.model_validate(ai(payload, instruction, STUDY_SCHEMA))
            break
        except ValidationError as exc:
            # Registra só o campo e o motivo: o texto gerado pode conter dados do aluno.
            logger.warning("generate: material rejeitado %s", [
                (".".join(map(str, e["loc"])), e["msg"])
                for e in exc.errors(include_input=False, include_url=False, include_context=False)])
            # Material inválido é raro (1 em 14 gerações reais: índice da resposta fora das opções). A segunda chamada costuma vir certa.
            if last:
                raise HTTPException(502, "O material gerado não passou pela validação. Tente novamente.") from exc
    # Texto em português sem nenhum acento = o modelo "comeu" a acentuação (4 de 23 respostas nos testes).
    # Tenta mais uma vez; se a segunda falhar, fica com a primeira (sem acento é melhor que erro).
    if not ACCENTS.search(material.model_dump_json()):
        try:
            material = StudyOutput.model_validate(ai(payload, instruction, STUDY_SCHEMA))
        except (HTTPException, ValidationError):
            pass
    # Sem embaralhar dava para acertar no chute: o modelo punha a certa em B ou C (36 de 45 nos testes)
    # e, depois do aviso no prompt, em A (11 de 19).
    for item in material.quiz:
        if item.type == "multiple":
            right = item.options[item.answer]
            random.shuffle(item.options)
            item.answer = item.options.index(right)
    return material

@app.post("/api/chat")
def chat(data: ChatInput):
    result = ai(data.model_dump(), 'Responda a dúvida com exemplos práticos e passos quando necessário. '
                'history traz as mensagens anteriores desta conversa, da mais antiga para a mais recente, e a pergunta continua essa conversa. '
                'Quando a pergunta não disser o assunto (por exemplo "me dê um exemplo"), o assunto é o das mensagens de history, não o da área. '
                'Formato: {"answer":"resposta em texto simples"}.')
    if not isinstance(result.get("answer"), str) or not result["answer"].strip():
        raise HTTPException(502, "Resposta inválida do provedor.")
    return {"answer": result["answer"]}
