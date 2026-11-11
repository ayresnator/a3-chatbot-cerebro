# Iniciar no VS Code — Windows

Requisitos: Python 3.11+ e Node.js 22+. Abra a pasta cerebro no VS Code.

## 1. Arquivo de ambiente na raiz

A estrutura deve ser:

```text
cerebro/
  .env             ← crie este arquivo aqui (fica só no seu computador)
  .env.example     ← modelo público SEM chave
  backend/
  frontend/
```

Copie .env.example para .env na mesma pasta e troque `sua_chave_aqui` pela sua chave em GEMINI_API_KEY. Não deixe o arquivo como .env.txt.
Nunca coloque a chave no .env.example: esse arquivo vai para o GitHub.
O backend lê somente cerebro/.env por caminho absoluto; não importa a pasta do terminal.

Variáveis de ambiente já definidas no Windows têm prioridade. Se houver valores antigos de GEMINI_API_KEY, AI_PROVIDER ou AI_MODEL, remova-os ou atualize-os.
Não precisa informar nome nem número do projeto: a chave já está vinculada à conta/projeto do provedor.
Outro provedor (opcional): AI_PROVIDER=openai, com OPENAI_API_KEY e AI_MODEL (padrão gpt-4o-mini). Esse caminho só tem teste simulado: nunca foi rodado com chave real, e as mensagens de erro citam o Gemini.

## 2. Terminal do backend

Abra um terminal na raiz cerebro:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.check
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
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
Use sempre esse endereço. Em http://127.0.0.1:5173 a conexão pode ser recusada, e o que foi salvo em um endereço (biblioteca, desempenho, perfil) não aparece no outro: o navegador guarda esses dados por endereço.
O servidor só responde neste computador. Para abrir no celular na mesma rede, use `npm run dev -- --host` e desligue depois: enquanto estiver assim, qualquer pessoa na rede pode usar o chat e gastar a cota da sua chave.
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
- AI_TIMEOUT: a IA não respondeu em 45 segundos, nem na segunda tentativa que o backend faz sozinho. Tente de novo.
- Tempo de espera esgotado (sem código): o navegador desiste depois de 105 segundos. Pode acontecer quando o backend precisa de várias chamadas seguidas ao Gemini no mesmo pedido. Tente de novo.
- AI_PROVIDER_UNAVAILABLE: erro do lado do Gemini. Quando é sobrecarga (HTTP 503: aparece UNAVAILABLE ou HTTP_503 depois do código), o backend já tentou mais duas vezes sozinho: aguarde alguns minutos. Nos outros erros 5xx (INTERNAL, por exemplo) ele faz uma chamada só: vale tentar de novo.
- AI_INCOMPLETE_RESPONSE: a IA parou no meio. O motivo aparece depois do código (MAX_TOKENS, RECITATION, SAFETY). Reformule ou envie um texto menor.
- Erro de proxy sem JSON: confira o terminal do Python e a porta 8000.
- content.js com chrome-extension://: teste sem extensões; não desative CSP.

## Testes

Na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Os testes simulam o provedor e não consomem cota. O resultado da última execução está em docs/VALIDACAO.md.

## Credenciais

.env está ignorado pelo Git. Apenas .env.example, sem chave real, é versionado.
Uma chave colada em chat, e-mail, print ou commit já foi exposta: gere outra no Google AI Studio.
Não sirva a raiz do repositório como pasta pública, pois ela contém arquivos privados.

## Modelo não encontrado (404)

Com esta versão atualizada do backend, use AI_MODEL=auto no .env da raiz e reinicie o Python. O backend consulta models.list, filtra modelos de texto com generateContent e prefere Gemini Flash estável, sem mudar o provedor nem ativar faturamento. A listagem não garante cota gratuita ou acesso à geração.

Para consultar os nomes informados pela API, execute na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m app.check --list-models
```

Você também pode definir AI_MODEL com um nome exato da listagem. Um nome definido explicitamente não é substituído automaticamente. Se um modelo listado ainda retornar 404, confira a situação e as permissões do projeto no Google AI Studio. Nenhum nome fixo é presumido como disponível.
