# Iniciar no VS Code — Windows

Requisitos: Python 3.11+ e Node.js 22+. Abra a pasta cerebro no VS Code.

## 1. Arquivo de ambiente na raiz

A estrutura deve ser:

```text
cerebro/
  .env             ← crie este arquivo aqui
  .env.exemple     ← exemplo privado solicitado
  .env.example     ← modelo público SEM chave
  backend/
  frontend/
```

Copie .env.exemple para .env na mesma pasta. Não deixe o arquivo como .env.txt.
O backend lê somente cerebro/.env por caminho absoluto; não importa a pasta do terminal.
O exemplo privado não é carregado automaticamente.

Variáveis de ambiente já definidas no Windows têm prioridade. Se houver valores antigos de GEMINI_API_KEY, AI_PROVIDER ou AI_MODEL, remova-os ou atualize-os.
Não precisa informar nome nem número do projeto: a chave já está vinculada à conta/projeto do provedor.

## 2. Terminal do backend

Abra um terminal na raiz cerebro:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
..\.venv\Scripts\python.exe -m app.check
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

app.check faz uma chamada real, consome cota e verifica se o provedor aceita chave/modelo. Não imprime a chave. Mantenha o terminal do servidor aberto.
Se mudar .env, pare com Ctrl+C e reinicie o backend.

Saúde local: http://127.0.0.1:8000/api/health.
ai_configured=true confirma apenas preenchimento, não validade da credencial.
Documentação da API: http://127.0.0.1:8000/docs.

## 3. Outro terminal para o frontend

Abra um SEGUNDO terminal na raiz cerebro:

```powershell
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha /api ao Python na porta 8000.
Não use Live Server nem abra o index.html da raiz para testar IA real: ele é a demonstração estática.
Se a porta 5173 estiver ocupada, encerre a instância antiga antes de iniciar.
Enter envia a pergunta; Shift+Enter insere uma nova linha no editor.

## Diagnóstico

- AI_NOT_CONFIGURED: falta cerebro/.env, chave vazia ou backend ainda não reiniciado.
- AI_AUTH_ERROR: credencial inválida/revogada ou sem permissão. Confira a Gemini API no projeto do Google AI Studio.
- AI_MODEL_NOT_FOUND: AI_MODEL não está disponível no projeto.
- AI_QUOTA_EXCEEDED: cota do projeto atingida. Confira os limites no AI Studio; trocar a chave do mesmo projeto não renova a cota.
- AI_REQUEST_REJECTED: confira modelo, região e situação do projeto/plano.
- AI_NETWORK_ERROR: verifique internet, proxy, firewall e certificados HTTPS.
- Erro de proxy sem JSON: confira o terminal do Python e a porta 8000.
- content.js com chrome-extension://: teste sem extensões; não desative CSP.

## Testes

Na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Os testes simulam o provedor e não consomem cota. Não foram executados no Web Sinart.

## Credenciais

.env e .env.exemple estão ignorados pelo Git. Apenas .env.example, vazio, pode ser versionado.
A chave fornecida no chat já foi exposta: substitua-a por uma nova para uso continuado.
Não sirva a raiz do repositório como pasta pública, pois ela contém arquivos privados.

## Modelo não encontrado (404)

Com esta versão atualizada do backend, use AI_MODEL=auto no .env da raiz e reinicie o Python. O backend consulta models.list, filtra modelos de texto com generateContent e prefere Gemini Flash estável, sem mudar o provedor nem ativar faturamento. A listagem não garante cota gratuita ou acesso à geração.

Para consultar os nomes informados pela API, execute na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m app.check --list-models
```

Você também pode definir AI_MODEL com um nome exato da listagem. Um nome definido explicitamente não é substituído automaticamente. Se um modelo listado ainda retornar 404, confira a situação e as permissões do projeto no Google AI Studio. Nenhum nome fixo é presumido como disponível.
