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
- Utilizar o microfone, quando houver suporte do navegador ao reconhecimento de voz;
- Abrir um arquivo PDF, TXT ou MD de até 20 MB, pelo botão "Arquivo" do editor ("Abrir arquivo" para o leitor de tela) ou soltando o arquivo sobre o editor.

O arquivo é lido no próprio navegador e não sai do computador: só o texto que fica no editor vai para a IA, quando o estudante gera o material. O texto do arquivo toma o lugar do que estava no editor, com "Desfazer". O do PDF chega limpo: a palavra quebrada por hífen no fim da linha volta inteira, e saem o cabeçalho e o rodapé que se repetem nas páginas e as linhas que só têm o número da página. Se o PDF passar de 20.000 caracteres, o limite do editor, uma janela pede as páginas e conta os caracteres enquanto o estudante escolhe; um TXT ou MD maior entra cortado no limite, com aviso. Um TXT gravado no formato antigo do Bloco de Notas (Windows-1252) entra com os acentos certos. PDF digitalizado (só imagem) ou com senha não abre, e a tela diz o que fazer; arquivo do Word ou do PowerPoint também não: a tela pede para salvá-lo em PDF. O leitor de PDF (pdf.js) só é baixado no primeiro PDF aberto.

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
- Pedir outra explicação de um tópico, no botão "Não entendi, me explique", sem sair da página;
- Ver o trecho de um tópico dentro do texto inteiro, no botão "Ver no texto";
- Tentar responder antes de ler e esconder o texto dos tópicos para testar a memória.

Reler um resumo ensina pouco; tentar lembrar fixa mais, mesmo quando a resposta sai errada. Por isso o resumo abre com o bloco "Tente responder antes de ler": 2 perguntas dos flashcards do material, com um campo para cada. Ninguém corrige na hora. Depois de "Ler o resumo", o fim da página mostra "Confira o que você pensou", com cada pergunta, o que o estudante escreveu e a resposta do material. "Pular" fecha o bloco, que fica no botão "Tentar antes de ler", na faixa de ferramentas. Quem pula duas vezes seguidas deixa de ver o bloco aberto nos próximos materiais: ele aparece só nesse botão. "Ler o resumo" com os dois campos em branco também conta como pulo. A conta dos pulos fica no navegador e zera quando o estudante escreve uma resposta.

Na mesma faixa, a caixa "Esconder o texto" deixa cada tópico só com o título e o botão "Mostrar". O texto, o trecho "No seu texto" e o botão "Ver no texto" aparecem juntos ao mostrar, e o estudante marca "Lembrei" ou "Não lembrei"; apertar de novo a marca escolhida a tira. No fim da lista, "Você lembrou 4 de 6 tópicos" conta os tópicos já marcados e lista os que ficaram para rever. Desligar e ligar a caixa começa outra rodada. Nada disso chama a IA nem entra no desempenho ou no caderno de erros, e só a conta dos pulos fica gravada. Também funciona na demonstração.

Quando o material veio de um texto, o tópico traz o trecho que o sustenta ("No seu texto: ..."). O backend só mantém o trecho que existe no texto enviado. O texto do "Usar um exemplo" não é do estudante: trecho que saiu do texto que a IA escreveu aparece como "No exemplo escrito pela IA: ...", e trecho de um exemplo pronto, como "No texto de exemplo: ...". O tópico sem trecho, ou com trecho do exemplo da IA, ganha a etiqueta "Explicação da IA: confira". O aviso sob o título diz de onde veio o material: de um texto do estudante, de um exemplo pronto, do exemplo da IA ou de nada que dê para conferir. O material da demonstração não usa IA e não leva aviso nem etiqueta; o trecho de cada tópico dele é a própria frase do texto.

O material guarda o texto de onde saiu, com até 20.000 caracteres. Embaixo de cada trecho, "Ver no texto" abre esse texto inteiro numa janela, com o trecho marcado e já à vista; o título da janela diz se o texto é do estudante, de um exemplo pronto ou do exemplo da IA. A tela acha o trecho pela mesma regra do backend, sem diferença de maiúsculas e acentos e com os espaços juntos; se não achar, a janela abre sem marca e diz isso. Na janela, "Levar este texto ao editor" põe o texto de volta no Estudar, para gerar de novo, e o texto que estava no editor pode voltar com "Desfazer". Nada disso chama a IA. O material salvo antes dessa função não guardou o texto e fica sem o botão.

### 3. Flashcards

Permitem revisar o conteúdo por meio de cartões de perguntas e respostas.

Cada cartão apresenta uma pergunta. Ao clicar, o estudante revela a resposta e pode indicar se:

- Acertou;
- Errou;
- Deseja revisar posteriormente.

O cartão errado volta ao fim da fila até ser acertado. No fim, o estudante vê quantos cartões revisou e quantos voltaram por erro, e pode refazer só esses.

Cada cartão avaliado também ganha uma caixa de 1 a 4 e um dia de volta, como nas caixas de Leitner: a caixa 1 volta em 1 dia, a 2 em 3 dias, a 3 em 7 dias e a 4 em 16 dias. O cartão avaliado pela primeira vez entra na caixa 1. "Acertei" no dia marcado ou depois sobe uma caixa, e a 4 continua na 4; antes do dia marcado não muda nada, e rever o baralho no mesmo dia não empurra o cartão para longe. "Errei" leva o cartão de volta à caixa 1, e "Revisar depois" não muda a caixa.

Os cartões que voltam hoje, do material aberto e de todos os materiais da biblioteca, formam a revisão do dia: no máximo 20 por vez, os mais atrasados primeiro, cada um com o material de onde veio. Ela abre pelo link "N cartões para hoje" em "Seu progresso", no Estudar, e pelo botão "Revisão do dia (N)" da página Flashcards, também sem material aberto. Sair da página Flashcards fecha a revisão e devolve o material que estava aberto. Cartão de material excluído da biblioteca sai da revisão. Quem diz se lembrou é o próprio estudante, e a tela pede: "A caixa sobe pelo seu Acertei. Marque só o que você lembrou de verdade." O baralho de um material continua com todos os cartões, na ordem do material.

Trocar de aba (Resumo, Flashcards, Quiz) ou de página no meio do baralho ou do quiz não recomeça: o estudante volta ao mesmo cartão e à mesma questão. Para recomeçar no meio, há o botão "Recomeçar" ao lado de "Cartão X de Y" e de "Questão X de Y"; depois de "Refazer só os que errei" ou "Refazer as que errei", ele recomeça só o que o estudante errou. O baralho e o quiz também recomeçam ao gerar um material novo, ao abrir outro da biblioteca e ao sair do quiz do caderno de erros, do simulado ou da revisão do dia. Abrir uma parte do material pelos botões de "Abrir" do Estudar, ou abrir de novo na biblioteca o que já está aberto, não recomeça.

### 4. Quiz

Oferecem atividades interativas para testar o conhecimento adquirido.

O sistema disponibiliza questões de:

- Múltipla escolha;
- Verdadeiro ou falso;
- Resposta curta.

Após cada resposta aparecem a explicação e a opção certa, marcada também com texto ("✓ certa", "✗ sua resposta"), não só com cor. Na resposta curta aparece o gabarito e, quando o estudante erra, também o que ele digitou. Ao finalizar o quiz, o estudante vê o aproveitamento e a lista das questões que errou, com a resposta dada, a resposta certa e a explicação, e pode refazer somente essas. No simulado da Biblioteca a correção fica para o fim (veja a seção 8).

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
- Com um material com erro: o de maior taxa de erro nos últimos 7 dias, com "Refazer os erros de ...", que abre só as questões desse material no caderno de erros, e "Abrir ...", que abre o material no resumo quando ele está aberto ou na biblioteca. Se o caderno de erros tem questões para hoje, o principal é o "Refazer os de hoje", e "Refazer os erros de ..." fica ao lado, como treino: o acerto antes do dia marcado não sobe degrau.

Ao abrir o app e ao importar um backup, o histórico perde as repetições de dias passados: de cada questão do quiz, em cada dia, ficam a primeira resposta e, se ela foi um erro, o primeiro acerto. As avaliações dos cartões ficam todas. Os números da tela não mudam, e o histórico ocupa menos espaço no navegador.

### 8. Biblioteca

Reúne os materiais salvos para consulta posterior.

O estudante pode:

- Pesquisar por palavras-chave;
- Filtrar materiais por área;
- Abrir conteúdos salvos;
- Excluir materiais, com a opção de desfazer;
- Fazer um simulado com questões de vários materiais, com a correção só no fim;
- Exportar a biblioteca, o desempenho, o caderno de erros, as caixas dos cartões e o perfil para um arquivo. Cada material vai com o texto de onde saiu: antes de passar o arquivo adiante, lembre que ele leva o que foi colado no editor;
- Importar esse arquivo em outro navegador ou computador, sem duplicar o que já existe. O perfil do arquivo só entra se o navegador ainda não tiver um, e o aviso diz o que ficou de fora por estar incompleto. Backup antigo, sem as caixas dos cartões, continua valendo.

Todo material gerado vai para a biblioteca assim que chega, sem esperar o "Salvar material"; na demonstração, gerar de novo com o mesmo texto não cria cópia. Com o app aberto em duas abas, o que uma grava (biblioteca, desempenho, caderno de erros, caixas dos cartões, perfil) aparece na outra sem recarregar.

O simulado usa os materiais que estão na lista, depois da busca e do filtro de área. O estudante escolhe 10, 20 ou 30 questões, e a linha diz quantas entram e de quantos materiais ("20 questões de 4 materiais"); se a lista tem menos questões que o pedido, entram todas. O sorteio pega uma questão de cada material antes de repetir algum e depois embaralha a ordem; as alternativas ficam como estão no material. Durante o simulado a tela não corrige: depois de cada resposta só aparece "Próxima questão", e cada questão diz de que material veio. O fim mostra o aproveitamento, o acerto por material e as questões erradas com a resposta certa e a explicação. "Refazer as que errei" volta com a correção na hora, e "Voltar à Biblioteca" fecha o simulado e devolve o material que estava aberto, como ir para outra página no meio dele. Cada resposta conta no desempenho e no caderno de erros com o material de onde veio. O simulado não chama a IA, funciona na demonstração e não fica guardado: recarregar a página no meio dele também o fecha.

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
| pdf.js | Leitura do texto dos PDFs abertos no editor, no próprio navegador: pacote `pdfjs-dist`, licença Apache-2.0 |
| Manrope | Fonte da interface, servida pelo próprio aplicativo: pacote `@fontsource-variable/manrope`, licença SIL Open Font License 1.1 |
| Python | Implementação do backend |
| FastAPI | Criação das rotas de comunicação |
| Pydantic | Validação dos dados recebidos e dos materiais gerados |
| Google Gemini API | Geração de explicações e materiais de estudo |
| localStorage | Armazenamento de dados no navegador |
| unittest e node:test | Testes automáticos do backend e do frontend |
| GitHub Actions | Execução dos testes a cada envio ao repositório e, disparada à mão, a publicação do modo estudo |
| Service worker e manifest | Modo estudo no celular: instalar o app na tela inicial e abrir sem internet |

---

## ⚙️ Como o sistema funciona

O funcionamento da aplicação acontece por meio das seguintes etapas:

1. O aluno informa uma pergunta ou conteúdo na interface React.
2. O frontend envia a solicitação ao backend FastAPI.
3. O backend confere a entrada, lê a configuração privada e encaminha a solicitação ao Gemini.
4. A inteligência artificial gera uma resposta em JSON, conforme as instruções do assistente.
5. O backend valida cada item da resposta, descarta o que não passa e, se sobrar pouco, pede o material de novo.
6. O frontend apresenta o resultado e permite estudar ou salvar o material.

**Armazenamento:** os materiais salvos, o perfil local, os registros de desempenho, o caderno de erros, as caixas dos cartões, a data do último backup, a conta de pulos do "Tente responder antes de ler" e o rascunho (texto do editor, material aberto e conversa) ficam armazenados no navegador, utilizando `localStorage`; cada aba guarda também o seu rascunho, no `sessionStorage`. A demonstração (`?demo`) grava à parte, em chaves com o prefixo `cerebro-demo-`; o modo estudo do celular grava nas mesmas chaves do app com IA, no navegador do celular. Esses dados não são armazenados em um banco de dados no servidor. Cada material guarda também o texto de onde saiu, de até 20.000 caracteres, e por isso ocupa mais espaço no navegador; quando o espaço acaba, a tela avisa que não conseguiu salvar.

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
│   │   ├── arquivo.js
│   │   ├── exemplos.js
│   │   ├── styles.css
│   │   ├── mobile.css
│   │   └── components/ui/chat-composer.jsx
│   ├── tests/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── sw-molde.js
│   └── vite.config.js
│
├── docs/
│   ├── IA.md
│   ├── PUBLICAR.md
│   ├── ROTEIRO.md
│   ├── VALIDACAO.md
│   ├── avaliacao-2026-11-17.json
│   └── avaliacao-2026-11-17-2.json
├── .github/workflows/
│   ├── testes.yml
│   └── publicar.yml
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
| `frontend/src/lib.js` | Regras da interface sem React: correção, desempenho, caderno de erros, simulado, backup |
| `frontend/src/arquivo.js` | Leitura e limpeza do PDF, do TXT e do MD do "Abrir arquivo", carregada à parte da abertura |
| `frontend/src/exemplos.js` | Exemplos prontos do "Usar um exemplo", carregados à parte da abertura |
| `frontend/tests/` | Testes das regras de `lib.js`, `arquivo.js` e `exemplos.js` e do service worker do modo estudo |
| `frontend/public/` | Arquivos públicos: o `config.js`, o favicon e, do modo estudo, o manifest e os ícones |
| `frontend/sw-molde.js` | Molde do service worker do modo estudo: o build (`vite.config.js`) põe nele a lista de arquivos e grava o `sw.js` |
| `docs/IA.md` | Como o Cérebro usa a IA e o que confere depois |
| `docs/ROTEIRO.md` | Roteiro da apresentação |
| `docs/VALIDACAO.md` | Registro dos testes e das validações |
| `docs/avaliacao-2026-11-17.json` e `avaliacao-2026-11-17-2.json` | Respostas gravadas da rodada de avaliação de 17/11/2026 |
| `.github/workflows/testes.yml` | Testes automáticos a cada envio |
| `.github/workflows/publicar.yml` | Publicação do modo estudo no GitHub Pages, só quando alguém a dispara à mão |
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

Para ver a interface sem chave e sem backend, deixe só o frontend rodando (`npm run dev`, na pasta `frontend`) e abra **http://localhost:5173/?demo**. A demonstração organiza as frases do texto em resumo, flashcards e quiz, sem consultar a IA. Ela guarda à parte o que se faz nela: a biblioteca, o desempenho, o caderno de erros, as caixas dos cartões, o perfil e o rascunho dela não se misturam com os do app com IA.

Consulte o arquivo `INICIAR-NO-VSCODE.md` para obter os comandos específicos de instalação e inicialização.

---

## 📱 Estudar no celular

O modo estudo é o mesmo aplicativo, sem IA, para revisar os materiais no celular, também sem internet. Ele não tem backend nem chave e não faz nenhum pedido à `/api`: o que o estudante faz nele não sai do aparelho e não gasta chamada da IA. O build é o de sempre, com `semIA: true` no `config.js`.

O que muda:

- O cabeçalho mostra "Modo estudo · sem IA".
- Os botões de gerar só organizam o texto por frases, como na demonstração, e a página Estudar diz isso. O Dúvidas não responde: as respostas precisam do computador com a IA.
- Resumo, flashcards, quiz, caderno de erros, simulado, Desempenho e Biblioteca funcionam como no computador. O material que veio do app com IA continua com o aviso da IA.
- Os dados são de verdade e ficam no navegador do celular, nas mesmas chaves do app com IA e no formato do backup.

Para levar os materiais e trazer o progresso de volta:

1. No computador, na Biblioteca, clique em "Exportar".
2. Passe o arquivo `cerebro-backup-AAAA-MM-DD.json` para o celular, por cabo, por e-mail para você mesmo ou por uma pasta na nuvem. Ele leva os textos dos materiais e o desempenho: não o mande a outras pessoas.
3. No celular, na Biblioteca, toque em "Importar" e escolha o arquivo.
4. Para trazer o desempenho e o caderno de erros de volta, faça o caminho contrário: "Exportar" no celular e "Importar" no computador. Importar não duplica o que já existe.

Depois da primeira visita, o app abre sem internet; o leitor de PDF do "Abrir arquivo" fica guardado no primeiro PDF aberto. Para pôr o app na tela inicial: no Android, no Chrome, menu ⋮ > "Instalar app"; no iPhone, no Safari, Compartilhar > "Adicionar à Tela de Início". Instale: no iPhone, o Safari apaga os dados de um site que não está na tela inicial depois de 7 dias sem uso. O modo estudo pede ao navegador para não apagar os dados sozinho, mas quem decide é o navegador: faça backup com frequência. Quando sai uma versão nova, um aviso oferece "Atualizar"; até o clique, o app continua na versão de antes.

Para conferir no computador, monte o mesmo build do fluxo de publicação e sirva a pasta `dist`:

```powershell
cd frontend
npx vite build --base ./
Set-Content dist\config.js "window.CEREBRO_CONFIG = { demo: false, apiBaseUrl: '', semIA: true };"
python -m http.server 4173 -d dist
```

Abra **http://localhost:4173**, de preferência no Chrome com a largura de um celular. No Windows, o `http.server` do Python às vezes recusa conexões quando o navegador pede muitos arquivos de uma vez; se o app não abrir sem internet depois da primeira visita, recarregue a página uma vez com o servidor ligado. `npm run dev` e `?demo` não usam o modo estudo nem o service worker.

**Publicar.** O fluxo `.github/workflows/publicar.yml` monta esse build e o publica no GitHub Pages. Ele só roda quando alguém o dispara à mão, e hoje nada está publicado. Publicar é decisão do dono do repositório, em dois passos:

1. Em Settings > Pages, escolher Source: GitHub Actions.
2. Em Actions > publicar, clicar em "Run workflow".

O endereço fica https://ayresnator.github.io/a3-chatbot-cerebro/, e qualquer pessoa com o link abre o modo estudo. Nenhum dado vai para servidor e nenhuma chave é publicada, mas o GitHub vê o endereço IP de quem abre a página. O navegador guarda os dados por endereço, e esse endereço é o mesmo dos outros sites que a conta publica no GitHub Pages: uma página de outro repositório da conta enxergaria os dados do Cérebro guardados naquele navegador.

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
- Limpar os dados do navegador apaga materiais, desempenho, caderno de erros e caixas dos cartões que não foram exportados.
- O reconhecimento de voz depende do navegador e de suas permissões.
- O "Abrir arquivo" lê o texto que o PDF guarda: PDF digitalizado (só imagem) e PDF com senha não abrem, e o de duas colunas pode sair com os trechos fora de ordem. Confira o texto no editor antes de gerar o material.
- A disponibilidade da inteligência artificial depende da conexão, do modelo e da cota do provedor. A faixa gratuita tem limite de chamadas por minuto e por dia.
- O grupo pode pôr um teto de chamadas por dia (`AI_DAILY_LIMIT`, no `.env`; vazio, sem teto). No teto, os botões da IA ficam desligados até a virada do dia, e o resto do app funciona sem IA. A conta é a deste backend, desde que ele ligou no dia, e zera quando ele reinicia: não é o saldo da cota no Google, e outros computadores com a mesma chave não entram nela.
- O conteúdo gerado pode estar errado. O trecho "No seu texto" prova que a frase existe no texto enviado, não que o tópico está certo.
- A revisão de resposta curta feita pela IA também pode errar.
- A demonstração (`?demo`) organiza frases, sem consultar a IA.
- No modo estudo do celular, os dados ficam no celular: o caminho de volta para o computador é o Exportar. No iPhone, com o app fora da tela inicial, o Safari apaga os dados depois de 7 dias sem uso.
- O Cérebro com IA é para uso local do grupo. O que falta para abri-lo na internet, com as decisões do grupo, os termos da Gemini API, a LGPD e as tarefas do backend, está em [docs/PUBLICAR.md](docs/PUBLICAR.md). O modo estudo, sem IA, pode ser publicado à parte (veja "Estudar no celular").

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
