#### Cérebro ✦

O **Cérebro** é um assistente de estudos com inteligência artificial, desenvolvido para ajudar alunos a entender conteúdos, organizar materiais e revisar o que aprenderam.

O aluno pode inserir um texto, informar uma matéria ou fazer uma pergunta. A partir disso, o sistema oferece explicações, resumos, flashcards e quizzes em português, considerando a área de conhecimento e o nível selecionado.

#### Objetivo

Facilitar a preparação do material de estudo e incentivar o aprendizado ativo. O projeto reúne a criação de conteúdo, a revisão e o acompanhamento de respostas em uma única interface.

#### Inteligência artificial utilizada

O projeto utiliza a **API do Google Gemini**, com o modelo `gemini-3.5-flash-lite` na configuração utilizada durante o desenvolvimento.

A aplicação envia as solicitações ao Gemini pelo backend Python. A IA interpreta o conteúdo e produz explicações ou materiais de estudo, que são apresentados na interface.

A chave de acesso fica no arquivo `.env`, lido exclusivamente pelo backend. Ela não deve ser incluída no código do frontend nem publicada no GitHub.

O uso da API depende das condições de acesso e dos limites da conta no provedor. As respostas podem conter imprecisões e devem ser conferidas, especialmente em conteúdos que exigem maior rigor.

#### Funcionalidades

#### Entrada de conteúdo

O aluno pode colar um texto, digitar uma matéria ou utilizar o microfone, quando o navegador oferecer suporte ao reconhecimento de voz.

Antes de gerar o material, é possível selecionar uma das seis áreas:

- Tecnologia;
- Administração;
- Economia;
- Matemática;
- Direito;
- Matérias escolares.

Também é possível escolher o nível básico, intermediário ou avançado, usado pela IA para adaptar suas explicações.

#### Resumos

Organizam o conteúdo em tópicos com os principais conceitos destacados.

O aluno pode selecionar quantos tópicos deseja visualizar, copiar o resumo, salvar o material ou acessar os flashcards relacionados.

#### Flashcards

Apresentam uma pergunta por cartão. Ao clicar, o aluno revela a resposta e pode marcar se acertou, errou ou deseja revisar depois.

As respostas registradas ajudam a acompanhar o desempenho por área.

#### Quizzes

Oferecem questões de múltipla escolha, verdadeiro ou falso e resposta curta.

Após cada resposta, o sistema apresenta uma explicação. Ao concluir, o aluno visualiza seu aproveitamento e pode refazer apenas as questões que errou.

As respostas curtas são corrigidas por comparação de texto, com normalização de maiúsculas e pontuação simples.

#### Dúvidas

Permitem conversar com o assistente para pedir explicações e exemplos sobre uma matéria ou sobre o conteúdo inserido.

Cada solicitação considera a pergunta, o texto atual, a área e o nível selecionado. A versão atual não mantém memória da conversa no servidor.

#### Desempenho

Apresenta os registros de estudo, incluindo:

- Percentual de acertos;
- Quantidade de flashcards revisados;
- Quantidade de questões respondidas;
- Sequência de dias com atividade;
- Evolução dos acertos;
- Áreas com mais erros e sugestões de revisão.

Os indicadores são calculados a partir das respostas registradas no aplicativo.

#### Biblioteca

Reúne os materiais salvos para consulta posterior. É possível buscar por palavra-chave, filtrar por área, abrir um material ou excluí-lo.

#### Tecnologias utilizadas

| Tecnologia | Função |
|---|---|
| React | Construção da interface e controle das interações |
| Vite | Ambiente de desenvolvimento e geração do frontend |
| CSS | Estilização e adaptação da interface a diferentes telas |
| Python | Implementação do backend |
| FastAPI | Criação das rotas de comunicação com o frontend |
| Pydantic | Validação dos dados recebidos e dos materiais gerados |
| Google Gemini API | Geração das explicações e dos materiais de estudo |
| localStorage | Armazenamento dos dados no navegador |

#### Como o sistema funciona

1. O aluno informa uma pergunta ou um conteúdo na interface React.
2. O frontend envia a solicitação ao backend FastAPI.
3. O backend lê a configuração privada e encaminha a solicitação ao Gemini.
4. A IA gera uma resposta conforme as instruções do tutor.
5. O backend valida os materiais estruturados antes de devolvê-los.
6. O frontend apresenta o resultado e permite estudar ou salvar o material.

Os materiais salvos, o perfil local e os registros de desempenho ficam no navegador. Eles não são armazenados em um banco de dados no servidor.

#### Estrutura do projeto

```text
cerebro/
├── backend/
│   ├── app/
│   │   ├── config.py       # Configurações e leitura do .env
│   │   ├── providers.py    # Comunicação com o provedor de IA
│   │   ├── models.py       # Validação dos dados
│   │   ├── prompts.py      # Instruções do assistente
│   │   ├── main.py         # Rotas da API
│   │   └── check.py        # Diagnóstico da integração
│   ├── tests/              # Testes com chamadas simuladas
│   └── requirements.txt   # Dependências do backend
├── frontend/
│   ├── src/                # Interface React e estilos
│   ├── public/             # Arquivos públicos
│   ├── package.json        # Dependências e comandos do frontend
│   └── vite.config.js      # Configuração do Vite e do proxy
├── docs/                   # Documentação de validação
├── .env.example            # Modelo de configuração sem credenciais
├── .gitignore
├── INICIAR-NO-VSCODE.md
└── README.md

#### Executar o projeto

As instruções de instalação e execução estão em [INICIAR-NO-VSCODE.md](INICIAR-NO-VSCODE.md).

É necessário configurar o arquivo `.env` na raiz do projeto e manter o backend e o frontend em execução em terminais separados.

A interface local fica disponível em [http://localhost:5173](http://localhost:5173).

#### Limitações atuais

- O perfil é local, sem autenticação real ou login com Google.
- Não há sincronização entre dispositivos.
- Limpar os dados do navegador pode apagar materiais e desempenho.
- O reconhecimento de voz depende do navegador e de suas permissões.
- A disponibilidade da IA depende da conexão, do modelo e da cota do provedor.
- A entrada estática da raiz é uma demonstração que organiza frases, sem consultar a IA.
- O backend precisa de autenticação e controle de chamadas antes de ser disponibilizado para acesso público amplo.

#### Segurança

Nunca publique o arquivo `.env` ou exemplos preenchidos com chaves reais. O arquivo `.env.example` deve conter apenas os nomes das variáveis e valores de exemplo sem credenciais.

As solicitações de estudo são enviadas ao provedor de IA quando a integração está ativa. Evite inserir dados pessoais ou informações confidenciais.