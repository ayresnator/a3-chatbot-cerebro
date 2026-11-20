"""Transportes dos provedores. Nenhuma chave vai para URLs, logs ou respostas."""
import http.client
import json
import logging
import math
import re
import threading
import time
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

from .config import settings
from .prompts import SYSTEM

class NoRedirect(HTTPRedirectHandler):
    # O urllib segue 301, 302 e 303 (no GET do catálogo, também 307 e 308) levando a chave, que vai no cabeçalho, para o
    # novo endereço. A API não redireciona: quem redireciona é um filtro de rede. Sem seguir, o 30x vira erro do provedor (HTTP_302).
    def redirect_request(self, *args, **kwargs):
        return None

urlopen = build_opener(NoRedirect).open
logger = logging.getLogger("cerebro.ai")
# A cota do Google vira à meia-noite do horário do Pacífico (4h ou 5h em Brasília), e a conta de chamadas vira junto.
# shortcut: UTC-8 fixo; no horário de verão dos EUA a virada sai 1 h depois; trocar por ZoneInfo + tzdata se precisar exato.
QUOTA_TZ = timezone(timedelta(hours=-8))
# Chamadas HTTP feitas ao provedor no dia da cota, para o cabeçalho da tela, e o dia da cota em que veio o
# AI_QUOTA_EXCEEDED (exhausted). Tudo fica só na memória: a conta zera quando o dia da cota vira e quando o backend
# reinicia. A trava existe porque as rotas rodam em várias threads.
calls = {"day": None, "count": 0, "exhausted": None}
calls_lock = threading.Lock()

def quota_day(now: datetime | None = None):
    return (now or datetime.now(timezone.utc)).astimezone(QUOTA_TZ).date()

def calls_today(add: int = 0) -> int:
    with calls_lock:
        today = quota_day()
        if calls["day"] != today:
            calls.update(day=today, count=0)
        calls["count"] += add
        return calls["count"]

def quota_exhausted() -> bool:
    # A marca do 429 de cota vale até um pedido passar (ai) ou até o dia da cota virar.
    return calls["exhausted"] == quota_day()

def fail(status: int, code: str, message: str, provider_status: str = "", retry_after: int | None = None):
    detail = {"code": code, "message": message, "provider_status": provider_status}
    if retry_after is not None:
        detail["retry_after"] = retry_after
    raise HTTPException(status_code=status, detail=detail)

# Teto do pedido em andamento: prazo, chamadas que restam e se a tela ainda espera. Só o middleware de main.py abre
# um; o app.check e o app.avalia chamam a IA fora das rotas, sem ele (o app.avalia tem o teto da rodada).
budget: ContextVar[dict | None] = ContextVar("budget", default=None)

def next_call_timeout() -> float:
    # Roda antes de cada chamada HTTP: a que passaria do teto não sai, e a que sai espera no máximo o tempo que sobra.
    left = budget.get()
    if left is None:
        return settings.timeout_seconds
    if left["gone"]():
        # Ninguém recebe esta resposta: a tela já desistiu (Cancelar ou tempo esgotado).
        fail(499, "AI_CANCELLED", "O pedido foi cancelado na tela.")
    remaining = left["deadline"] - time.monotonic()
    if left["calls"] <= 0 or remaining < 1:
        fail(504, "AI_TIMEOUT", "A IA demorou demais para responder. Tente novamente.")
    left["calls"] -= 1
    return min(settings.timeout_seconds, remaining)

def provider_error(exc: HTTPError):
    status = ""
    reason = ""
    wait, daily = 0.0, False
    try:
        body = json.loads(exc.read(32768).decode("utf-8"))
        error = body.get("error", {})
        if isinstance(error, dict):
            status = str(error.get("status", ""))
            for item in error.get("details", []):
                if isinstance(item, dict) and item.get("reason"):
                    reason = str(item["reason"])
                # RetryInfo: quanto o provedor manda esperar, como "21s" ou "21.4s".
                if isinstance(item, dict) and re.fullmatch(r"\d+(\.\d+)?s", str(item.get("retryDelay"))):
                    wait = float(item["retryDelay"][:-1])
                # QuotaFailure: o quotaId diz qual limite estourou ("...PerDay..." ou "...PerMinute...").
                # A cota do dia também pode vir com espera curta, e aí esperar não resolve.
                if isinstance(item, dict) and "PerDay" in str(item.get("violations")):
                    daily = True
        if not status:
            status = "HTTP_" + str(exc.code)
    except (ValueError, AttributeError, TypeError, OSError, http.client.HTTPException, RecursionError):
        # Corpo ilegível, ou conexão que caiu no meio da leitura: segue só com o código HTTP.
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
        # Espera curta = limite por minuto: basta aguardar. Espera longa ou ausente, ou quotaId do dia = cota do dia
        # ou limite do projeto. Sem nova chamada automática aqui: ela gastaria a cota.
        if 0 < wait <= 90 and not daily:
            seconds = math.ceil(wait)
            fail(429, "AI_RATE_LIMITED", f"Limite de chamadas por minuto atingido. Tente de novo em {seconds} segundo{'s' if seconds > 1 else ''}.", status, retry_after=seconds)
        # O /api/health passa a avisar a tela: o selo fica "Cota de hoje esgotada".
        calls["exhausted"] = quota_day()
        fail(429, "AI_QUOTA_EXCEEDED", "A cota de chamadas da IA acabou ou o limite do projeto foi atingido. Confira os limites no provedor e tente mais tarde.", status)
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
    # Cada falha tem a sua conta de novas chamadas: um 503 antes não gasta a segunda chamada do tempo esgotado.
    # São no máximo 4 chamadas (1 + 2 por 503 + 1 por tempo esgotado). O limite do laço e a falha depois dele só seguram
    # um erro futuro aqui dentro: sem eles, um ramo que deixasse de lançar chamaria o provedor sem parar.
    overloaded, timed_out = 0, False
    for _ in range(4):
        # O teto do pedido vem antes da conta do dia: a chamada recusada não sai e não conta.
        timeout = next_call_timeout()
        # Toda chamada entra na conta do dia, também as repetidas e as que terminam em erro.
        calls_today(1)
        try:
            with urlopen(request, timeout=timeout) as response:
                result = json.load(response)
            if not isinstance(result, dict):
                raise ValueError("Expected JSON object")
            return result
        except HTTPError as exc:
            # 503 = modelo sobrecarregado ("high demand"): o provedor pede nova tentativa e costuma passar em segundos.
            if exc.code == 503 and overloaded < 2:
                overloaded += 1
                time.sleep(3 * overloaded)
                continue
            provider_error(exc)
        except (OSError, http.client.HTTPException) as exc:
            # OSError inclui URLError, tempo esgotado e conexão derrubada; http.client cobre resposta cortada no meio.
            # Sem isto a queda virava HTTP 500 em texto puro e a tela culpava o backend.
            if isinstance(exc, TimeoutError) or isinstance(getattr(exc, "reason", None), TimeoutError):
                # O provedor às vezes trava sem responder (1 em 38 chamadas nos testes): a segunda chamada costuma passar.
                if not timed_out:
                    timed_out = True
                    continue
                fail(504, "AI_TIMEOUT", "A IA demorou demais para responder. Tente novamente.")
            fail(503, "AI_NETWORK_ERROR", "O backend não conseguiu acessar a IA. Confira internet, proxy, firewall e certificados HTTPS.")
        except (ValueError, UnicodeError, RecursionError):
            # RecursionError: JSON com milhares de níveis estoura o json.load e não é ValueError; virava HTTP 500 em texto puro.
            fail(502, "AI_INVALID_RESPONSE", "O provedor retornou uma resposta inválida.")
    fail(502, "AI_PROVIDER_ERROR", "Não foi possível concluir a solicitação ao provedor de IA.")

def decode_output(text: str) -> dict:
    try:
        # Meio emoji ("\ud83d" sem o par) passa pelo json.loads, mas não pode ser escrito em UTF-8: no chat virava
        # HTTP 500 em texto puro. O "ignore" tira só o caractere quebrado, sem nova chamada.
        result = json.loads(json.dumps(json.loads(text), ensure_ascii=False).encode("utf-8", "ignore"))
        if not isinstance(result, dict):
            raise ValueError("Expected object")
        return result
    except (TypeError, ValueError, RecursionError):
        fail(502, "AI_INVALID_JSON", "A IA não retornou um objeto JSON válido. Tente novamente.")


def text_model_names(models: list) -> list[str]:
    """A lista da API não informa se há cota gratuita ou acesso de faturamento."""
    names = set()
    for model in models:
        # O campo pode vir nulo no catálogo: "or []" evita o TypeError, que virava HTTP 500 em texto puro.
        if not isinstance(model, dict) or "generateContent" not in (model.get("supportedGenerationMethods") or []):
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


def ai(payload: dict, instruction: str, schema: dict | None = None, retry: bool = True) -> dict:
    if not settings.api_key:
        fail(503, "AI_NOT_CONFIGURED", "A IA ainda não foi ativada. O responsável deve configurar a credencial no .env da raiz do projeto e reiniciar o backend.")
    prompt = SYSTEM + "\n" + instruction
    user = json.dumps(payload, ensure_ascii=False)
    if settings.provider == "gemini":
        # API nativa Gemini: API keys vão em x-goog-api-key, não como OAuth Bearer.
        endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + resolve_gemini_model() + ":generateContent"
        config = {"responseMimeType": "application/json"}
        if schema:
            # Só "modo JSON" não basta: o modelo já devolveu JSON quebrado e índice como texto ("1").
            # Com o esquema, o provedor só gera saída que obedece ao formato.
            config["responseJsonSchema"] = schema
        body = {
            "systemInstruction": {"parts": [{"text": prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": config,
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
    # O provedor aceitou o pedido: a cota voltou. O catálogo de modelos fica de fora: ele passar não diz que a cota de
    # geração voltou.
    calls["exhausted"] = None
    try:
        if settings.provider == "gemini":
            candidates = result.get("candidates", [])
            if not candidates:
                # Pedido bloqueado volta sem candidato. O motivo aparece na tela, como o finishReason abaixo;
                # só os motivos conhecidos, para nunca repassar texto solto do corpo da resposta.
                blocked = (result.get("promptFeedback") or {}).get("blockReason")
                fail(502, "AI_EMPTY_RESPONSE", "A IA não retornou conteúdo. Tente reformular a pergunta.",
                     blocked if blocked in ("SAFETY", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT", "IMAGE_SAFETY") else "")
            candidate = candidates[0]
            reason = candidate.get("finishReason")
            if reason not in (None, "STOP"):
                # O motivo (MAX_TOKENS, RECITATION, SAFETY...) aparece na tela; sem ele não dá para diagnosticar.
                # Só o que tem forma de nome de motivo (maiúsculas e "_"): texto solto do corpo da resposta não é repassado.
                fail(502, "AI_INCOMPLETE_RESPONSE", "A IA interrompeu a resposta. Envie um texto menor ou reformule a pergunta.",
                     reason if isinstance(reason, str) and re.fullmatch(r"[A-Z_]{1,40}", reason) else "")
            parts = candidate.get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
        else:
            text = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, AttributeError):
        fail(502, "AI_INVALID_RESPONSE", "O provedor retornou uma estrutura de resposta inesperada.")
    try:
        return decode_output(text)
    except HTTPException:
        # Sem esquema o modelo às vezes devolve JSON quebrado (visto no chat, 1 em ~20 respostas).
        # Uma segunda chamada costuma vir certa.
        if not retry:
            raise
        logger.warning("provider=%s resposta fora do formato JSON; nova tentativa", settings.provider)
        return ai(payload, instruction, schema, retry=False)
