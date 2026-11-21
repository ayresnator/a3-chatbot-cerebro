# O que falta para publicar o Cérebro

O Cérebro foi feito para uso local. Cada aluno do grupo roda o backend e o frontend no próprio computador, com a chave gratuita do Gemini. Este documento lista o que falta antes de abrir o app na internet para outras pessoas.

É um levantamento do grupo. As citações da LGPD não passaram por revisão jurídica, e este documento não afirma que o Cérebro cumpre a lei.

## O que já protege hoje

- Os dados do aluno ficam no navegador. Materiais, perfil, desempenho, caderno de erros, caixas dos cartões e rascunho ficam no `localStorage`. O backend não tem banco de dados e não guarda o texto do aluno.
- A chave fica só no backend. Ela viaja no cabeçalho `x-goog-api-key`, nunca na URL, e não aparece no log nem nas respostas. O backend não segue redirecionamento, então a chave não vai para outro endereço.
- O log anota o campo e o motivo de cada recusa, nunca o texto recebido nem o gerado. Os testes de `backend/tests/test_privacidade.py` conferem isso.
- A entrada é conferida antes de gastar cota. Campo grande demais ou vazio, área ou nível fora da lista e corpo que não é JSON voltam com erro 422, sem chamar a IA.
- Antes dos botões de gerar, a página Estudar avisa: "Seu texto é enviado ao Google Gemini para gerar o material. Não cole dados pessoais."

A [issue #75](https://github.com/ayresnator/a3-chatbot-cerebro/issues/75) traz mais quatro proteções: o Cancelar passa a parar o pedido também no backend, cada pedido ganha um teto de chamadas e de tempo, os caracteres invisíveis do texto colado saem antes de chegar à IA, e o backend passa a recusar um cabeçalho Host desconhecido (DNS rebinding).

## Decisões do grupo

### Quem pode usar

Os termos adicionais da Gemini API, em vigor desde 23/03/2026, exigem 18 anos ou mais de quem usa a API. Eles também proíbem oferecer um serviço voltado a menores de 18 anos ou que provavelmente será usado por eles. A área Escolar atrai estudantes menores de idade.

O grupo precisa escolher um caminho:

- abrir só para maiores de 18 anos, com essa regra no cadastro, e rever a área Escolar; ou
- trocar o Gemini por outro provedor de IA, cujos termos aceitem menores com o consentimento dos pais.

Com menores de idade, a LGPD pede que o tratamento dos dados atenda ao melhor interesse da criança e do adolescente (art. 14). Para crianças, ela exige o consentimento específico e em destaque de pelo menos um dos pais ou do responsável legal (art. 14, § 1º), e as informações precisam ser simples, claras e acessíveis (art. 14, § 6º).

### Plano do Gemini

Na faixa gratuita, o Google usa o que é enviado e as respostas para melhorar os produtos dele, e revisores humanos podem ler esse conteúdo. Os termos pedem que não se envie informação sensível, confidencial ou pessoal. Num app aberto, o grupo não controla o que cada pessoa cola.

No plano pago, o Google não usa os pedidos nem as respostas para melhorar os produtos dele. Ele os guarda por um tempo limitado, só para detectar abuso, manter a segurança e cumprir exigências legais. A Gemini API conta como paga quando a chave é de um projeto do Google Cloud com faturamento ativo.

Para o público, o plano tem de ser o pago. Falta decidir quem paga e qual o gasto máximo por mês.

### Aviso de privacidade

A LGPD dá a quem usa o app o direito de saber, de forma clara, a finalidade do tratamento, a forma e a duração, quem é o controlador e como falar com ele, com quem os dados são compartilhados, as responsabilidades de quem trata os dados e os direitos do titular (art. 9). O aviso do Cérebro precisa dizer pelo menos:

- quem controla os dados (o grupo ou a instituição) e um contato;
- para que eles servem: gerar o material, responder no chat e revisar respostas;
- que o texto vai para o Google, fora do Brasil. É uma transferência internacional de dados (art. 33), e ela precisa se apoiar numa das hipóteses do artigo, como cláusulas-padrão contratuais (inciso II) ou o consentimento específico e em destaque de quem usa, depois de avisado de que os dados vão para fora do país (inciso VIII);
- por quanto tempo os logs ficam guardados e o que eles registram. Hoje os logs só aparecem no terminal do backend, e uma hospedagem costuma guardar essa saída.

## Tarefas técnicas

Hoje qualquer pessoa que alcance o backend usa a chave e a cota do grupo. Antes de abrir o app:

1. HTTPS na porta de entrada. Um proxy reverso (o da hospedagem, Caddy ou nginx) fica na frente do uvicorn. Sem HTTPS, o texto do aluno e o login viajam abertos pela rede.
2. Limite de tamanho do corpo na mesma porta de entrada, como 512 KB. Hoje um corpo de 50 MB é lido inteiro antes do erro. O limite não pode ser muito menor: um chat válido pode passar de 256 KB, porque são até 64 mil caracteres e um emoji ocupa 4 bytes.
3. Limite de pedidos por endereço IP. Sem ele, um script repete pedidos até a cota acabar.
4. Login e teto de chamadas por pessoa por dia. Hoje nada separa uma pessoa da outra. O login pode ser por link no e-mail ou pela conta da instituição, e a conta de cada pessoa cabe num armazenamento pequeno, como SQLite ou Redis. O `AI_DAILY_LIMIT`, da [issue #88](https://github.com/ayresnator/a3-chatbot-cerebro/issues/88), já põe um teto por dia no backend inteiro: é um primeiro passo, mas não separa as pessoas.
5. Limite de chamadas simultâneas ao Gemini. Hoje, com 45 pedidos ao mesmo tempo, 40 chegam juntos ao provedor: esse 40 é só o número de threads do servidor. Um semáforo deixa passar poucas chamadas por vez e pede ao resto que tente de novo, em vez de estourar o limite por minuto de todo mundo.
6. Mensagens de erro neutras. Hoje elas citam `.env`, `AI_MODEL` e `python -m app.check`, que são instruções para quem instala. A [issue #66](https://github.com/ayresnator/a3-chatbot-cerebro/issues/66) põe uma frase simples na tela e guarda a do backend em "Detalhes técnicos". Para o público, a resposta da API também precisa ser neutra, com o detalhe só no log.
7. `/docs`, `/redoc` e `/openapi.json` fechados. Hoje eles mostram a qualquer um todas as rotas e campos da API. Fora do computador local, o `FastAPI(...)` de `backend/app/main.py` recebe `docs_url=None`, `redoc_url=None` e `openapi_url=None`.
8. Histórico do chat conferido. Hoje o navegador manda até 6 mensagens marcadas como da IA, e cada pergunta leva até 64 mil caracteres ao Gemini. Quem escreve essas mensagens conduz o modelo: na internet, o Cérebro viraria um Gemini de uso livre com a chave do grupo. O backend precisa conferir que as mensagens da IA saíram dele, por exemplo com uma assinatura, ou cortar bem o histórico.
9. Chave e endereços na hospedagem. A chave do plano pago vai numa variável de ambiente da hospedagem, e não num `.env` copiado: `backend/app/config.py` já dá prioridade à variável. `ALLOWED_ORIGINS`, e o `ALLOWED_HOSTS` da issue #75, recebem o endereço público do app.

## O modo estudo, sem IA

Este documento trata do app com IA. O modo estudo do celular (README, "Estudar no celular") é publicado à parte, pelo fluxo `.github/workflows/publicar.yml`, e não depende das tarefas acima: ele não tem backend nem chave, não chama a IA e não manda a servidor o que o aluno faz. O endereço é público: qualquer pessoa com o link abre o app, e o GitHub vê o endereço IP de quem abre. Ativar o GitHub Pages e disparar o fluxo são decisões do dono do repositório.

## Fontes

- Termos adicionais da Gemini API (Gemini API Additional Terms of Service), em vigor desde 23/03/2026, consultados em 20/11/2026: <https://aistudio.google.com/docs/terms>. Valem aqui as partes sobre idade e sobre os serviços gratuitos (Unpaid Services) e pagos (Paid Services).
- Lei nº 13.709/2018, a Lei Geral de Proteção de Dados (LGPD), artigos 9, 14 e 33: <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>. As citações são leitura do grupo, sem revisão jurídica.
