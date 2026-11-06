# Cérebro ✦

Assistente de estudos em português com frontend React/Vite e backend Python/FastAPI.
Inclui resumos, flashcards, quizzes, dúvidas, biblioteca e desempenho local.

## Rodar no VS Code

Siga **INICIAR-NO-VSCODE.md**. Crie **.env na raiz cerebro**, ao lado deste README, copiando .env.exemple. O backend lê esse único caminho, sem depender da pasta do terminal.

- .env.exemple: exemplo privado solicitado, ignorado pelo Git.
- .env.example: modelo público vazio, sem credenciais.
- .env: configuração real que você cria localmente; ignorada pelo Git.

A interface não recebe chaves nem configurações privadas. O React envia /api ao Python via proxy Vite.

## Organização

```text
cerebro/
  .env.exemple                 # privado, ignorado pelo Git
  .env.example                 # modelo sem credenciais
  .gitignore
  README.md
  INICIAR-NO-VSCODE.md
  backend/
    requirements.txt
    requirements-dev.txt
    app/
      config.py                # lê cerebro/.env
      providers.py             # Gemini nativo ou OpenAI
      models.py                # validação
      prompts.py               # instruções do tutor
      main.py                  # rotas FastAPI
      check.py                 # diagnóstico real, sem imprimir segredo
    tests/
      test_api.py              # chamadas simuladas
  frontend/
    package.json
    vite.config.js             # proxy /api para porta 8000
    index.html
    public/
      config.js                # configuração pública, sem chave
      favicon.svg
    src/
      App.jsx
      styles.css
      mobile.css
  index.html                   # demonstração estática
  config.js
  docs/VALIDACAO.md
```

## API

- GET /api/health: estado local, modelo e presença de credencial. Não confirma autenticação.
- POST /api/chat: recebe pergunta, conteúdo, área e nível; retorna answer.
- POST /api/generate: retorna resumo, cartões e quiz validados.

Gemini usa generateContent nativo e autenticação x-goog-api-key.
Padrão: AI_PROVIDER=gemini e AI_MODEL=auto.
OpenAI é opcional com AI_PROVIDER=openai, AI_MODEL=gpt-4o-mini e OPENAI_API_KEY no .env.
Credenciais, modelos, região e cotas precisam ser válidos no provedor; não há troca automática para um serviço pago.

## Produção

Na pasta frontend, npm run build produz frontend/dist. Publique apenas esse diretório e hospede Python separadamente. Configure um proxy /api ou a URL pública do backend em frontend/public/config.js antes do build. Configure ALLOWED_ORIGINS quando necessário.
Nunca sirva a raiz do repositório como conteúdo estático: .env e .env.exemple são privados.
O servidor ainda requer autenticação e controle de chamadas por usuário antes de acesso público amplo.

## Limites e validação

Perfil e materiais ficam no navegador, sem autenticação real nem sincronização.
A demonstração estática organiza frases sem chamar IA.
A integração real exige Python ativo, .env válido e acesso ao provedor.
Foi realizada revisão estática; não foram executados servidores, builds, testes ou chamadas autenticadas neste ambiente.

## Modelo não encontrado (404)

Com esta versão atualizada do backend, use AI_MODEL=auto no .env da raiz e reinicie o Python. O backend consulta models.list, filtra modelos de texto com generateContent e prefere Gemini Flash estável, sem mudar o provedor nem ativar faturamento. A listagem não garante cota gratuita ou acesso à geração.

Para consultar os nomes informados pela API, execute na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m app.check --list-models
```

Você também pode definir AI_MODEL com um nome exato da listagem. Um nome definido explicitamente não é substituído automaticamente. Se um modelo listado ainda retornar 404, confira a situação e as permissões do projeto no Google AI Studio. Nenhum nome fixo é presumido como disponível.
