# Iniciar no VS Code

Requisitos: Git, Python 3.11 ou mais novo e Node.js 22 ou mais novo. Os comandos são do PowerShell do Windows; os de macOS e Linux estão no fim.

## 0. Baixar o projeto e conferir as ferramentas

```powershell
git clone https://github.com/ayresnator/a3-chatbot-cerebro.git
cd a3-chatbot-cerebro
python --version
node --version
```

Abra a pasta a3-chatbot-cerebro no VS Code. Se `python` ou `node` não forem reconhecidos, instale o que falta e abra um terminal novo.

## 1. Arquivo de ambiente na raiz

A estrutura deve ser:

```text
a3-chatbot-cerebro/
  .env             ← crie este arquivo aqui (fica só no seu computador)
  .env.example     ← modelo público SEM chave
  backend/
  frontend/
```

Na raiz do projeto:

```powershell
Copy-Item .env.example .env
```

Abra o .env e troque `sua_chave_aqui` pela sua chave em GEMINI_API_KEY. A chave gratuita é criada no Google AI Studio: https://aistudio.google.com/apikey. Não deixe o arquivo como .env.txt.
Nunca coloque a chave no .env.example: esse arquivo vai para o GitHub.
O backend lê somente a3-chatbot-cerebro/.env por caminho absoluto; não importa a pasta do terminal.

Variáveis de ambiente já definidas no Windows têm prioridade. Se houver valores antigos de GEMINI_API_KEY, AI_PROVIDER ou AI_MODEL, remova-os ou atualize-os.
Não precisa informar nome nem número do projeto: a chave já está vinculada à conta/projeto do provedor.
Outro provedor (opcional): AI_PROVIDER=openai, com a chave em OPENAI_API_KEY (crie a linha: o .env.example não tem) e AI_MODEL trocado por um modelo da OpenAI. Com AI_MODEL vazio vale o padrão gpt-4o-mini. Esse caminho só tem teste simulado: nunca foi rodado com chave real, e as mensagens de erro citam o Gemini.

## 2. Terminal do backend

Abra um terminal na raiz a3-chatbot-cerebro:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -c constraints.txt
.\.venv\Scripts\python.exe -m app.check
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

app.check faz uma chamada real, consome cota e verifica se o provedor aceita chave/modelo. Não imprime a chave. Mantenha o terminal do servidor aberto.
Se mudar .env, pare com Ctrl+C e reinicie o backend.

Saúde local: http://127.0.0.1:8000/api/health.
ai_configured=true confirma apenas preenchimento, não validade da credencial. calls_today conta as chamadas que este backend fez ao provedor desde a meia-noite e volta a zero quando ele reinicia. As chamadas do app.check e do app.avalia não entram: rodam em outro processo.
Documentação da API: http://127.0.0.1:8000/docs.

## 3. Outro terminal para o frontend

Abra um SEGUNDO terminal na raiz a3-chatbot-cerebro:

```powershell
cd frontend
npm ci
npm run dev
```

Se o PowerShell disser que a execução de scripts está desabilitada, use `npm.cmd ci` e `npm.cmd run dev`.

Abra http://localhost:5173. O Vite encaminha /api ao Python na porta 8000.
Use sempre esse endereço. Em http://127.0.0.1:5173 a conexão pode ser recusada, e o que foi salvo em um endereço (biblioteca, desempenho, perfil) não aparece no outro: o navegador guarda esses dados por endereço. Para levar a biblioteca, o desempenho e o caderno de erros a outro navegador ou computador, use Exportar e Importar na Biblioteca. O arquivo exportado também leva o perfil (nome e área), mas o Importar não o traz: crie o perfil de novo no outro navegador.
O cabeçalho mostra o estado da IA: "IA ativa", com o modelo e as chamadas do dia; "IA não configurada", quando falta a chave no .env; ou "Backend desligado", quando o terminal do Python não está rodando.
O servidor só responde neste computador. Para abrir no celular na mesma rede, use `npm run dev -- --host` e desligue depois: enquanto estiver assim, qualquer pessoa na rede pode usar o chat e gastar a cota da sua chave.
Se a porta 5173 estiver ocupada, encerre a instância antiga antes de iniciar.
Enter envia a pergunta; Shift+Enter insere uma nova linha no editor. Em tela de toque o Enter só pula linha e o envio fica no botão.

## Depois da primeira vez: um comando só

Com o `.venv` do backend e o `npm ci` do frontend já feitos, rode na raiz do projeto:

```powershell
.\iniciar.ps1
```

O script abre duas janelas do PowerShell, uma com o backend (porta 8000) e outra com o frontend (porta 5173), e depois abre http://localhost:5173 no navegador. Se uma das portas já estiver em uso, ele avisa e não abre aquele servidor de novo. Para parar, feche as duas janelas. Se o PowerShell disser que a execução de scripts está desabilitada, use `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1`.

## Demonstração sem IA

Com o frontend rodando, abra http://localhost:5173/?demo. A demonstração organiza as frases do texto em resumo, flashcards e quiz, sem chamar o Gemini e sem precisar do backend.

## Diagnóstico

- AI_NOT_CONFIGURED: falta a3-chatbot-cerebro/.env, chave vazia ou backend ainda não reiniciado.
- AI_AUTH_ERROR: credencial inválida/revogada ou sem permissão. Confira a Gemini API no projeto do Google AI Studio.
- AI_MODEL_NOT_FOUND: AI_MODEL não está disponível no projeto.
- AI_RATE_LIMITED: limite de chamadas por minuto da chave. A mensagem diz quantos segundos esperar. Não é a cota do dia: basta aguardar.
- AI_QUOTA_EXCEEDED: cota do projeto atingida. Confira os limites no AI Studio; trocar a chave do mesmo projeto não renova a cota.
- AI_REQUEST_REJECTED: confira modelo, região e situação do projeto/plano.
- AI_NETWORK_ERROR: verifique internet, proxy, firewall e certificados HTTPS.
- AI_TIMEOUT: a IA não respondeu em 45 segundos, nem na segunda tentativa que o backend faz sozinho. Tente de novo.
- Tempo de espera esgotado (sem código): o navegador desiste depois de 105 segundos. Pode acontecer quando o backend precisa de várias chamadas seguidas ao Gemini no mesmo pedido. Tente de novo.
- AI_PROVIDER_UNAVAILABLE: erro do lado do Gemini. Quando é sobrecarga (HTTP 503: aparece UNAVAILABLE ou HTTP_503 depois do código), o backend já tentou mais duas vezes sozinho: aguarde alguns minutos. Nos outros erros 5xx (INTERNAL, por exemplo) ele faz uma chamada só: vale tentar de novo.
- AI_INCOMPLETE_RESPONSE: a IA parou no meio. O motivo aparece depois do código (MAX_TOKENS, RECITATION, SAFETY). Reformule ou envie um texto menor.
- AI_EMPTY_RESPONSE: a IA não devolveu conteúdo. Se aparecer um motivo depois do código (SAFETY, por exemplo), o provedor bloqueou o pedido: reformule.
- AI_INVALID_MATERIAL: o material gerado não passou na validação do backend, nem na segunda chamada. Tente de novo; se repetir com o mesmo texto, envie um trecho menor.
- AI_INVALID_ANSWER: a resposta do chat, da revisão ou do exemplo veio fora do formato esperado. Tente de novo.
- AI_INVALID_JSON: a IA respondeu fora do formato JSON, também na segunda chamada que o backend faz sozinho. Tente de novo.
- AI_INVALID_RESPONSE: o provedor devolveu uma resposta que o backend não conseguiu ler. Tente de novo.
- AI_PROVIDER_ERROR: o provedor recusou o pedido com um erro que não está nesta lista. O código HTTP aparece depois do código do erro (HTTP_302, por exemplo, quando um filtro de rede redireciona o pedido).
- AI_NO_COMPATIBLE_MODEL: com AI_MODEL=auto (ou vazio, que no Gemini vale auto), a listagem não trouxe nenhum Gemini Flash estável. Veja "Modelo não encontrado (404)" e ponha em AI_MODEL um nome da listagem.
- INVALID_INPUT: o pedido foi recusado antes de chegar à IA (texto vazio, longo demais ou campo inválido). A mensagem diz o que corrigir.
- Erro de proxy sem JSON: confira o terminal do Python e a porta 8000.
- content.js com chrome-extension://: teste sem extensões; não desative CSP.

## Testes

Na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt -c constraints.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Na pasta frontend:

```powershell
npm test
npm run build
```

Os testes simulam o provedor e não consomem cota. O GitHub Actions roda os mesmos testes e o build a cada envio ao repositório. O resultado da última execução está em docs/VALIDACAO.md.

O `-c constraints.txt` faz o pip instalar as versões de backend/constraints.txt, as que passaram nos testes. O GitHub Actions instala as mesmas. Para subir uma versão: mude o número no requirements.txt ou no requirements-dev.txt, apague a pasta .venv e crie de novo, instale sem o `-c constraints.txt` e rode os testes. Se passarem, troque as linhas de versão do constraints.txt pela saída de `.\.venv\Scripts\python.exe -m pip freeze`, mantendo os comentários. A linha do uvloop, que só o Linux instala, vem do log do passo de instalação do GitHub Actions: se ele recusar a versão, apague a linha, envie de novo e copie a versão que o log mostrar.

## Avaliação da IA com chamadas reais

Na pasta backend:

```powershell
.\.venv\Scripts\python.exe -m app.avalia
.\.venv\Scripts\python.exe -m app.avalia --rodar
```

O primeiro comando só mostra os 24 casos e o teto de chamadas, sem chamar nada. O segundo chama o Gemini de verdade e grava o resultado em docs/, mesmo se for interrompido no meio. Ele para em 40 chamadas HTTP, contando as novas tentativas automáticas; `--limite 50` muda o teto. Também para sozinho se a cota do dia acabar ou a chave for recusada.

Na rodada de 17/11/2026, feita com `--limite 35`, as 35 chamadas combinadas não bastaram: as novas tentativas automáticas (503 do provedor e material sem acento, por exemplo) gastaram o teto antes das 3 últimas revisões. Para a rodada inteira, conte com umas 45 chamadas e use `--limite 50`. Não rode no dia da apresentação: a cota é a mesma.

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

## macOS e Linux

Os passos são os mesmos; mudam os comandos.

```bash
cp .env.example .env
cd backend
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt -c constraints.txt
./.venv/bin/python -m app.check
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Testes: na pasta backend, `./.venv/bin/python -m pip install -r requirements-dev.txt -c constraints.txt` e depois `./.venv/bin/python -m unittest discover -s tests -v`; na pasta frontend, `npm test`. O grupo não rodou os comandos desta seção em macOS ou Linux. Em Linux, o GitHub Actions instala as dependências, roda os testes e faz o build a cada envio; ele não inicia o backend nem o frontend.
