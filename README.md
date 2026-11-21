# 🧠 Cérebro ✦

**Assistente inteligente de estudos com inteligência artificial.**

O **Cérebro** é uma aplicação desenvolvida para auxiliar estudantes na compreensão de conteúdos, organização de materiais e revisão do aprendizado. A partir de um texto ou de um tema, o sistema gera resumo, flashcards e quiz, responde dúvidas e mostra ao estudante onde ele está errando.

---

## 🎯 Objetivo

Facilitar a preparação de materiais de estudo e incentivar o aprendizado ativo. O projeto reúne criação de conteúdo, revisão e acompanhamento do desempenho em uma única interface.

## 🤖 Inteligência artificial utilizada

O projeto usa a **API do Google Gemini**, com o modelo `gemini-3.5-flash-lite` na faixa gratuita. Só o backend em Python fala com o provedor. A IA é chamada em quatro situações:

| Uso | O que a IA faz | Rota do backend |
|---|---|---|
| Gerar material | Monta resumo, flashcards e quiz a partir do texto ou do tema | `POST /api/generate` |
| Tirar dúvidas | Responde no chat e explica de outro jeito um tópico ou uma questão | `POST /api/chat` |
| Revisar resposta curta | Julga o sentido de uma resposta que a comparação de texto marcou como errada | `POST /api/grade` |
| Escrever um exemplo | Escreve, para o botão "Usar um exemplo", um texto curto sobre um tema sorteado da área escolhida | `POST /api/example` |

O programa não aceita a resposta do modelo sem conferir. Ele valida cada item gerado, descarta a questão cujo gabarito não aponta uma opção, embaralha as alternativas e só mostra um trecho como "No seu texto" quando esse trecho existe no texto que o aluno enviou. Os detalhes, com os números dos testes, estão em [docs/IA.md](docs/IA.md).

O que a IA não faz: corrigir múltipla escolha, calcular o desempenho, montar o caderno de erros e marcar o dia em que cada cartão e cada questão do caderno voltam. Essas partes são código comum, sem chamada ao modelo.

**Privacidade:** o texto do editor, as perguntas, o título e o resumo do material aberto nas perguntas sobre ele e as respostas enviadas para revisão vão para o Google. Na faixa gratuita, os termos da Gemini API permitem usar esse conteúdo para melhorar os produtos do Google e deixam revisores humanos lerem o que foi enviado. Não cole dados pessoais. A página Estudar mostra o aviso "Seu texto é enviado ao Google Gemini para gerar o material. Não cole dados pessoais." antes dos botões de gerar. O Cérebro é para uso local do grupo, no computador de cada aluno, e a chave gratuita do Gemini é só para isso.

**Segurança da API:**

- A chave de acesso fica armazenada no arquivo `.env`.
- Somente o backend tem acesso à chave.
- As credenciais não devem ser inseridas no frontend.
- O arquivo `.env` não deve ser publicado no GitHub.
- O uso da API está sujeito aos limites e às condições do provedor.

As respostas geradas pela IA podem conter erros. Confira as informações com o seu material, principalmente em conteúdos que exigem rigor.

---

## ✨ Funcionalidades

### 1. Entrada de conteúdo

O aluno pode inserir informações de diferentes maneiras:

- Colar um texto;
- Escrever um tema;
- Fazer uma pergunta;
- Utilizar o microfone, quando houver suporte do navegador ao reconhecimento de voz.

O sistema permite selecionar uma das seis áreas de conhecimento:

- Tecnologia;
- Administração;
- Economia;
- Matemática;
- Direito;
- Escolar (matérias escolares).

Também é possível escolher o nível de conhecimento:

- Básico;
- Intermediário;
- Avançado.

Essas configurações ajudam a IA a adaptar o conteúdo ao nível do estudante.

O texto do editor, o material aberto e a conversa ficam guardados no navegador: recarregar a página ou fechar a aba não apaga o trabalho. Com o app aberto em duas abas, cada uma guarda o seu rascunho, e recarregar uma delas traz o texto dela; uma aba nova abre com o último rascunho gravado. O botão "Limpar" esvazia o editor e pode ser desfeito.

### 2. Resumo

Transformam conteúdos extensos em tópicos organizados, destacando os principais conceitos e informações.

O estudante pode:

- Escolher quantos tópicos aparecem (por padrão, todos), com a contagem "Mostrando N de M tópicos" e o botão "Ver os outros N tópicos" quando algum fica escondido;
- Copiar o resumo inteiro;
- Salvar o material na biblioteca;
- Acessar os flashcards relacionados;
- Pedir outra explicação de um tópico, no botão "Não entendi, me explique", sem sair da página.

Quando o material veio de um texto, o tópico traz o trecho que o sustenta ("No seu texto: ..."). O backend só mantém o trecho que existe no texto enviado. O texto do "Usar um exemplo" não é do estudante: trecho que saiu do texto que a IA escreveu aparece como "No exemplo escrito pela IA: ...", e trecho de um exemplo pronto, como "No texto de exemplo: ...". O tópico sem trecho, ou com trecho do exemplo da IA, ganha a etiqueta "Explicação da IA: confira". O aviso sob o título diz de onde veio o material: de um texto do estudante, de um exemplo pronto, do exemplo da IA ou de nada que dê para conferir. O material da demonstração não usa IA e não leva aviso nem etiqueta; o trecho de cada tópico dele é a própria frase do texto.

### 3. Flashcards

Permitem revisar o conteúdo por meio de cartões de perguntas e respostas.

Cada cartão apresenta uma pergunta. Ao clicar, o estudante revela a resposta e pode indicar se:

- Acertou;
- Errou;
- Deseja revisar posteriormente.

O cartão errado volta ao fim da fila até ser acertado. No fim, o estudante vê quantos cartões revisou e quantos voltaram por erro, e pode refazer só esses.

Cada cartão avaliado também ganha uma caixa de 1 a 4 e um dia de volta, como nas caixas de Leitner: a caixa 1 volta em 1 dia, a 2 em 3 dias, a 3 em 7 dias e a 4 em 16 dias. O cartão avaliado pela primeira vez entra na caixa 1. "Acertei" no dia marcado ou depois sobe uma caixa, e a 4 continua na 4; antes do dia marcado não muda nada, e rever o baralho no mesmo dia não empurra o cartão para longe. "Errei" leva o cartão de volta à caixa 1, e "Revisar depois" não muda a caixa.

Os cartões que voltam hoje, do material aberto e de todos os materiais da biblioteca, formam a revisão do dia: no máximo 20 por vez, os mais atrasados primeiro, cada um com o material de onde veio. Ela abre pelo link "N cartões para hoje" em "Seu progresso", no Estudar, e pelo botão "Revisão do dia (N)" da página Flashcards, também sem material aberto. Sair da página Flashcards fecha a revisão e devolve o material que estava aberto. Cartão de material excluído da biblioteca sai da revisão. Quem diz se lembrou é o próprio estudante, e a tela pede: "A caixa sobe pelo seu Acertei. Marque só o que você lembrou de verdade." O baralho de um material continua com todos os cartões, na ordem do material.

Trocar de aba (Resumo, Flashcards, Quiz) ou de página no meio do baralho ou do quiz não recomeça: o estudante volta ao mesmo cartão e à mesma questão. Para recomeçar no meio, há o botão "Recomeçar" ao lado de "Cartão X de Y" e de "Questão X de Y"; depois de "Refazer só os que errei" ou "Refazer as que errei", ele recomeça só o que o estudante errou. O baralho e o quiz também recomeçam ao gerar um material novo, ao abrir outro da biblioteca e ao sair do quiz do caderno de erros ou da revisão do dia. Abrir uma parte do material pelos botões de "Abrir" do Estudar, ou abrir de novo na biblioteca o que já está aberto, não recomeça.

### 4. Quiz

Oferecem atividades interativas para testar o conhecimento adquirido.

O sistema disponibiliza questões de:

- Múltipla escolha;
- Verdadeiro ou falso;
- Resposta curta.

Após cada resposta aparecem a explicação e a opção certa, marcada também com texto ("✓ certa", "✗ sua resposta"), não só com cor. Na resposta curta aparece o gabarito e, quando o estudante erra, também o que ele digitou. Ao finalizar o quiz, o estudante vê o aproveitamento e a lista das questões que errou, com a resposta dada, a resposta certa e a explicação, e pode refazer somente essas.

As respostas curtas são corrigidas por comparação de texto. Maiúsculas, acentos e a pontuação no fim da resposta são ignorados, e a vírgula decimal vale como ponto. Uma questão pode aceitar mais de uma forma de resposta, como a sigla e o nome por extenso.

Quando a comparação marca como errada uma resposta que o estudante considera certa, ele pode usar "Pedir revisão da IA". A IA julga o sentido da resposta. Se o veredito for "correta", o resultado da questão é corrigido. Com "parcial" ou "incorreta", a resposta continua como erro, e a questão fica no caderno de erros: parcial não vale ponto. A tela diz o efeito logo abaixo do comentário da IA.

Com a IA ativa, as alternativas de múltipla escolha são embaralhadas pelo backend a cada material gerado.

### 5. Dúvidas

Permite conversar com o assistente para solicitar explicações, exemplos e esclarecimentos sobre uma matéria ou conteúdo inserido.

Cada solicitação considera:

- A pergunta realizada;
- O material aberto (o título e o resumo dele) ou o texto do editor;
- A área e o nível do material aberto, ou os escolhidos no editor;
- As últimas 6 mensagens da conversa.

Com um material aberto, a pergunta é sobre ele: a caixa do chat mostra "Sobre:" e o título do material no lugar das listas de área e nível, e a saudação diz qual material vai ser considerado. O botão "Usar o texto do editor" troca a fonte, e "Usar o material aberto" volta ao material. Perguntar pelo editor ("Perguntar ao Cérebro") também passa o chat para o texto do editor, e abrir outro material volta a valer o material. Se o material aberto foi gerado do texto que está no editor, vale o texto do editor, que é mais completo.

O servidor não guarda as conversas. A cada pergunta, o navegador envia junto as últimas 6 mensagens, sem repetir o texto do editor (ele já vai no pedido), e é assim que o assistente entende um pedido como "me dê um exemplo". A conversa fica guardada no navegador e continua depois de recarregar a página; "Nova conversa" recomeça do zero e pode ser desfeita até a próxima pergunta.

O chat abre com uma saudação do Cérebro. Com a IA ativa, acima da caixa de texto ficam sugestões de perguntas sobre o assunto: antes da primeira resposta elas são sobre a área escolhida ou sobre o texto (o do editor ou o do material aberto); depois, são até três perguntas que a própria IA manda junto com cada resposta. Se ela não mandar nenhuma, entram três perguntas fixas. Um "/" no começo da caixa, ou o botão de atalhos, abre a lista dessas sugestões. A demonstração não mostra os chips de sugestão, mas a lista do "/" funciona nela.

### 6. Caderno de erros

Reúne as questões que o estudante errou nos quizzes, de todos os materiais.

O estudante pode:

- Ver a resposta certa e a explicação de cada questão;
- Refazer as questões de hoje, em "Refazer os de hoje", no máximo 10 por vez e as mais atrasadas primeiro;
- Treinar todas as questões do caderno de uma vez;
- Tirar uma questão da lista.

Cada questão volta num dia marcado. Errou: ela volta amanhã. Cada acerto no dia marcado ou depois sobe um degrau: depois do primeiro a questão volta em 3 dias, depois do segundo em 7, e o terceiro a tira do caderno. São 3 acertos em dias diferentes, cada um no dia marcado. Acertar antes do dia, como logo depois de ler a explicação ou no "Treinar todas", não muda nada, e errar em qualquer degrau volta a questão ao começo. A página mostra quando cada questão volta ("para hoje", "volta amanhã" ou "volta em 23/11") e quantos acertos ela já tem ("1 de 3 acertos"); sem nenhuma para hoje, diz quando volta a próxima. Em "Seu progresso", no Estudar, o link mostra quantas questões são para hoje.

A questão também sai na hora quando a revisão da IA aceita a resposta ou quando o estudante a tira. Erro gravado antes dessa regra, ou vindo de um backup antigo, começa no primeiro degrau e volta no dia seguinte ao do erro.

### 7. Desempenho

Apresenta indicadores relacionados à evolução dos estudos.

Entre as informações disponíveis estão:

- Dias seguidos de estudo;
- Quantidade de questões respondidas e percentual de acerto no quiz;
- Autoavaliação nos flashcards, separada do quiz;
- Respostas e acertos dos últimos 7 dias: a altura da barra é o número de respostas do dia, e o rótulo diz quantas foram e o percentual de acerto;
- Acerto por área;
- Seu próximo passo, conforme o que o estudante já fez.

O acerto no quiz conta só a primeira resposta de cada questão no dia. Refazer a mesma questão não aumenta o número. Nos cartões vale a mesma regra: conta a primeira avaliação de cada cartão no dia, e revisar o baralho de novo no mesmo dia não muda o número de cartões revisados nem a autoavaliação.

"Seu próximo passo" tem três casos:

- Sem resposta no quiz: um botão para fazer o quiz do material aberto ou, sem material aberto, para gerar um;
- Com respostas e nenhum material com erro: o aviso de que nenhum material pede revisão nos últimos 7 dias. Um material aparece ali quando tem 3 ou mais respostas no quiz e algum erro. Se o caderno de erros tem questões para hoje, fica o "Refazer os de hoje";
- Com um material com erro: o de maior taxa de erro nos últimos 7 dias, com "Refazer os erros de ...", que abre só as questões desse material no caderno de erros, e "Abrir ...", que abre o material no resumo quando ele está aberto ou na biblioteca.

Ao abrir o app e ao importar um backup, o histórico perde as repetições de dias passados: de cada questão do quiz, em cada dia, ficam a primeira resposta e, se ela foi um erro, o primeiro acerto. As avaliações dos cartões ficam todas. Os números da tela não mudam, e o histórico ocupa menos espaço no navegador.

### 8. Biblioteca

Reúne os materiais salvos para consulta posterior.

O estudante pode:

- Pesquisar por palavras-chave;
- Filtrar materiais por área;
- Abrir conteúdos salvos;
- Excluir materiais, com a opção de desfazer;
- Exportar a biblioteca, o desempenho, o caderno de erros, as caixas dos cartões e o perfil para um arquivo;
- Importar esse arquivo em outro navegador ou computador, sem duplicar o que já existe. O perfil do arquivo só entra se o navegador ainda não tiver um, e o aviso diz o que ficou de fora por estar incompleto. Backup antigo, sem as caixas dos cartões, continua valendo.

Todo material gerado vai para a biblioteca assim que chega, sem esperar o "Salvar material"; na demonstração, gerar de novo com o mesmo texto não cria cópia. Com o app aberto em duas abas, o que uma grava (biblioteca, desempenho, caderno de erros, perfil) aparece na outra sem recarregar.

No pé da Biblioteca e do Desempenho, uma linha lembra que os dados ficam só neste navegador e diz quando foi o último backup. O botão "Fazer backup" baixa o mesmo arquivo do Exportar e ganha destaque quando há 5 materiais novos desde o último backup, ou 7 dias ou mais sem backup com algum material ou resposta nova.

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Função |
|---|---|
| React | Construção da interface e controle das interações |
| Vite | Ambiente de desenvolvimento e geração do frontend |
| CSS | Estilização e adaptação da interface |
| Motion | Animações e transições da interface |
| thinking-orbs | Orbe animado nas esperas da IA |
| Manrope | Fonte da interface, servida pelo próprio aplicativo: pacote `@fontsource-variable/manrope`, licença SIL Open Font License 1.1 |
| Python | Implementação do backend |
| FastAPI | Criação das rotas de comunicação |
| Pydantic | Validação dos dados recebidos e dos materiais gerados |
| Google Gemini API | Geração de explicações e materiais de estudo |
| localStorage | Armazenamento de dados no navegador |
| unittest e node:test | Testes automáticos do backend e do frontend |
| GitHub Actions | Execução dos testes a cada envio ao repositório |

---

## ⚙️ Como o sistema funciona

O funcionamento da aplicação acontece por meio das seguintes etapas:

1. O aluno informa uma pergunta ou conteúdo na interface React.
2. O frontend envia a solicitação ao backend FastAPI.
3. O backend confere a entrada, lê a configuração privada e encaminha a solicitação ao Gemini.
4. A inteligência artificial gera uma resposta em JSON, conforme as instruções do assistente.
5. O backend valida cada item da resposta, descarta o que não passa e, se sobrar pouco, pede o material de novo.
6. O frontend apresenta o resultado e permite estudar ou salvar o material.

**Armazenamento:** os materiais salvos, o perfil local, os registros de desempenho, o caderno de erros, as caixas dos cartões, a data do último backup e o rascunho (texto do editor, material aberto e conversa) ficam armazenados no navegador, utilizando `localStorage`; cada aba guarda também o seu rascunho, no `sessionStorage`. A demonstração (`?demo`) grava à parte, em chaves com o prefixo `cerebro-demo-`. Esses dados não são armazenados em um banco de dados no servidor.

---

## 📁 Estrutura do projeto

```text
a3-chatbot-cerebro/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── providers.py
│   │   ├── models.py
│   │   ├── prompts.py
│   │   ├── main.py
│   │   ├── check.py
│   │   └── avalia.py
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── constraints.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Biblioteca.jsx
│   │   ├── Desempenho.jsx
│   │   ├── Perfil.jsx
│   │   ├── ui.jsx
│   │   ├── icons.jsx
│   │   ├── marks.jsx
│   │   ├── anim.js
│   │   ├── lib.js
│   │   ├── exemplos.js
│   │   ├── styles.css
│   │   ├── mobile.css
│   │   └── components/ui/chat-composer.jsx
│   ├── tests/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│   ├── IA.md
│   ├── PUBLICAR.md
│   ├── ROTEIRO.md
│   ├── VALIDACAO.md
│   ├── avaliacao-2026-11-17.json
│   └── avaliacao-2026-11-17-2.json
├── .github/workflows/testes.yml
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── iniciar.ps1
├── INICIAR-NO-VSCODE.md
└── README.md
```

### Descrição dos principais arquivos

| Arquivo/Pasta | Descrição |
|---|---|
| `backend/app/config.py` | Configurações e leitura do `.env` |
| `backend/app/providers.py` | Comunicação com o provedor de IA, novas tentativas e tratamento dos erros |
| `backend/app/models.py` | Validação da entrada e de cada item gerado pela IA |
| `backend/app/prompts.py` | Instruções do assistente |
| `backend/app/main.py` | Rotas da API e as conferências feitas depois da resposta do modelo |
| `backend/app/check.py` | Diagnóstico da integração |
| `backend/app/avalia.py` | Rodada de avaliação da IA com casos fixos |
| `backend/tests/` | Testes com chamadas simuladas |
| `frontend/src/App.jsx` | Interface React: tela principal e estado do app |
| `frontend/src/Biblioteca.jsx`, `Desempenho.jsx` e `Perfil.jsx` | Páginas Biblioteca e Desempenho e formulário do perfil, carregados à parte |
| `frontend/src/ui.jsx`, `icons.jsx` e `marks.jsx` | Peças de tela usadas por mais de uma página, ícones e marcas de correção |
| `frontend/src/components/ui/chat-composer.jsx` | Caixa de pergunta da página Dúvidas: campo, atalhos com "/", área, nível e envio |
| `frontend/src/anim.js` | Regras das animações, feitas com o Motion |
| `frontend/src/lib.js` | Regras da interface sem React: correção, desempenho, caderno de erros, backup |
| `frontend/src/exemplos.js` | Exemplos prontos do "Usar um exemplo", carregados à parte da abertura |
| `frontend/tests/` | Testes das regras de `lib.js` e `exemplos.js` |
| `frontend/public/` | Arquivos públicos |
| `docs/IA.md` | Como o Cérebro usa a IA e o que confere depois |
| `docs/ROTEIRO.md` | Roteiro da apresentação |
| `docs/VALIDACAO.md` | Registro dos testes e das validações |
| `docs/avaliacao-2026-11-17.json` e `avaliacao-2026-11-17-2.json` | Respostas gravadas da rodada de avaliação de 17/11/2026 |
| `.github/workflows/testes.yml` | Testes automáticos a cada envio |
| `iniciar.ps1` | Abre o backend, o frontend e o navegador com um comando, depois da primeira instalação (Windows) |
| `AGENTS.md` | Regras do grupo para issues e pull requests, lidas também pelos agentes de IA (`CLAUDE.md` e `GEMINI.md` só importam este arquivo) |

---

## 🚀 Executar o projeto

As instruções completas de instalação e execução estão disponíveis no arquivo [INICIAR-NO-VSCODE.md](INICIAR-NO-VSCODE.md).

Para executar a aplicação:

1. Clone ou baixe o repositório.
2. Configure o arquivo `.env` na raiz do projeto.
3. Instale as dependências do backend.
4. Instale as dependências do frontend.
5. Inicie o backend e o frontend em terminais separados.

Depois da primeira instalação, no Windows, o `iniciar.ps1`, na raiz do projeto, abre o backend, o frontend e o navegador com um comando só.

A interface local ficará disponível em:

**http://localhost:5173**

Para ver a interface sem chave e sem backend, deixe só o frontend rodando (`npm run dev`, na pasta `frontend`) e abra **http://localhost:5173/?demo**. A demonstração organiza as frases do texto em resumo, flashcards e quiz, sem consultar a IA. Ela guarda à parte o que se faz nela: a biblioteca, o desempenho, o caderno de erros, o perfil e o rascunho dela não se misturam com os do app com IA.

Consulte o arquivo `INICIAR-NO-VSCODE.md` para obter os comandos específicos de instalação e inicialização.

---

## 🧪 Testes e validação

Os testes simulam o provedor de IA: não precisam de chave e não gastam cota.

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt -c constraints.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests

cd ..\frontend
npm test
npm run build
```

O GitHub Actions roda os mesmos comandos a cada envio ao repositório.

A qualidade do que a IA escreve não cabe em teste simulado. Para isso existe a rodada de avaliação (`.\.venv\Scripts\python.exe -m app.avalia --rodar`, na pasta `backend`), que faz até 24 pedidos reais ao Gemini com casos fixos e mede, entre outras coisas, se o modelo obedece a uma ordem escondida no texto do aluno. Ela consome a cota da chave e para em 40 chamadas HTTP, contando as novas tentativas; o [INICIAR-NO-VSCODE.md](INICIAR-NO-VSCODE.md) mostra como fazer a rodada inteira.

O número de testes, o resultado da última execução e o que ainda não rodou na API real estão em [docs/VALIDACAO.md](docs/VALIDACAO.md).

---

## ⚠️ Limitações atuais

- O perfil é local, sem autenticação real ou login com Google.
- Não há sincronização entre dispositivos. Para levar os dados a outro navegador, use Exportar (ou "Fazer backup") e Importar na Biblioteca.
- Limpar os dados do navegador apaga materiais, desempenho e caderno de erros que não foram exportados.
- O reconhecimento de voz depende do navegador e de suas permissões.
- A disponibilidade da inteligência artificial depende da conexão, do modelo e da cota do provedor. A faixa gratuita tem limite de chamadas por minuto e por dia.
- O conteúdo gerado pode estar errado. O trecho "No seu texto" prova que a frase existe no texto enviado, não que o tópico está certo.
- A revisão de resposta curta feita pela IA também pode errar.
- A demonstração (`?demo`) organiza frases, sem consultar a IA.
- O Cérebro é para uso local do grupo. O que falta para abri-lo na internet, com as decisões do grupo, os termos da Gemini API, a LGPD e as tarefas do backend, está em [docs/PUBLICAR.md](docs/PUBLICAR.md).

---

## 🔒 Segurança

Algumas recomendações importantes para manter o projeto seguro:

- Nunca publique o arquivo `.env`.
- Não compartilhe chaves reais da API.
- Mantenha as credenciais exclusivamente no backend.
- Utilize o `.env.example` apenas como modelo de configuração, sem credenciais reais.
- Evite inserir dados pessoais ou informações confidenciais nos conteúdos enviados à inteligência artificial.

As solicitações de estudo são enviadas ao provedor de IA quando a integração está ativa. O servidor não guarda o texto do aluno, e o registro de erros do backend anota o campo e o motivo, nunca o conteúdo.

A fonte da interface vem junto com o aplicativo: abrir a tela não faz pedido a servidores de fora.

---

## 📌 Considerações finais

O **Cérebro** foi desenvolvido para tornar o processo de aprendizagem mais acessível, organizado e interativo, reunindo ferramentas de estudo em uma única aplicação.

A proposta é utilizar a inteligência artificial como apoio ao aprendizado, permitindo que os estudantes compreendam conteúdos, pratiquem seus conhecimentos e acompanhem sua evolução.
