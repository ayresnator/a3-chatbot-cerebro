# 🧠 Cérebro ✦

**Assistente inteligente de estudos com inteligência artificial.**

O **Cérebro** é uma aplicação desenvolvida para auxiliar estudantes na compreensão de conteúdos, organização de materiais e revisão do aprendizado. Utilizando inteligência artificial, o sistema transforma textos e dúvidas em explicações, resumos, flashcards e quizzes personalizados.

---

## 🎯 Objetivo

Facilitar a preparação de materiais de estudo e incentivar o aprendizado ativo. O projeto reúne criação de conteúdo, revisão e acompanhamento do desempenho em uma única interface.

## 🤖 Inteligência artificial utilizada

O projeto utiliza a **API do Google Gemini**, com o modelo `gemini-3.5-flash-lite` na configuração utilizada durante o desenvolvimento.

A comunicação com a inteligência artificial acontece por meio do backend desenvolvido em Python. A IA interpreta as solicitações e gera explicações e materiais de estudo, que são apresentados na interface.

**Segurança da API:**

- A chave de acesso fica armazenada no arquivo `.env`.
- Somente o backend tem acesso à chave.
- As credenciais não devem ser inseridas no frontend.
- O arquivo `.env` não deve ser publicado no GitHub.
- O uso da API está sujeito aos limites e às condições do provedor.

As respostas geradas pela IA podem conter imprecisões. Por isso, recomenda-se conferir as informações, especialmente em conteúdos que exigem maior rigor.

---

## ✨ Funcionalidades

### 1. Entrada de conteúdo

O aluno pode inserir informações de diferentes maneiras:

- Colar um texto;
- Digitar uma matéria;
- Fazer uma pergunta;
- Utilizar o microfone, quando houver suporte do navegador ao reconhecimento de voz.

O sistema permite selecionar uma das seis áreas de conhecimento:

- Tecnologia;
- Administração;
- Economia;
- Matemática;
- Direito;
- Matérias escolares.

Também é possível escolher o nível de conhecimento:

- Básico;
- Intermediário;
- Avançado.

Essas configurações ajudam a IA a adaptar o conteúdo ao nível do estudante.

### 2. Resumos

Transformam conteúdos extensos em tópicos organizados, destacando os principais conceitos e informações.

O estudante pode:

- Selecionar a quantidade de tópicos;
- Visualizar os principais conceitos;
- Copiar o resumo;
- Salvar o material na biblioteca;
- Acessar os flashcards relacionados.

### 3. Flashcards

Permitem revisar o conteúdo por meio de cartões de perguntas e respostas.

Cada cartão apresenta uma pergunta. Ao clicar, o estudante revela a resposta e pode indicar se:

- Acertou;
- Errou;
- Deseja revisar posteriormente.

As respostas registradas contribuem para o acompanhamento do desempenho por área de conhecimento.

### 4. Quizzes

Oferecem atividades interativas para testar o conhecimento adquirido.

O sistema disponibiliza questões de:

- Múltipla escolha;
- Verdadeiro ou falso;
- Resposta curta.

Após cada resposta, é apresentada uma explicação. Ao finalizar o quiz, o estudante visualiza seu aproveitamento e pode refazer somente as questões que errou.

As respostas curtas são corrigidas por comparação de texto, com normalização de letras maiúsculas e pontuação simples.

### 5. Dúvidas

Permite conversar com o assistente para solicitar explicações, exemplos e esclarecimentos sobre uma matéria ou conteúdo inserido.

Cada solicitação considera:

- A pergunta realizada;
- O texto atual;
- A área selecionada;
- O nível de conhecimento.

Na versão atual, o servidor não mantém memória das conversas.

### 6. Desempenho

Apresenta indicadores relacionados à evolução dos estudos.

Entre as informações disponíveis estão:

- Percentual de acertos;
- Quantidade de flashcards revisados;
- Quantidade de questões respondidas;
- Sequência de dias com atividade;
- Evolução dos acertos;
- Áreas com maior quantidade de erros;
- Sugestões de revisão.

Os indicadores são calculados com base nas respostas registradas no aplicativo.

### 7. Biblioteca

Reúne os materiais salvos para consulta posterior.

O estudante pode:

- Pesquisar por palavras-chave;
- Filtrar materiais por área;
- Abrir conteúdos salvos;
- Excluir materiais.

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Função |
|---|---|
| React | Construção da interface e controle das interações |
| Vite | Ambiente de desenvolvimento e geração do frontend |
| CSS | Estilização e adaptação da interface |
| Python | Implementação do backend |
| FastAPI | Criação das rotas de comunicação |
| Pydantic | Validação dos dados recebidos e dos materiais gerados |
| Google Gemini API | Geração de explicações e materiais de estudo |
| localStorage | Armazenamento de dados no navegador |

---

## ⚙️ Como o sistema funciona

O funcionamento da aplicação acontece por meio das seguintes etapas:

1. O aluno informa uma pergunta ou conteúdo na interface React.
2. O frontend envia a solicitação ao backend FastAPI.
3. O backend lê a configuração privada e encaminha a solicitação ao Gemini.
4. A inteligência artificial gera uma resposta conforme as instruções do assistente.
5. O backend valida os materiais estruturados antes de devolvê-los.
6. O frontend apresenta o resultado e permite estudar ou salvar o material.

**Armazenamento:** os materiais salvos, o perfil local e os registros de desempenho ficam armazenados no navegador, utilizando `localStorage`. Esses dados não são armazenados em um banco de dados no servidor.

---

## 📁 Estrutura do projeto

```text
cerebro/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── providers.py
│   │   ├── models.py
│   │   ├── prompts.py
│   │   ├── main.py
│   │   └── check.py
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── docs/
├── .env.example
├── .gitignore
├── INICIAR-NO-VSCODE.md
└── README.md
```

### Descrição dos principais arquivos

| Arquivo/Pasta | Descrição |
|---|---|
| `backend/app/config.py` | Configurações e leitura do `.env` |
| `backend/app/providers.py` | Comunicação com o provedor de IA |
| `backend/app/models.py` | Validação dos dados |
| `backend/app/prompts.py` | Instruções do assistente |
| `backend/app/main.py` | Rotas da API |
| `backend/app/check.py` | Diagnóstico da integração |
| `backend/tests/` | Testes com chamadas simuladas |
| `frontend/src/` | Interface React e estilos |
| `frontend/public/` | Arquivos públicos |
| `docs/` | Documentação de validação |

---

## 🚀 Executar o projeto

As instruções completas de instalação e execução estão disponíveis no arquivo [INICIAR-NO-VSCODE.md](INICIAR-NO-VSCODE.md).

Para executar a aplicação:

1. Clone ou baixe o repositório.
2. Configure o arquivo `.env` na raiz do projeto.
3. Instale as dependências do backend.
4. Instale as dependências do frontend.
5. Inicie o backend e o frontend em terminais separados.

A interface local ficará disponível em:

**http://localhost:5173**

Consulte o arquivo `INICIAR-NO-VSCODE.md` para obter os comandos específicos de instalação e inicialização.

---

## ⚠️ Limitações atuais

- O perfil é local, sem autenticação real ou login com Google.
- Não há sincronização entre dispositivos.
- Limpar os dados do navegador pode apagar materiais e informações de desempenho.
- O reconhecimento de voz depende do navegador e de suas permissões.
- A disponibilidade da inteligência artificial depende da conexão, do modelo e da cota do provedor.
- A entrada estática da raiz é uma demonstração que organiza frases, sem consultar a IA.
- O backend precisa de autenticação e controle de chamadas antes de ser disponibilizado para acesso público amplo.

---

## 🔒 Segurança

Algumas recomendações importantes para manter o projeto seguro:

- Nunca publique o arquivo `.env`.
- Não compartilhe chaves reais da API.
- Mantenha as credenciais exclusivamente no backend.
- Utilize o `.env.example` apenas como modelo de configuração, sem credenciais reais.
- Evite inserir dados pessoais ou informações confidenciais nos conteúdos enviados à inteligência artificial.

As solicitações de estudo são enviadas ao provedor de IA quando a integração está ativa.

---

## 📌 Considerações finais

O **Cérebro** foi desenvolvido para tornar o processo de aprendizagem mais acessível, organizado e interativo, reunindo ferramentas de estudo em uma única aplicação.

A proposta é utilizar a inteligência artificial como apoio ao aprendizado, permitindo que os estudantes compreendam conteúdos, pratiquem seus conhecimentos e acompanhem sua evolução.