# Roteiro da apresentação

Demonstração de 10 minutos em quatro blocos, um por integrante, mais as perguntas. Os quatro blocos fazem 5 pedidos à IA. O gasto da cota é maior: o `app.check` faz 1 chamada antes de começar, e cada nova tentativa automática do backend também conta. Com `AI_MODEL=auto`, o `app.check` e o primeiro pedido do backend fazem ainda uma consulta ao catálogo de modelos.

## Na véspera

1. Rode o projeto do zero em um computador do grupo, seguindo o [INICIAR-NO-VSCODE.md](../INICIAR-NO-VSCODE.md).
2. Gere dois ou três materiais com a IA, responda os quizzes (erre algumas questões de propósito) e salve os materiais.
3. Na Biblioteca, clique em "Exportar". O arquivo `cerebro-backup-AAAA-MM-DD.json` é o plano B: leva a biblioteca, o desempenho e o caderno de erros para qualquer navegador.
4. Copie o arquivo para o computador da apresentação e para um pen drive.
5. Não rode a rodada de avaliação (`.\.venv\Scripts\python.exe -m app.avalia --rodar`) no dia da apresentação nem na véspera à noite: ela usa a mesma cota da chave.

## Dez minutos antes

1. Abra os dois terminais (backend e frontend) e o endereço http://localhost:5173. Use sempre `localhost`: os dados ficam guardados por endereço.
2. Confira o cabeçalho: tem de aparecer "IA ativa", o nome do modelo e as chamadas do dia. "IA não configurada" é chave faltando no `.env`. "Backend desligado" é o terminal do Python parado.
3. Em um terceiro terminal, na pasta `backend`, rode `.\.venv\Scripts\python.exe -m app.check` uma vez. Ele faz uma chamada real e mostra se a chave e a cota respondem.
4. Na Biblioteca, clique em "Importar" e escolha o arquivo da véspera. O Desempenho e o caderno de erros já aparecem com dados.
5. Aumente o zoom do navegador para 125% (Ctrl e +) se for usar projetor. Se o menu da esquerda virar uma barra embaixo, a janela ficou estreita para esse zoom: diminua o zoom até o menu voltar.
6. Deixe abertos em outras abas o [docs/IA.md](IA.md), o [VALIDACAO.md](VALIDACAO.md) na tabela da rodada de 17/11 e a página Actions do repositório no GitHub, com os testes passando.

## Bloco 1: gerar o material (2 minutos, 2 pedidos à IA)

1. Diga em uma frase o que é o Cérebro: transforma um texto em resumo, flashcards e quiz, e mostra onde o aluno erra.
2. Na página Estudar, escolha a área e o nível e clique em "Usar um exemplo". A IA escreve um texto curto sobre um tema sorteado da área, e o aviso no pé da tela diz o tema. Se ele disser que a IA não respondeu, entrou um exemplo pronto da área: siga com ele. Mostre o aviso embaixo do editor: o texto vai para o Google Gemini.
3. Clique em "Resumir".
4. No resumo, mostre um tópico com "No seu texto: ...". Se algum tópico ficou sem trecho, ele traz a etiqueta "Explicação da IA: confira"; ela pode não aparecer, porque na rodada de 17/11 os 64 tópicos vieram com trecho. Explique: quem confere o trecho é o backend, com código. O modelo pode inventar um trecho, e o trecho inventado não aparece.

## Bloco 2: estudar com o material (3 minutos, 2 pedidos à IA)

1. Flashcards: vire um cartão e clique em "Errei". Mostre que a fila cresceu: o cartão volta até ser acertado.
2. Quiz: erre a primeira questão de propósito. Mostre a opção certa marcada com "✓ certa", a sua com "✗ sua resposta" e a explicação.
3. Clique em "Não entendi, me explique". A resposta aparece ali mesmo, sem trocar de página.
4. Na questão de resposta curta, digite a resposta certa com um erro pequeno de digitação, como uma letra trocada. A comparação de texto marca como errada. Clique em "Pedir revisão da IA" e mostre o veredito. Não use a sigla, o plural ou um sinônimo: o modelo costuma pôr essas formas no gabarito, a tela aceita a resposta e o botão de revisão não aparece.
5. Termine o quiz e mostre a lista das questões erradas.
6. Abra a página Erros: as questões erradas estão no caderno. Diga a regra: a questão sai sozinha quando é acertada em outro dia. O aluno também pode tirar no botão "Tirar do caderno", e a questão que a revisão da IA aceita sai na hora.

## Bloco 3: dúvidas e desempenho (2 minutos, 1 pedido à IA)

1. Em Dúvidas, pergunte algo sobre o tema do exemplo que o texto não responde, como a origem do assunto ou quem o estudou primeiro. A instrução manda o Cérebro avisar quando a resposta não está no texto.
2. Mostre as sugestões de perguntas, que mudam a cada resposta.
3. Em Desempenho, explique o número de acerto: conta só a primeira resposta de cada questão no dia. Refazer a mesma questão não melhora o número. A autoavaliação dos flashcards fica separada.
4. Mostre "Seu próximo passo", com o material de maior taxa de erro, e o botão "Refazer meus erros".

## Bloco 4: como a IA é controlada (3 minutos, sem pedidos à IA)

Abra o [docs/IA.md](IA.md) e passe pelos pontos:

1. A IA entra em quatro lugares: gerar o material, tirar dúvidas, revisar resposta curta e escrever o texto do "Usar um exemplo". O resto é código comum.
2. Saída estruturada: o backend manda o esquema JSON da resposta. Antes disso, 4 de 7 respostas reais eram recusadas.
3. O backend não aceita a resposta sem conferir: valida cada item, descarta a questão com gabarito fora das opções, embaralha as alternativas e confere o trecho de origem.
4. Ordem escondida no texto do aluno: mostre a linha da palavra-canário na tabela da rodada de avaliação, em [VALIDACAO.md](VALIDACAO.md).
5. Custo: uma chamada por pedido no caso normal, novas tentativas com teto, e o contador no cabeçalho.
6. Testes: mostre a aba Actions com os testes do backend e do frontend passando.
7. Feche com os limites: o conteúdo pode estar errado, a revisão da IA também, e nada disso tem checagem automática de fatos.

## Se algo der errado

| O que aparece | O que fazer |
|---|---|
| "Limite de chamadas por minuto atingido" (`AI_RATE_LIMITED`) | A mensagem diz quantos segundos esperar. Siga falando e tente de novo. |
| "O serviço de IA está temporariamente indisponível" (`AI_PROVIDER_UNAVAILABLE`) | É erro do lado do Gemini. Tente de novo uma vez. Se repetir, abra um material importado na Biblioteca. |
| `AI_QUOTA_EXCEEDED` ou falta de internet | Abra um material importado na Biblioteca. Resumo, flashcards, quiz, caderno de erros e desempenho funcionam sem IA. |
| "Backend desligado" no cabeçalho | Olhe o terminal do Python. Se ele caiu, suba de novo com o comando do guia e recarregue a página: o cabeçalho só confere o backend quando a página abre e no fim de cada pedido à IA. |
| Nada da IA responde | Abra http://localhost:5173/?demo. A demonstração monta resumo, flashcards e quiz a partir das frases do texto, sem IA. Ela não mostra o que depende da IA: as respostas da página Dúvidas (lá vem um aviso fixo), os chips de sugestão do chat, os botões "Não entendi, me explique" e "Pedir revisão da IA" e o trecho "No seu texto". Diga que é a demonstração. |
| A tela ficou estranha | Recarregue a página. O texto do editor, o material aberto e a conversa voltam. |

Os outros códigos de erro estão explicados na seção "Diagnóstico" do [INICIAR-NO-VSCODE.md](../INICIAR-NO-VSCODE.md).

## Perguntas prováveis

**Onde está a inteligência artificial do trabalho?** Em quatro rotas do backend: gerar o material, responder dúvidas, revisar resposta curta e escrever um exemplo de estudo. O modelo é o Gemini, chamado pela API. O trabalho do grupo está em volta dele: as instruções, o formato da resposta, a validação de cada item e a medição.

**Como vocês evitam que a IA invente?** Não evitamos por completo. Reduzimos e deixamos visível: o trecho de origem é conferido por código, o tópico que fica sem trecho ao lado de outros com trecho ganha a etiqueta "Explicação da IA: confira", o chat é instruído a avisar quando a resposta não está no texto, e a tela avisa que o conteúdo pode ter erros.

**E se o aluno colar "ignore as instruções" no texto?** O texto do aluno vai separado das instruções, como dado. O formato da resposta é garantido por código. Se o modelo obedece ou não à ordem escondida, a rodada de avaliação mede com uma palavra-canário. Na rodada de 17/11 ele ignorou a ordem no chat e em uma geração, e obedeceu em outra: os 6 flashcards vieram com a palavra como resposta.

**Por que esse modelo?** É gratuito, aceita esquema JSON na resposta e, nos testes de 10/11, gerou 13 de 14 materiais em 4 a 15 segundos (até 19 com textos longos). Com `AI_MODEL=auto` o backend escolhe o Flash estável mais novo.

**Como sabem que funciona?** Pelos testes automáticos com o provedor simulado, pela rodada de avaliação com chamadas reais e pela conferência manual de materiais gerados. Os números estão em [VALIDACAO.md](VALIDACAO.md).

**Quais dados vocês guardam?** Nenhum no servidor. Biblioteca, desempenho e caderno de erros ficam no navegador do aluno. O que vai para o Google é o texto do editor, as perguntas, o título e o resumo do material aberto nas perguntas sobre ele e as respostas enviadas para revisão.

**O que falta?** Login de verdade, sincronização entre aparelhos e checagem de fatos do conteúdo gerado.
