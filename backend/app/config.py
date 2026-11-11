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
    # (providers.request_json) faz até 4 chamadas. Duas desistências mais as pausas do 503 já somam 99 s; o tempo
    # que os 503 levam para chegar entra por fora. Na conta simples, com cada chamada em até 45 s, dá
    # 4 x 45 + 9 = 189 s, mas não é um teto: o limite vale para cada espera da rede, e uma resposta que chega
    # aos poucos pode levar mais. Um pedido ainda pode fazer mais de uma ida (catálogo com AI_MODEL=auto, JSON
    # quebrado, material recusado, falta de acento). Por isso o total pode passar dos 105 s que o navegador espera.
    timeout_seconds: float = 45.0

def load_settings():
    provider = os.getenv("AI_PROVIDER", "gemini").strip().lower()
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
    return Settings(provider=provider, model=model, api_key=key, allowed_origins=origins)

settings = load_settings()
