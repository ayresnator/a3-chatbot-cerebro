# Validação

## Revisão estática
O backend foi separado em configuração, modelos, instruções, transporte e rotas.
Gemini usa API nativa com x-goog-api-key.
config.py lê cerebro/.env por caminho absoluto, com suporte a UTF-8 BOM.
O arquivo .env.exemple não é carregado automaticamente e está ignorado pelo Git.
O frontend usa /api via proxy Vite e interpreta os erros estruturados do backend.

## Seleção de modelo
Adicionado AI_MODEL=auto para consultar o catálogo Gemini com paginação e filtrar generateContent. A seleção automática prefere Flash estável e não seleciona Pro ou versões experimentais. O catálogo não garante disponibilidade de geração nem cota. O diagnóstico --list-models lista nomes sem gerar conteúdo. Foram adicionados testes simulados de seleção, paginação, exclusão de modalidades incompatíveis e catálogo vazio; não executados neste ambiente.

## Verificação local necessária
Siga INICIAR-NO-VSCODE.md.
1. Crie .env na raiz, a partir do exemplo privado.
2. Instale as dependências e execute python -m app.check na pasta backend.
3. Execute os testes unitários documentados.
4. Inicie Python e Vite em terminais separados.
5. Confira chat, envio por Enter, Shift+Enter, resumo, quiz, flashcards e biblioteca.
6. Confirme que erros de credencial, cota, modelo e rede exibem códigos compreensíveis.

## Limite
Não foram executados testes, servidores, builds, navegador ou chamadas autenticadas no Web Sinart.
A chave apresentada no chat não foi usada para fazer requisições ao provedor.
A presença do arquivo de configuração não garante aceitação da chave, acesso ao modelo ou cota no projeto.
