import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
ENV_FILE = PROJECT_DIR / ".env"
# O único arquivo local de credenciais é cerebro/.env.
# Variáveis da hospedagem têm prioridade sobre o arquivo local.
load_dotenv(ENV_FILE, override=False, encoding="utf-8-sig")

@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    api_key: str = field(repr=False)
    allowed_origins: list[str]
    # Resposta normal leva até 22 s. Cada chamada ao provedor desiste depois de 45 s sem resposta, e uma ida
    # (providers.request_json) faz até 4 chamadas. Um pedido pode fazer mais de uma ida (catálogo com AI_MODEL=auto,
    # JSON quebrado, material recusado, falta de acento, interrupção por RECITATION, revisão fora do formato), e sem
    # teto um clique chegou a 32 chamadas. Por isso o pedido inteiro tem teto: request_calls chamadas e request_seconds,
    # abaixo dos 105 s em que o navegador desiste (requestAPI, em frontend/src/App.jsx). Cada chamada espera o menor
    # entre timeout_seconds e o tempo que sobra; o limite vale para cada espera da rede, não para a resposta inteira.
    timeout_seconds: float = 45.0
    request_seconds: float = 100.0
    request_calls: int = 6
    # Nomes aceitos no cabeçalho Host, sem a porta. Fecha o DNS rebinding: um site de fora que aponta o próprio nome
    # para 127.0.0.1 passaria pelo CORS como se fosse da mesma origem e gastaria a cota.
    allowed_hosts: list[str] = field(default_factory=lambda: ["127.0.0.1", "localhost"])

def load_settings():
    # "AI_PROVIDER=" sem valor no .env vale o padrão, como já acontece com AI_MODEL.
    provider = os.getenv("AI_PROVIDER", "").strip().lower() or "gemini"
    if provider not in {"gemini", "openai"}:
        raise ValueError("AI_PROVIDER deve ser gemini ou openai.")
    default_model = "auto" if provider == "gemini" else "gpt-4o-mini"
    model = os.getenv("AI_MODEL", default_model).strip() or default_model
    if model.startswith("models/"):
        model = model[7:]
    if not re.fullmatch(r"[A-Za-z0-9._-]+", model):
        raise ValueError("AI_MODEL contém caracteres inválidos.")
    if provider == "openai" and model == "auto":
        raise ValueError("Para OpenAI, defina AI_MODEL explicitamente.")
    key_name = "GEMINI_API_KEY" if provider == "gemini" else "OPENAI_API_KEY"
    key = os.getenv(key_name, "").strip()
    # Valor de exemplo (o do .env.example e os de modelos antigos) conta como "sem chave".
    if key in {"sua_chave_aqui", "sua_credencial_privada", "COLE_A_NOVA_CHAVE_AQUI"}:
        key = ""
    origins = [s.strip() for s in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if s.strip()]
    # "ALLOWED_HOSTS=" sem valor vale o padrão: a lista vazia recusaria até o proxy do Vite.
    hosts = [s.strip() for s in os.getenv("ALLOWED_HOSTS", "").split(",") if s.strip()] or ["127.0.0.1", "localhost"]
    return Settings(provider=provider, model=model, api_key=key, allowed_origins=origins, allowed_hosts=hosts)

settings = load_settings()
