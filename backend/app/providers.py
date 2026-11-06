"""Transportes dos provedores. Nenhuma chave vai para URLs, logs ou respostas."""
import json
import logging
import re
from functools import lru_cache
from urllib.parse import urlencode
import socket
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from .config import settings
from .prompts import SYSTEM

logger = logging.getLogger("cerebro.ai")

def fail(status: int, code: str, message: str, provider_status: str = ""):
    raise HTTPException(status_code=status, detail={
        "code": code, "message": message, "provider_status": provider_status,
    })

def provider_error(exc: HTTPError):
    status = ""
    reason = ""
    try:
        body = json.loads(exc.read(32768).decode("utf-8"))
        error = body.get("error", {})
        if isinstance(error, dict):
            status = str(error.get("status", ""))
            for item in error.get("details", []):
                if isinstance(item, dict) and item.get("reason"):
                    reason = str(item["reason"])
        if not status:
            status = "HTTP_" + str(exc.code)
    except (ValueError, AttributeError, TypeError):
        status = "HTTP_" + str(exc.code)
    # Nunca registrar corpo bruto: ele pode incluir dados do aluno.
    safe_reasons = {"API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED",
                    "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED",
                    "SERVICE_DISABLED", "BILLING_DISABLED"}
    if reason not in safe_reasons:
        reason = ""
    safe_statuses = {"INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED",
                     "NOT_FOUND", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION",
                     "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"}
    if status not in safe_statuses:
        status = "HTTP_" + str(exc.code)
    logger.warning("provider=%s http=%s status=%s reason=%s",
                   settings.provider, exc.code, status, reason)
    if exc.code == 429:
        fail(429, "AI_QUOTA_EXCEEDED", "A cota ou o limite de chamadas da IA foi atingido. Confira os limites do projeto no provedor e tente mais tarde.", status)
    if exc.code in (401, 403) or reason.startswith("API_KEY_"):
        fail(502, "AI_AUTH_ERROR", "O provedor recusou a credencial ou suas permissões. Gere uma chave válida, confira as restrições da Gemini API e reinicie o backend.", reason or status)
    if exc.code == 404:
        fail(502, "AI_MODEL_NOT_FOUND", "O modelo configurado não está disponível para este projeto. Execute python -m app.check --list-models; escolha um modelo listado em AI_MODEL ou use auto, e reinicie o backend.", status)
    if exc.code == 400:
        fail(502, "AI_REQUEST_REJECTED", "O provedor recusou a solicitação. Confira modelo, disponibilidade da faixa gratuita, região e situação do projeto no AI Studio.", status)
    if exc.code >= 500:
        fail(503, "AI_PROVIDER_UNAVAILABLE", "O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.", status)
    fail(502, "AI_PROVIDER_ERROR", "Não foi possível concluir a solicitação ao provedor de IA.", status)

def request_json(request: Request) -> dict:
    try:
        with urlopen(request, timeout=settings.timeout_seconds) as response:
            result = json.load(response)
        if not isinstance(result, dict):
            raise ValueError("Expected JSON object")
        return result
    except HTTPError as exc:
        provider_error(exc)
    except (TimeoutError, socket.timeout) as exc:
        fail(504, "AI_TIMEOUT", "A IA demorou demais para responder. Tente novamente.")
    except URLError as exc:
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            fail(504, "AI_TIMEOUT", "A IA demorou demais para responder. Tente novamente.")
        fail(503, "AI_NETWORK_ERROR", "O backend não conseguiu acessar a IA. Confira internet, proxy, firewall e certificados HTTPS.")
    except (ValueError, UnicodeError):
        fail(502, "AI_INVALID_RESPONSE", "O provedor retornou uma resposta inválida.")

def decode_output(text: str) -> dict:
    try:
        result = json.loads(text)
        if not isinstance(result, dict):
            raise ValueError("Expected object")
        return result
    except (TypeError, ValueError):
        fail(502, "AI_INVALID_JSON", "A IA não retornou um objeto JSON válido. Tente novamente.")


def text_model_names(models: list) -> list[str]:
    """A lista da API não informa se há cota gratuita ou acesso de faturamento."""
    names = set()
    for model in models:
        if not isinstance(model, dict) or "generateContent" not in model.get("supportedGenerationMethods", []):
            continue
        name = str(model.get("name", "")).removeprefix("models/")
        if not re.fullmatch(r"gemini-[A-Za-z0-9._-]+", name):
            continue
        if any(word in name for word in ("image", "audio", "tts", "robotics", "computer-use", "embedding", "live")):
            continue
        names.add(name)
    return sorted(names)

def list_gemini_models() -> list[str]:
    if not settings.api_key:
        fail(503, "AI_NOT_CONFIGURED", "Preencha GEMINI_API_KEY no .env da raiz e reinicie o backend.")
    models = []
    token = ""
    seen = set()
    while True:
        query = {"pageSize": 1000}
        if token:
            query["pageToken"] = token
        request = Request(
            "https://generativelanguage.googleapis.com/v1beta/models?" + urlencode(query),
            headers={"x-goog-api-key": settings.api_key}, method="GET",
        )
        data = request_json(request)
        page = data.get("models", [])
        if not isinstance(page, list):
            fail(502, "AI_INVALID_RESPONSE", "A API retornou uma lista de modelos inválida.")
        models.extend(page)
        token = data.get("nextPageToken")
        if not token:
            break
        if not isinstance(token, str) or token in seen or len(seen) >= 20:
            fail(502, "AI_INVALID_RESPONSE", "A paginação dos modelos retornou dados inválidos.")
        seen.add(token)
    return text_model_names(models)

@lru_cache(maxsize=1)
def resolve_gemini_model() -> str:
    if settings.model != "auto":
        return settings.model
    available = list_gemini_models()
    # Não selecionar Pro ou modelos experimentais automaticamente.
    candidates = [name for name in available if "flash" in name
                  and not any(tag in name for tag in ("preview", "experimental", "-exp", "thinking"))]
    if not candidates:
        fail(503, "AI_NO_COMPATIBLE_MODEL",
             "Nenhum modelo Gemini Flash estável foi listado. Execute python -m app.check --list-models e configure AI_MODEL com um modelo de texto disponível.")
    def rank(name):
        version = re.search(r"gemini-(\d+)(?:\.(\d+))?", name)
        numbers = tuple(int(x or 0) for x in version.groups()) if version else (0, 0)
        return (numbers, "lite" in name, name)
    selected = max(candidates, key=rank)
    logger.info("Gemini auto: modelo selecionado=%s", selected)
    return selected


def ai(payload: dict, instruction: str) -> dict:
    if not settings.api_key or settings.api_key in {"sua_credencial_privada", "COLE_A_NOVA_CHAVE_AQUI"}:
        fail(503, "AI_NOT_CONFIGURED", "A IA ainda não foi ativada. O responsável deve configurar a credencial no .env da raiz do projeto e reiniciar o backend.")
    prompt = SYSTEM + "\n" + instruction
    user = json.dumps(payload, ensure_ascii=False)
    if settings.provider == "gemini":
        # API nativa Gemini: API keys vão em x-goog-api-key, não como OAuth Bearer.
        endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + resolve_gemini_model() + ":generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        headers = {"Content-Type": "application/json", "x-goog-api-key": settings.api_key}
    else:
        endpoint = "https://api.openai.com/v1/chat/completions"
        body = {
            "model": settings.model,
            "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
        }
        headers = {"Content-Type": "application/json", "Authorization": "Bearer " + settings.api_key}
    result = request_json(Request(endpoint, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"))
    try:
        if settings.provider == "gemini":
            candidates = result.get("candidates", [])
            if not candidates:
                fail(502, "AI_EMPTY_RESPONSE", "A IA não retornou conteúdo. Tente reformular a pergunta.")
            candidate = candidates[0]
            if candidate.get("finishReason") not in (None, "STOP"):
                fail(502, "AI_INCOMPLETE_RESPONSE", "A IA interrompeu a resposta. Envie um texto menor ou reformule a pergunta.")
            parts = candidate.get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
        else:
            text = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, AttributeError):
        fail(502, "AI_INVALID_RESPONSE", "O provedor retornou uma estrutura de resposta inesperada.")
    return decode_output(text)
