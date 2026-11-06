from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import ChatInput, StudyInput, StudyOutput
from .providers import ai

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
Não use questões discursivas como short.
steps contém passos da resolução para matemática. Para outros temas pode ser [].
Faça cada tópico de resumo independente para permitir selecionar quantos exibir."""
    try:
        return StudyOutput.model_validate(ai(data.model_dump(), instruction))
    except ValueError as exc:
        raise HTTPException(502, "O material gerado não passou pela validação. Tente novamente.") from exc

@app.post("/api/chat")
def chat(data: ChatInput):
    result = ai(data.model_dump(), 'Responda a dúvida com exemplos práticos e passos quando necessário. Formato: {"answer":"resposta em texto simples"}.')
    if not isinstance(result.get("answer"), str) or not result["answer"].strip():
        raise HTTPException(502, "Resposta inválida do provedor.")
    return {"answer": result["answer"]}
