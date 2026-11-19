# Instruções para agentes

Este arquivo vale para qualquer agente de IA que trabalhe neste repositório (Claude, Codex, Copilot, Cursor, Gemini ou outro) e para as pessoas do grupo. O `CLAUDE.md` e o `GEMINI.md` só importam este arquivo: para mudar uma regra, mude aqui.

## Toda tarefa começa numa issue

Tarefa é qualquer mudança no projeto: uma correção, uma melhoria ou uma nova função.

1. Antes de alterar qualquer arquivo, abra uma issue no GitHub em `ayresnator/a3-chatbot-cerebro`. Se já existe uma issue aberta para a mesma tarefa, use essa.
2. Marque a issue com um destes rótulos:
   - `correção`: algo funciona errado;
   - `melhoria`: algo que já funciona vai ficar melhor (código, texto, visual, testes ou documentação);
   - `nova função`: algo que o projeto ainda não faz.
3. Na descrição, diga o que acontece hoje, o que deve acontecer e como conferir que ficou pronto.

Uma issue para cada tarefa. Se outra tarefa aparecer no meio do trabalho, abra outra issue em vez de juntar as duas.

Se o agente não tem acesso ao GitHub, ele escreve o texto da issue e pede para alguém do grupo criá-la antes de começar.

## O trabalho entra em `main` por pull request

`main` guarda a versão entregue do projeto. O merge de um PR em `main` é o deploy, por isso nenhuma mudança vai para `main` sem PR.

1. Crie uma branch a partir da `main` atualizada. O nome leva o rótulo e o número da issue: `correcao/12-resposta-vazia`, `melhoria/9-textos-do-chat`, `nova-funcao/15-modo-quiz`.
2. Faça os commits nessa branch. A mensagem segue o padrão do grupo, em português: `tipo: descrição`, com `fix`, `feat`, `docs`, `test`, `refactor` ou `chore`.
3. Abra o PR para `main`. A descrição precisa citar a issue:
   - `Closes #12` quando o PR resolve a issue inteira (o GitHub fecha a issue no merge);
   - `Refs #12` quando o PR resolve só uma parte.
4. Na descrição do PR, diga também o que mudou e como foi testado.
5. O agente não faz o merge por conta própria. O merge acontece quando alguém do grupo pede.

Ao terminar, o agente responde com o link da issue e o link do PR.
