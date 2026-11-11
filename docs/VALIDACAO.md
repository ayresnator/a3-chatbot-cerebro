# Validação

## Revisão estática
O backend foi separado em configuração, modelos, instruções, transporte e rotas.
Gemini usa API nativa com x-goog-api-key.
config.py lê cerebro/.env por caminho absoluto, com suporte a UTF-8 BOM.
O arquivo .env está ignorado pelo Git; .env.example é o modelo público, sem chave.
O frontend usa /api via proxy Vite e interpreta os erros estruturados do backend.

## Seleção de modelo
Adicionado AI_MODEL=auto para consultar o catálogo Gemini com paginação e filtrar generateContent. A seleção automática prefere Flash estável e não seleciona Pro ou versões experimentais. O catálogo não garante disponibilidade de geração nem cota. O diagnóstico --list-models lista nomes sem gerar conteúdo. Foram adicionados testes simulados de seleção, paginação, exclusão de modalidades incompatíveis e catálogo vazio.

## Verificação local necessária
Siga INICIAR-NO-VSCODE.md.
1. Crie .env na raiz, a partir de .env.example, e preencha GEMINI_API_KEY.
2. Instale as dependências e execute python -m app.check na pasta backend.
3. Execute os testes unitários documentados.
4. Inicie Python e Vite em terminais separados.
5. Confira chat, envio por Enter, Shift+Enter, resumo, quiz, flashcards e biblioteca.
6. Confirme que erros de credencial, cota, modelo e rede exibem códigos compreensíveis.

## Validação executada em 10/11/2026
Ambiente: Windows 11, Python 3.13, Node 24, modelo gemini-3.5-flash-lite (chave gratuita).
- Testes unitários: 21 de 21 passam (python -m unittest discover -s tests -v).
- Geração real em /api/generate, 6 áreas × 3 níveis: 17 de 18 concluídas. A única falha foi um tempo esgotado de 90 s do provedor.
- Textos longos (8 mil, 12 mil e 20 mil caracteres): 3 de 3 concluídos, entre 5 e 19 segundos.
- Navegador: resumo, flashcards, quiz, biblioteca, desempenho, perfil e chat conferidos. A entrada por voz não foi testada.
- npm audit no frontend: 0 vulnerabilidades (Vite 6.4.6).

## O que os testes reais mostraram
- Antes das correções, 4 de 7 respostas reais da geração eram recusadas: JSON inválido (2), índice da resposta como texto (1) e resposta interrompida (1). Quase metade das chamadas recebia 503 do provedor, sem nova tentativa.
- /api/generate agora envia ao Gemini o esquema da resposta (responseJsonSchema). O material chega com JSON válido e tipos certos.
- Com o esquema, 4 de 23 materiais vieram sem nenhum acento. Com uma regra de acentuação no prompt foram 0 de 10. Se ainda acontecer, o backend pede o material mais uma vez.
- O chat fica sem esquema de propósito: com ele, 6 de 7 respostas vieram sem quebras de linha. Sem esquema, 1 resposta em cerca de 20 veio com JSON quebrado; nesse caso o backend tenta mais uma vez.
- Erro 503 do provedor: até duas novas tentativas automáticas, com espera de 3 e 6 segundos.

## Ajustes depois da validação (10/11/2026)
- Chat com memória curta: o navegador envia as últimas 6 mensagens em cada pergunta e o servidor continua sem guardar conversa. Depois de uma explicação de fotossíntese, a pergunta "Me dê um exemplo do dia a dia" foi respondida sobre fotossíntese em 4 de 4 tentativas com a API real (3 direto no backend, 1 pela tela). Sem o histórico, a resposta falou de troco na padaria. A primeira redação da instrução não bastou: o modelo ignorou o histórico e respondeu sobre a área selecionada.
- Alternativas embaralhadas no backend. Em 400 respostas simuladas, a certa caiu 96 vezes em A, 109 em B, 94 em C e 101 em D. Com o aviso no prompt, o próprio modelo passou a mandar a certa em A (11 de 19 questões); o embaralhamento cobre os dois casos.
- Resposta curta aceita formas equivalentes separadas por "|". Exemplos que o modelo gerou: "Selic|Taxa Selic" e "Tupla|Registro".
- Tempo limite por chamada: 45 segundos, com uma segunda tentativa. Só tem teste simulado; não deu para provocar um travamento real.
- Sugestão de revisão: o material com mais erros nos últimos 7 dias. Conferida no navegador com eventos de teste.
- Geração real depois dos ajustes: 13 de 14, entre 4 e 15 segundos. A falha foi um material recusado (índice da resposta fora das opções). Por causa dela o backend agora pede o material de novo antes de devolver erro; essa segunda tentativa só tem teste simulado.
- Testes unitários: 24 de 24.

## Limite
A qualidade do conteúdo depende do modelo. Nos 17 materiais conferidos apareceu uma resposta curta errada ("Exportações" para a diferença entre exportações e importações). A alternativa correta ficava na posição B ou C em 36 de 45 questões de múltipla escolha; por isso o backend passou a embaralhar as alternativas.
A presença do arquivo de configuração não garante aceitação da chave, acesso ao modelo ou cota no projeto.
