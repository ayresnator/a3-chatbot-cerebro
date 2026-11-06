"""Diagnóstico local; --list-models consulta o catálogo sem gerar conteúdo."""
import sys

from fastapi import HTTPException
from .config import ENV_FILE, settings
from .providers import ai, list_gemini_models, resolve_gemini_model

def main():
    print("Arquivo de ambiente:", ENV_FILE)
    print("Arquivo encontrado:", ENV_FILE.is_file())
    print("Provedor:", settings.provider)
    print("Modelo configurado:", settings.model)
    print("Credencial preenchida:", bool(settings.api_key))
    try:
        if "--list-models" in sys.argv:
            if settings.provider != "gemini":
                print("Esta opção é específica do Gemini.")
                return 1
            names = list_gemini_models()
            print("Modelos de texto listados pela API:")
            for name in names:
                print(" -", name)
            print("A listagem não garante cota gratuita nem permissão de geração.")
            return 0 if names else 1
        if settings.provider == "gemini":
            print("Modelo selecionado:", resolve_gemini_model())
        print("Verificando chamada real ao provedor (consome cota)...")
        data = ai({"question": "Responda apenas ok."}, 'Retorne exatamente o objeto JSON {"answer":"ok"}.')
        if not isinstance(data.get("answer"), str) or not data["answer"].strip():
            print("FALHA: resposta sem o campo answer.")
            return 1
        print("OK: provedor autenticou e retornou uma resposta válida.")
        return 0
    except HTTPException as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            print("FALHA:", detail.get("code"), detail.get("provider_status"))
            print(detail.get("message"))
        else:
            print("FALHA:", detail)
        return 1

if __name__ == "__main__":
    sys.exit(main())
