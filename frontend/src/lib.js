// Lógica pura do Cérebro: sem React e sem tela, para o Node conferir em tests/lib.test.js.

export const AREAS = ['Tecnologia', 'Administração', 'Economia', 'Matemática', 'Direito', 'Escolar'];
export const LEVELS = ['Básico', 'Intermediário', 'Avançado'];
// A nota de cada nível no menu do editor: o que muda no vocabulário e na profundidade (backend, prompts.py).
export const LEVEL_NOTES = {
  Básico: 'Linguagem simples, sem jargão',
  Intermediário: 'Um pouco mais de detalhe',
  Avançado: 'Com os termos técnicos da área',
};
// Limite do texto do editor, o mesmo do backend.
const MAX_INPUT = 20000;
// Perguntas de partida de cada área: aparecem como sugestão no chat antes da primeira resposta, sem chamar a IA.
export const STARTERS = {
  Tecnologia: ['O que são hardware e software?', 'Como a internet funciona?'],
  Administração: ['O que faz um administrador?', 'O que é fluxo de caixa?'],
  Economia: ['O que é inflação?', 'Como funcionam oferta e demanda?'],
  Matemática: ['Como calcular porcentagem?', 'Como resolver uma equação do 1º grau?'],
  Direito: ['O que é a Constituição Federal?', 'O que são direitos fundamentais?'],
  Escolar: ['Como estudar melhor para uma prova?', 'Como fazer um bom resumo?'],
};
export const EXAMPLE = 'A fotossíntese é o processo pelo qual plantas transformam energia luminosa em energia química. A clorofila absorve a luz solar nos cloroplastos. Na fase clara, a água é decomposta, liberando oxigênio e produzindo ATP e NADPH. No ciclo de Calvin, o gás carbônico é fixado para produzir açúcares. Esse processo sustenta as cadeias alimentares e ajuda a regular o carbono na atmosfera.';
// Exemplos prontos do "Usar um exemplo", por área: entram na demonstração, com a IA desligada ou quando ela não
// responde. Cada texto tem de 5 a 8 frases e nenhum ponto no meio delas (abreviação, número com ponto): na
// demonstração cada frase vira um tópico do material (demo).
export const EXAMPLES = {
  Tecnologia: [
    {
      topic: 'Algoritmos',
      text: 'Um algoritmo é uma sequência finita de passos bem definidos para resolver um problema ou realizar uma tarefa. Uma receita de bolo é um bom exemplo do dia a dia, porque indica os ingredientes, a ordem das etapas e o resultado esperado. Na computação, os algoritmos são escritos em linguagens de programação para que o computador possa executá-los. Todo algoritmo recebe dados de entrada, processa esses dados e produz uma saída. As estruturas básicas de um algoritmo são a sequência, a decisão e a repetição. Um bom algoritmo é correto, termina depois de um número finito de passos e usa bem o tempo e a memória.',
    },
    {
      topic: 'Funcionamento da internet',
      text: 'A internet é uma rede mundial que interliga milhões de redes menores, de residências, empresas, universidades e governos. As informações viajam divididas em pequenos blocos chamados pacotes, que podem seguir caminhos diferentes até o destino. O conjunto de protocolos TCP/IP define como esses pacotes são endereçados, transmitidos e remontados na ordem certa. Cada dispositivo conectado recebe um endereço IP, que funciona como o endereço de uma casa. O DNS traduz os nomes dos sites digitados no navegador para os endereços IP correspondentes. Os roteadores decidem por onde cada pacote segue, de rede em rede, até chegar ao destino.',
    },
    {
      topic: 'Bancos de dados relacionais',
      text: 'Um banco de dados é um conjunto organizado de informações, guardado de forma que possa ser consultado e atualizado com facilidade. No modelo relacional, os dados ficam em tabelas formadas por linhas e colunas. Cada linha representa um registro, como um cliente, e cada coluna representa um atributo, como o nome ou o telefone. A chave primária identifica cada registro de forma única, e a chave estrangeira liga uma tabela a outra. A linguagem SQL é usada para criar tabelas, inserir dados e fazer consultas. O sistema gerenciador de banco de dados controla o acesso, a segurança e a integridade das informações.',
    },
  ],
  Administração: [
    {
      topic: 'Funções da administração',
      text: 'As quatro funções clássicas da administração são planejar, organizar, dirigir e controlar. Planejar é definir objetivos e decidir com antecedência o que deve ser feito para alcançá-los. Organizar é distribuir tarefas, pessoas e recursos para que o trabalho aconteça de forma coordenada. Dirigir envolve liderar, motivar e comunicar, orientando as pessoas para os objetivos definidos. Controlar é comparar os resultados obtidos com o que foi planejado e corrigir os desvios. Essas funções formam um ciclo contínuo, porque o controle gera informações que alimentam um novo planejamento.',
    },
    {
      topic: 'Planejamento estratégico',
      text: 'O planejamento estratégico define aonde uma organização quer chegar e como pretende chegar lá. Ele parte da missão, que explica por que a organização existe, e da visão, que descreve o futuro desejado. A análise SWOT ajuda nesse diagnóstico ao reunir as forças e as fraquezas internas e as oportunidades e as ameaças do ambiente externo. Com base nela, a empresa estabelece objetivos e metas que possam ser medidos. Depois, escolhe as estratégias e os planos de ação para alcançá-los. O acompanhamento por meio de indicadores permite corrigir o rumo quando os resultados não saem como o previsto.',
    },
    {
      topic: 'Fluxo de caixa',
      text: 'O fluxo de caixa é o registro de todas as entradas e saídas de dinheiro de uma empresa em determinado período. As entradas incluem as vendas recebidas, os empréstimos obtidos e outros recursos que chegam ao caixa. As saídas reúnem os pagamentos a fornecedores, os salários, os impostos e as demais despesas. Quando as entradas superam as saídas, o saldo é positivo, e a empresa tem folga para investir ou formar reservas. Quando as saídas são maiores, o saldo fica negativo, e pode ser preciso renegociar prazos ou buscar crédito. Acompanhar o fluxo de caixa ajuda o gestor a prever a falta de dinheiro antes que ela aconteça.',
    },
  ],
  Economia: [
    {
      topic: 'Inflação',
      text: 'Inflação é o aumento contínuo e generalizado dos preços de bens e serviços em uma economia. Quando ela acontece, o dinheiro perde poder de compra, e a mesma quantia passa a comprar menos coisas. Entre as causas mais comuns estão a demanda maior que a oferta e o aumento dos custos de produção. No Brasil, o índice oficial de inflação é o IPCA, calculado pelo IBGE. Para conter a alta dos preços, o Banco Central pode elevar a Selic, a taxa básica de juros, o que encarece o crédito e reduz o consumo. A inflação alta e instável dificulta o planejamento das famílias e das empresas.',
    },
    {
      topic: 'Oferta e demanda',
      text: 'A lei da oferta e da demanda explica como os preços se formam em um mercado. A demanda é a quantidade de um bem que os consumidores desejam comprar a cada preço, e a quantidade demandada costuma cair quando o preço sobe. A oferta é a quantidade que os produtores desejam vender, e a quantidade ofertada costuma aumentar quando o preço sobe. O ponto em que a quantidade demandada é igual à quantidade ofertada é chamado de equilíbrio de mercado. Se o preço fica acima do equilíbrio, sobram produtos, e há pressão para que ele caia. Se fica abaixo, falta produto, e o preço tende a subir.',
    },
    {
      topic: 'Produto Interno Bruto',
      text: 'O Produto Interno Bruto, ou PIB, é a soma de todos os bens e serviços finais produzidos em um país durante um período. Ele é o principal indicador do tamanho e do ritmo de uma economia. Só entram os bens e serviços finais, para que o mesmo valor não seja contado duas vezes ao longo da cadeia produtiva. O PIB pode ser medido pela ótica da produção, da renda ou da despesa, e as três devem chegar ao mesmo resultado. Quando o PIB cresce, em geral há mais produção, emprego e renda. O PIB per capita divide esse total pelo número de habitantes e dá uma ideia da renda média da população.',
    },
  ],
  Matemática: [
    {
      topic: 'Porcentagem',
      text: 'Porcentagem é uma razão com denominador 100, e o símbolo % significa por cento. Dizer que 20% dos alunos faltaram é o mesmo que dizer que 20 em cada 100 alunos faltaram. Para calcular a porcentagem de um valor, multiplica-se o valor pela taxa e divide-se o resultado por 100. Assim, 20% de 50 é igual a 10. Um aumento de 10% sobre 200 leva o valor a 220, e um desconto de 10% sobre 200 leva o valor a 180. Porcentagens aparecem no dia a dia em descontos, juros, impostos e pesquisas.',
    },
    {
      topic: 'Equações do primeiro grau',
      text: 'Uma equação do 1º grau tem uma incógnita com expoente 1, como em 2x + 3 = 11. Resolver a equação é encontrar o valor da incógnita que torna a igualdade verdadeira. Para isso, deixamos os termos com x de um lado e os números do outro, sempre fazendo a mesma operação nos dois membros. No exemplo, subtraímos 3 dos dois lados e obtemos 2x = 8. Em seguida, dividimos os dois lados por 2 e chegamos a x = 4. Para conferir, basta trocar x por 4 na equação original e ver que 2 vezes 4 mais 3 dá 11.',
    },
    {
      topic: 'Teorema de Pitágoras',
      text: 'O teorema de Pitágoras vale para todo triângulo retângulo, isto é, todo triângulo que tem um ângulo de 90 graus. O lado oposto ao ângulo reto é a hipotenusa, e os outros dois lados são os catetos. O teorema afirma que o quadrado da hipotenusa é igual à soma dos quadrados dos catetos. Em símbolos, a² = b² + c², em que a é a hipotenusa e b e c são os catetos. Em um triângulo com catetos 3 e 4, a hipotenusa mede 5, porque 9 mais 16 é igual a 25. O teorema é usado para calcular distâncias, alturas e diagonais, como a diagonal de uma tela ou de um terreno.',
    },
  ],
  Direito: [
    {
      topic: 'Constituição Federal',
      text: 'A Constituição Federal é a lei máxima do Brasil, e nenhuma outra norma pode contrariá-la. Ela organiza o Estado, divide o poder entre o Executivo, o Legislativo e o Judiciário e estabelece os direitos e as garantias fundamentais. A Constituição em vigor foi promulgada em 1988 e ficou conhecida como Constituição Cidadã, por ampliar os direitos sociais e políticos. O texto pode ser alterado por emendas constitucionais, que passam por uma aprovação mais difícil que a das leis comuns. Algumas matérias, as cláusulas pétreas, não podem ser abolidas nem por emenda, como o voto direto, secreto, universal e periódico. O Supremo Tribunal Federal é o órgão responsável por guardar a Constituição.',
    },
    {
      topic: 'Direitos fundamentais',
      text: 'Direitos fundamentais são os direitos básicos que a Constituição assegura para proteger a dignidade das pessoas. No Brasil, boa parte deles está no artigo 5º da Constituição Federal, que trata dos direitos e deveres individuais e coletivos. Entre eles estão o direito à vida, à liberdade, à igualdade, à segurança e à propriedade. A Constituição também prevê direitos sociais, como a educação, a saúde, o trabalho, a moradia e o lazer. Esses direitos limitam o poder do Estado e servem de base para as demais leis. Quem tem um direito fundamental violado pode buscar proteção no Poder Judiciário, por exemplo por meio do habeas corpus ou do mandado de segurança.',
    },
    {
      topic: 'Contratos',
      text: 'Contrato é um acordo de vontades entre duas ou mais partes que cria, modifica ou extingue direitos e obrigações. Para ser válido, ele exige agentes capazes, objeto lícito, possível e determinado ou determinável, e forma prescrita ou não proibida por lei. Os contratos seguem o princípio da autonomia da vontade, segundo o qual as partes são livres para negociar as condições. Também vale a regra de que o contrato faz lei entre as partes, isto é, o que foi combinado deve ser cumprido. A boa-fé objetiva exige que as partes ajam com lealdade e honestidade antes, durante e depois do contrato. Quem descumpre o contrato pode ter de pagar perdas e danos à outra parte.',
    },
  ],
  Escolar: [
    { topic: 'Fotossíntese', text: EXAMPLE },
    {
      topic: 'Ciclo da água',
      text: 'O ciclo da água é o caminho que a água percorre entre a superfície da Terra e a atmosfera. Com o calor do Sol, a água de rios, lagos e oceanos evapora e sobe na forma de vapor. As plantas também liberam vapor de água pela transpiração. Ao subir, o vapor esfria e se condensa em gotículas, que formam as nuvens. Quando as gotículas se juntam e ficam pesadas, caem como chuva, neve ou granizo, o que se chama precipitação. Parte dessa água escoa para rios e mares, e outra parte se infiltra no solo e abastece os lençóis freáticos.',
    },
    {
      topic: 'Independência do Brasil',
      text: 'A Independência do Brasil marcou a separação política entre o Brasil e Portugal. Em 1808, a família real portuguesa veio para o Brasil, fugindo das tropas de Napoleão, e o Rio de Janeiro passou a ser a sede do governo. Com a volta de Dom João VI a Portugal, as Cortes portuguesas tentaram reduzir a autonomia que o Brasil havia conquistado. Dom Pedro, que ficou no Brasil como príncipe regente, resistiu a essas pressões. Em 7 de setembro de 1822, às margens do riacho do Ipiranga, ele proclamou a independência. Pouco depois, foi aclamado e coroado imperador, com o título de Dom Pedro I.',
    },
  ],
};

// Sorteia um exemplo pronto da área (random devolve de 0 a 1, como Math.random; os testes passam o deles). Nunca é o
// que está no editor (current: { topic, text }), nem pelo texto nem pelo tema: dois cliques seguidos não repetem, e o
// tema que a IA acabou de escrever não volta como exemplo pronto. Área fora da lista vale Escolar.
export function pickExample(area, current, random = Math.random) {
  const topic = t => fold(t ?? '').trim();
  const options = EXAMPLES[AREAS.includes(area) ? area : 'Escolar']
    .filter(e => e.text !== current?.text?.trim() && topic(e.topic) !== topic(current?.topic));
  return options[Math.floor(random() * options.length)];
}

// O começo de um texto, para a frase de exemplo do campo vazio do Estudar: a primeira frase, com reticências no lugar do
// ponto. Com mais de 80 caracteres ela para numa palavra inteira, sem palavrinha solta ("e", "de", "que") nem vírgula
// no fim.
export function opener(text) {
  const end = text.search(/[.!?]/);
  const first = end < 0 ? text : text.slice(0, end);
  const cut = first.length <= 80 ? first : first.slice(0, first.lastIndexOf(' ', 80)).replace(/(?:[\s,]+\S{0,3})+$/, '');
  return cut + '…';
}

// As frases de exemplo de uma área: o começo de cada exemplo pronto dela. Área fora da lista vale Escolar, como no
// pickExample.
export function openers(area) {
  return EXAMPLES[AREAS.includes(area) ? area : 'Escolar'].map(({ text }) => opener(text));
}

// Espera antes da próxima letra da frase de exemplo, com shown letras já na tela: a primeira sai em 0,9 s, depois da
// entrada da página, e as outras com a espera sorteada de quem digita, de 26 a 46 ms. Assim a frase mais longa termina
// antes de 5 s (WCAG 2.2.2). random devolve de 0 a 1; os testes passam o deles.
export function typeDelay(shown, random = Math.random) {
  return shown ? 26 + random() * 20 : 900;
}

// Setas, Home e End num grupo de opções ou num menu: o índice aonde a tecla leva, dando a volta nas pontas; -1 quando
// a tecla não anda.
export function rove(key, at, count) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  return step ? (at + step + count) % count : -1;
}

// A tecla que pergunta ao Cérebro pelo editor do Estudar: Ctrl + Enter (⌘ + Enter no Mac). Lá o Enter sozinho quebra a
// linha, porque o editor guarda o texto da aula e as anotações, e cada pergunta gasta uma chamada da IA. Tecla da
// composição de texto (acento, IME) não pergunta. Recebe o evento do navegador (nativeEvent), não o do React.
export function askKey(e) {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
    !e.isComposing && e.keyCode !== 229;
}

// Um bloco de height px cabe na janela de viewport px acima da reserva da raiz (o scroll-padding-bottom calculado: no
// celular, a barra de baixo e o "Próxima questão" preso; no computador, "auto", que não reserva nada)? strip é a faixa
// presa que fica dentro do próprio bloco: ela sai da reserva, senão contaria duas vezes. No computador a faixa não é
// presa, e a reserva continua 0.
export function fitsAbove(height, viewport, reserve, strip = 0) {
  return height <= viewport - Math.max(0, (parseFloat(reserve) || 0) - strip);
}

// Chave de um dado no navegador. A demonstração (?demo) grava à parte, com o prefixo cerebro-demo-: o que se faz nela
// não entra no desempenho, no caderno de erros nem na biblioteca do app com IA, e os dados do app com IA não aparecem
// nela. O App liga a demonstração antes da primeira leitura.
let prefix = 'cerebro-';
export function demoStorage(on) {
  prefix = on ? 'cerebro-demo-' : 'cerebro-';
}
export const storageKey = k => prefix + k;

// session lê o que esta aba guardou (sessionStorage). Ele é avaliado dentro do try: no Node não existe, e o navegador
// que bloqueia o armazenamento lança erro. Nos dois casos vale o padrão.
export function read(k, d, session = false) {
  try {
    return JSON.parse((session ? sessionStorage : localStorage).getItem(storageKey(k))) ?? d;
  } catch {
    return d;
  }
}

const isText = v => typeof v === 'string';
// Data em texto, como o App grava (toISOString).
const isDate = v => isText(v) && !Number.isNaN(Date.parse(v));

// Questão do quiz no formato que a tela desenha. Vale para o material e para o caderno de erros.
const validQuestion = q =>
  !!q && ['multiple', 'boolean', 'short'].includes(q.type) && isText(q.question) &&
  Array.isArray(q.options) && q.options.every(isText) &&
  (typeof q.answer === 'number' || isText(q.answer)) && isText(q.explanation) &&
  (q.steps == null || (Array.isArray(q.steps) && q.steps.every(isText)));

// Confere o formato de um material antes de ele ir para a tela. O que vem do navegador (biblioteca, rascunho) pode
// estar estragado: um material sem summary deixava a tela branca. Só o título precisa ter texto: material gravado
// por versão antiga pode ter item em branco. source e steps são opcionais: material antigo não tem.
// area e level também são opcionais, mas, se vierem, são texto: a tela os escreve no cabeçalho do material.
export function validMaterial(m) {
  const filled = (list, ok) => Array.isArray(list) && list.length > 0 && list.every(item => !!item && ok(item));
  const optional = v => v == null || isText(v);
  return !!m && isText(m.title) && m.title.trim() !== '' && optional(m.area) && optional(m.level) &&
    filled(m.summary, s => isText(s.concept) && isText(s.text) && optional(s.source)) &&
    filled(m.flashcards, c => isText(c.question) && isText(c.answer)) &&
    filled(m.quiz, validQuestion);
}

// Mesmo conteúdo, sem olhar id, data, área e nível. A demonstração gera sempre o mesmo material para o mesmo texto.
export function sameMaterial(a, b) {
  const content = m => JSON.stringify([m.title, m.summary, m.flashcards, m.quiz]);
  return content(a) === content(b);
}

// Id de um material que entra na biblioteca: a hora ou, se ela já foi usada, um a mais que o maior id da lista.
// Guardar o material anterior e o novo no mesmo clique (App.jsx, generate) dava o mesmo Date.now() aos dois, e excluir
// um deles apagava os dois.
export function newId(list, now = Date.now()) {
  return Math.max(now, ...list.map(m => (Number.isSafeInteger(m?.id) ? m.id + 1 : 0)));
}

// Aviso fixo onde há texto escrito pela IA.
export const AI_NOTE = 'Gerado por IA. Pode conter erros: confira com o seu material.';

// O trecho do tópico está no texto? Sem maiúsculas, sem acentos e com os espaços em sequência reduzidos a um, como o
// backend confere o trecho (main.py, plain e grounded). Os invisíveis também saem: o backend os tira do texto antes de
// conferir (models.py, visible), e o exemplo guardado na tela pode tê-los.
export function inText(source, text) {
  const plain = t => fold(t ?? '').replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim();
  return !!plain(source) && plain(text).includes(plain(source));
}

// O trecho de um exemplo do "Usar um exemplo" não é do aluno: o tópico com trecho no texto que a IA escreveu (ai) leva
// a marca ia, e o com trecho no exemplo pronto (ready), a marca pronto. O App passa o último exemplo que pôs no editor.
export function markExample(summary, ai, ready) {
  return summary.map(s =>
    inText(s.source, ai) ? { ...s, ia: true } : inText(s.source, ready) ? { ...s, pronto: true } : s);
}

// O rótulo do trecho diz de que texto ele saiu.
export function sourceLabel(s) {
  const from = s.ia ? 'No exemplo escrito pela IA' : s.pronto ? 'No texto de exemplo' : 'No seu texto';
  return from + ': "' + s.source.trim() + '"';
}

// O aviso sob o título do material diz de onde ele veio: do exemplo que a própria IA escreveu (trecho com ia), de um
// exemplo pronto (trecho com pronto), de um texto do aluno (trecho conferido) ou de nada que dê para conferir (só um
// tema, ou material de antes dos trechos).
export function originNote(summary) {
  if (summary.some(s => s.ia)) return 'Feito de um exemplo escrito pela IA. Confira os fatos em uma fonte confiável.';
  if (summary.some(s => s.pronto)) return 'Gerado por IA. Pode conter erros: confira com o texto de exemplo.';
  if (summary.some(s => s.source?.trim())) return AI_NOTE;
  return 'Nenhum tópico foi conferido com um texto seu. Confira em uma fonte confiável.';
}

// Resposta registrada no desempenho. Sem data válida ela estragava a sequência de dias e o gráfico.
export function validEvent(e) {
  return !!e && isText(e.kind) && e.kind !== '' && typeof e.ok === 'boolean' && isDate(e.date);
}

// Lista gravada no navegador (biblioteca, desempenho), sem conferir os itens: quem grava parte dela inteira, para
// não apagar o que a tela ignora. Valor estragado, que não é lista, vale como lista vazia.
export function readList(k) {
  const list = read(k, []);
  return Array.isArray(list) ? list : [];
}

// Perfil local. Sem nome em texto não vale: a inicial do nome vai para o avatar.
export function readUser() {
  const user = read('user', null);
  return isText(user?.name) ? user : null;
}

// Rascunho do que estava aberto (editor, material, conversa), gravado a cada mudança para sobreviver a um F5.
// Vale primeiro o desta aba (sessionStorage): com o app aberto em duas abas, o F5 traz o texto da própria aba, e não o
// da última que gravou. Aba nova ainda não tem o seu e abre com o último gravado (localStorage).
// Volta já conferido: o que está fora do formato sai, e rascunho ausente ou estragado dá tudo vazio.
export function readDraft() {
  const d = read('rascunho', null, true) || read('rascunho', null) || {};
  const result = validMaterial(d.result) ? d.result : null;
  const chat = Array.isArray(d.chat)
    ? d.chat.filter(m => (m?.role === 'user' || m?.role === 'assistant') && isText(m.text))
    : [];
  // Pergunta que ficou sem resposta (F5 no meio do pedido) sai, como a que falha: iria sem resposta no histórico.
  while (chat.length && chat[chat.length - 1].role === 'user') chat.pop();
  const texts = list => Array.isArray(list) && list.every(isText);
  return {
    input: isText(d.input) && d.input.length <= MAX_INPUT ? d.input : '',
    // O último exemplo que a IA escreveu e pôs no editor: o trecho que sai dele não é do aluno (App, aiExample).
    exemplo: isText(d.exemplo) && d.exemplo.length <= MAX_INPUT ? d.exemplo : '',
    // O mesmo para o último exemplo pronto (App, readyExample).
    exemploPronto: isText(d.exemploPronto) && d.exemploPronto.length <= MAX_INPUT ? d.exemploPronto : '',
    area: AREAS.includes(d.area) ? d.area : '',
    level: LEVELS.includes(d.level) ? d.level : '',
    result,
    // A marca da última geração (o texto, a área e o nível do material aberto) só vale com o material. O rascunho
    // gravado antes de um botão só de gerar traz também kinds, que fica de fora.
    made: { key: result && isText(d.made?.key) ? d.made.key : '' },
    chat,
    tips: isText(d.tips?.key) && texts(d.tips.list) ? { key: d.tips.key, list: d.tips.list } : { key: '', list: [] },
    // O aluno escolheu o texto do editor como assunto do chat, com um material aberto (chatSubject).
    editorChat: d.editorChat === true,
  };
}

// Dia no fuso do aluno. toISOString() dá o dia em UTC: no Brasil o estudo depois das 21h caía no dia seguinte.
export function localDay(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Compara texto sem ligar para maiúsculas e acentos ("fotossintese" vale como "Fotossíntese").
export function fold(text) {
  return String(text).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Resposta curta: tira só a pontuação do fim e lê vírgula decimal como ponto. Apagar todo ponto e vírgula fazia "2,5" valer "25".
export function norm(text) {
  return fold(text).trim().replace(/[.!?,;:]+$/, '').replace(/(\d),(?=\d)/g, '$1.');
}

// Resposta curta pode ter formas equivalentes separadas por "|" ("PIB|Produto Interno Bruto"): qualquer uma vale.
// A resposta inteira também vale: sem isso, digitar inteira uma resposta que tem "|" ("||", "|x|") nunca era aceito.
export function shortAnswerOk(expected, value) {
  return !!norm(value) && [expected, ...String(expected).split('|')].some(a => norm(a) === norm(value));
}

// Gabarito de uma questão em texto: a opção certa ou, na resposta curta, as formas aceitas ligadas por " ou ".
// Só barras ("||", o operador OU) não tem forma separada: é a própria resposta.
export function expectedText(q) {
  if (q.type !== 'short') return q.options[q.answer] ?? String(q.answer);
  const forms = String(q.answer).split('|').map(form => form.trim()).filter(Boolean);
  return forms.length ? forms.join(' ou ') : String(q.answer);
}

// Título de um trecho na demonstração: a primeira oração inteira, até a quebra de linha, a pontuação (, ; : travessão)
// ou um conectivo ("que", "em que", "pelo qual", "e"…), sem o ponto final e com no máximo 12 palavras. Cortar num
// número fixo de palavras deixava títulos quebrados, como "No ciclo de" e "A fotossíntese é o processo pelo qual".
const CLAUSE_END = /\n|[,;:]|\s[–—]\s|\s(?:(?:em|de|com|para|por) que|(?:pel|n|d)[oa]s? qua(?:l|is)|que|onde|quando|porque|mas|e)\s/;
function clause(s) {
  const words = (s.split(CLAUSE_END)[0].replace(/[.!?…]+$/, '').trim() || s).split(/\s+/);
  return words.slice(0, 12).join(' ') + (words.length > 12 ? '…' : '');
}

export function demo(text) {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [text];
  const pieces = sentences.slice(0, 8);
  return {
    title: clause(sentences[0]),
    // O trecho de cada tópico é a própria frase: a tela diz se ela saiu do texto do aluno ou do exemplo pronto.
    summary: pieces.map(s => ({ concept: clause(s), text: s, source: s })),
    flashcards: pieces.map((s, i) => ({
      question: 'Complete o trecho ' + (i + 1) + ': ' + s.split(' ').slice(0, 4).join(' ') + '…',
      answer: s,
    })),
    quiz: pieces.slice(0, 5).map((s, i) => ({
      type: i % 3 === 0 ? 'short' : i % 3 === 1 ? 'boolean' : 'multiple',
      question: i % 3 === 0 ? 'Qual palavra inicia este trecho: “…' + s.split(' ').slice(1, 8).join(' ') + '”?'
        : i % 3 === 1 ? 'Verdadeiro ou falso: ' + s
        : 'Qual trecho faz parte do material fornecido?',
      options: i % 3 === 1
        ? ['Verdadeiro', 'Falso']
        : [s, 'O texto não apresenta nenhuma informação.', 'Nenhuma das alternativas.'],
      answer: i % 3 === 0 ? s.split(' ')[0] : 0,
      explanation: 'Trecho do material: ' + s,
      steps: [],
    })),
    // Material sem nada escrito pela IA: é o único que abre sem o aviso de conteúdo gerado por IA (App).
    semIA: true,
  };
}

// A palavra no singular quando o número é 1 e no plural nos outros, o zero também ("0 cartões"). Devolve só a palavra:
// no Stat o número vai à parte, em destaque.
export const plural = (n, um, varios) => (n === 1 ? um : varios);

// Total, acertos e percentual inteiro de uma lista de respostas. Sem respostas o percentual é zero.
function tally(answers) {
  const correct = answers.filter(e => e.ok).length;
  return { total: answers.length, correct, rate: answers.length ? Math.round(correct / answers.length * 100) : 0 };
}

// Os n últimos dias, do mais antigo para hoje, no formato de localDay.
function recentDays(n, now) {
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (n - 1 - i));
    return localDay(day);
  });
}

// Respostas do quiz (ou, com kind 'flashcard', avaliações dos cartões) que contam no desempenho: de cada questão ou
// cartão (mesmo dia, mesmo material, mesmo enunciado), só a primeira. Refazer a mesma questão, ou rever o mesmo
// baralho, fazia o número subir sem o aluno saber mais.
// A lista está na ordem em que foi gravada. Evento anterior a esta regra não tem q e conta como está.
export function firstAttempts(events, kind = 'quiz') {
  const seen = new Set();
  return events.filter(e => {
    if (e.kind !== kind) return false;
    if (!e.q) return true;
    const key = JSON.stringify([localDay(e.date), e.title, e.q]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Acerto no quiz. Os cartões ficam de fora: "Acertei" é o aluno quem marca, e somado ao quiz inflava o número.
export function quizRate(events) {
  return tally(firstAttempts(events));
}

// Autoavaliação nos cartões: quantos o aluno marcou "Acertei", na primeira avaliação de cada cartão no dia.
export function cardRate(events) {
  return tally(firstAttempts(events, 'flashcard'));
}

// Sem estudo hoje a sequência ainda vale até ontem: o dia não acabou.
export function streak(events, today) {
  const days = new Set(events.map(e => localDay(e.date)));
  const day = new Date(today);
  let count = 0;
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  while (days.has(localDay(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

// Ponto fraco: o material com a maior taxa de erro nas primeiras respostas do quiz nos últimos 7 dias, os mesmos do
// gráfico. Erro antigo não manda na revisão de hoje, e com menos de 3 respostas a taxa não diz nada.
// No empate vale o que tem mais erros. Evento gravado antes de existir título cai no nome da área.
export function weakSpot(events, now) {
  const week = new Set(recentDays(7, now));
  const spots = new Map();
  for (const e of firstAttempts(events)) {
    if (week.has(localDay(e.date))) {
      const name = e.title || e.area;
      const spot = spots.get(name) || { name, wrong: 0, total: 0 };
      spots.set(name, { name, wrong: spot.wrong + (e.ok ? 0 : 1), total: spot.total + 1 });
    }
  }
  return [...spots.values()]
    .filter(spot => spot.total >= 3 && spot.wrong > 0)
    .sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong)[0] || null;
}

// Os 7 dias do gráfico, do mais antigo para hoje, cada um com as primeiras respostas do quiz naquele dia.
export function chartDays(events, area, now) {
  const answers = firstAttempts(events)
    .filter(e => area === 'Todas' || e.area === area)
    .map(e => ({ day: localDay(e.date), ok: e.ok }));
  return recentDays(7, now).map(day => ({
    day,
    label: day.slice(8) + '/' + day.slice(5, 7),
    ...tally(answers.filter(a => a.day === day)),
  }));
}

// Uma coluna do gráfico por extenso, para o leitor de tela: na tela ela é só "33% · 6" sobre uma barra.
export function spokenDay({ day, total, rate }) {
  return new Date(day + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ': ' +
    (total ? total + (total === 1 ? ' resposta, ' : ' respostas, ') + rate + '% de acerto' : 'nenhuma resposta');
}

// Houve estudo (quiz ou cartão) em cada um dos n últimos dias? Do mais antigo para hoje.
export function lastDays(events, n, now) {
  const studied = new Set(events.map(e => localDay(e.date)));
  return recentDays(n, now).map(day => studied.has(day));
}

// Linha de uma área na página Desempenho, com quiz e cartões separados, os dois pela primeira resposta do dia.
// Sem resposta de quiz não há percentual: "0% de acerto" diria que o aluno errou tudo.
export function areaLine(events, area) {
  const quiz = tally(firstAttempts(events).filter(e => e.area === area));
  const cards = firstAttempts(events, 'flashcard').filter(e => e.area === area).length;
  if (!quiz.total && !cards) return 'Sem registros ainda';
  return (quiz.total
    ? quiz.rate + '% de acerto no quiz · ' + quiz.total + (quiz.total === 1 ? ' questão' : ' questões')
    : 'Quiz sem respostas') + ' · ' + cards + (cards === 1 ? ' cartão' : ' cartões');
}

// Busca só no texto do material: JSON.stringify também casava nomes de campo ("quiz", "answer") e datas.
export function matches(material, query, filter) {
  return (filter === 'Todas' || material.area === filter) &&
    fold([
      material.title,
      ...material.summary.flatMap(x => [x.concept, x.text]),
      ...material.flashcards.flatMap(c => [c.question, c.answer]),
      ...material.quiz.map(q => q.question),
    ].join(' ')).includes(fold(query));
}

// Quantos materiais a busca e o filtro da Biblioteca deixaram, na frase que o leitor de tela ouve (App.jsx).
export function libraryCount(n) {
  return n === 0 ? 'Nenhum material encontrado' : n === 1 ? '1 material encontrado' : n + ' materiais encontrados';
}

// Sugestões ao lado da caixa do chat, sempre sobre o assunto: de partida (o texto do assunto ou a área) até a primeira
// resposta; depois, as perguntas que a IA mandou junto com a última resposta. Se ela não mandar nenhuma, entram três fixas.
// input é o texto do assunto (chatSubject): o do editor ou o do material aberto. As da IA só valem enquanto esse texto e
// a área são os da resposta: se o aluno muda de assunto, voltam as fixas.
export function hints({ chat, input, area, tips }) {
  if (!chat.some(m => m.role === 'assistant')) {
    return [
      'Me introduza ao assunto',
      ...(input.trim()
        ? ['Quais são os pontos principais do texto?', 'Faça uma pergunta sobre o texto para eu praticar']
        : STARTERS[area]),
    ];
  }
  return tips.key === JSON.stringify([input, area]) && tips.list.length
    ? tips.list
    : ['Me dê um exemplo do dia a dia', 'Explique de outro jeito', 'Faça uma pergunta para eu praticar'];
}

// Atalhos da caixa do chat (components/ui/chat-composer.jsx): "/" no começo do texto, ainda sem espaço, abre a lista com
// as sugestões, filtradas pelo que vem depois da barra sem ligar para maiúsculas e acentos ("/sao" acha "O que são
// hardware e software?"). Texto que não começa assim devolve null: ele não abre a lista (o botão de atalhos abre, com todas).
export function slashHints(list, text) {
  if (!text.startsWith('/') || /\s/.test(text)) return null;
  const query = fold(text.slice(1));
  return list.filter(h => fold(h).includes(query));
}

// Saudação fixa: o Cérebro fala primeiro sem gastar chamada da IA. Não entra em chat, então não vai no histórico do pedido.
// title é o material aberto sobre o qual o chat pergunta (chatSubject); sem ele, vale o texto do editor.
export function hello({ user, area, level, input, title, api }) {
  return 'Olá' + (user?.name ? ', ' + user.name : '') + '! Sou o Cérebro, seu tutor ' +
    (area === 'Escolar' ? 'das matérias escolares' : 'de ' + area) + ' no nível ' + level + '. ' +
    (api
      ? 'Pergunte o que quiser ou escolha uma das sugestões abaixo. ' +
        (title ? 'Vou considerar o material "' + title + '".'
          : input.trim() ? 'Vou considerar o texto que está no editor.' : 'Se colar um texto no editor, respondo com base nele.')
      : 'Nesta demonstração eu organizo o seu texto em resumo, flashcards e quiz. As respostas a dúvidas ficam para a versão com IA.');
}

// Assunto do chat. Vale o texto do editor sem material aberto, quando o material saiu desse texto (é o mesmo assunto,
// e o texto é mais completo) ou quando o aluno escolheu o texto (editor) e há texto lá. Senão, o material: o título e
// o resumo vão como content, com a área e o nível dele (material antigo sem eles usa os do editor).
// made é a chave da última geração, [texto, área, nível] (App.jsx, generate): só o texto conta, porque a área e o
// nível podem ter mudado depois. swap é o botão que troca a fonte, quando há outra para escolher.
export function chatSubject({ material, made, editor, input, area, level }) {
  const fromEditor = made.startsWith('[' + JSON.stringify(input) + ',');
  if (!material || fromEditor || (editor && input.trim())) {
    return { title: '', content: input, area, level, swap: material && !fromEditor ? 'Usar o material aberto' : '' };
  }
  const topics = material.summary.map(s => [s.concept, s.text].filter(t => t.trim()).join(': '));
  return {
    title: material.title,
    content: cut([material.title, ...topics].filter(Boolean).join('\n'), MAX_INPUT),
    area: AREAS.includes(material.area) ? material.area : area,
    level: LEVELS.includes(material.level) ? material.level : level,
    swap: input.trim() ? 'Usar o texto do editor' : '',
  };
}

// Dica do selo da IA (title): a conta do selo é só deste computador, e a cota do Google é do projeto inteiro.
const QUOTA_NOTE = 'A cota da IA é do projeto inteiro e zera à meia-noite do horário do Pacífico (4h ou 5h em ' +
  'Brasília). O saldo real fica no painel de uso do Google AI Studio.';

// Estado da IA no cabeçalho, a partir da resposta de /api/health: null enquanto ela não chegou, false se a consulta
// falhou ou não veio JSON. tone é a classe do ponto colorido, e note, a dica do selo. Com a IA ativa, model e count são
// partes do text: na barra estreita o modelo sai da vista (styles.css, @container), e o text, chave da troca animada,
// fica inteiro.
export function healthLabel(health) {
  if (health == null) return { text: 'Conferindo a IA…', tone: '' };
  if (!health) return { text: 'Cérebro desligado', tone: 'off' };
  if (!health.ai_configured) return { text: 'IA não configurada', tone: 'warn' };
  if (health.quota_exhausted) return { text: 'Cota de hoje esgotada', tone: 'warn', note: QUOTA_NOTE };
  const calls = health.calls_today;
  const model = health.model_in_use || health.model || '';
  const count = typeof calls === 'number' ? calls + (calls === 1 ? ' chamada' : ' chamadas') + ' deste computador' : '';
  return { text: ['IA ativa', model, count].filter(Boolean).join(' · '), tone: 'ok', model, count, note: QUOTA_NOTE };
}

// Frase de cada erro para o aluno: o que houve e o que ele consegue fazer. As frases do backend falam de .env, proxy e
// Python para quem instala (python -m app.check mostra as mesmas) e ficam nos detalhes técnicos. Código fora daqui já
// vem do backend com uma frase simples.
const SETUP = 'A IA recusou o pedido por um problema de configuração. Mostre os detalhes técnicos a quem instalou o Cérebro.';
const SHAPE = 'A IA respondeu fora do formato esperado. Tente de novo.';
export const ERRORS = {
  AI_RATE_LIMITED: 'Muitos pedidos em pouco tempo. Os botões da IA voltam sozinhos em alguns segundos.',
  AI_QUOTA_EXCEEDED: 'A cota de hoje da IA acabou. Enquanto isso, estude o que já está na Biblioteca.',
  AI_NOT_CONFIGURED: 'A IA não está ligada neste computador. Quem instalou o Cérebro precisa configurar a chave. ' +
    'Enquanto isso, use a demonstração.',
  AI_NETWORK_ERROR: 'O Cérebro não conseguiu falar com a IA. Confira a internet deste computador e tente de novo.',
  AI_PROVIDER_ERROR: 'A IA não atendeu o pedido. Tente de novo; se repetir, mostre os detalhes técnicos a quem ' +
    'instalou o Cérebro.',
  AI_AUTH_ERROR: SETUP,
  AI_MODEL_NOT_FOUND: SETUP,
  AI_REQUEST_REJECTED: SETUP,
  AI_NO_COMPATIBLE_MODEL: SETUP,
  AI_INVALID_RESPONSE: SHAPE,
  AI_INVALID_JSON: SHAPE,
};

// Falhas que a própria tela percebe, sem resposta do backend (App.jsx, requestAPI). A resposta sem JSON costuma ser o
// proxy do Vite respondendo no lugar do Python desligado.
export const FAILS = {
  off: 'O Cérebro não está ligado neste computador. Abra o iniciar.ps1 de novo e tente outra vez.',
  noJson: 'O Cérebro não respondeu como esperado. Abra o iniciar.ps1 de novo e tente outra vez.',
  timeout: 'A IA demorou demais para responder. Tente de novo.',
};

// Erro do backend para a tela: message é a frase para o aluno; tech, os detalhes técnicos (o código, o estado do
// provedor e a frase original do backend, ou o HTTP sem código); wait, os segundos que o backend mandou esperar no
// limite por minuto (retry_after), ou 0. detail em lista é o formato antigo (erros de validação em inglês, um por
// campo): vira uma frase só.
export function errorText(detail, status) {
  const said = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? 'Pedido recusado: confira o texto e tente de novo.'
    : detail?.message;
  const code = detail?.code;
  const message = ERRORS[code] || said || 'O Cérebro não conseguiu atender o pedido. Tente de novo.';
  return {
    message,
    tech: [code || 'HTTP ' + status, detail?.provider_status, said !== message && said].filter(Boolean).join(' · '),
    wait: detail?.retry_after > 0 ? Math.ceil(detail.retry_after) : 0,
  };
}

// Soma o trecho ditado ao texto do editor e corta no limite, sem deixar meio emoji no fim:
// sem o corte o ditado passava de 20.000 caracteres e o backend recusava o texto.
export function dictate(text, spoken) {
  return (text + ' ' + spoken).trim().slice(0, MAX_INPUT).replace(/[\uD800-\uDBFF]$/, '');
}

// Motivo da falha do ditado (o campo error do evento do navegador) em frase para o aluno.
export function dictationError(code) {
  if (code === 'no-speech') return 'Não ouvi nada. Tente de novo.';
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Permita o uso do microfone no navegador.';
  if (code === 'network') return 'O ditado precisa de internet.';
  return 'Não foi possível ouvir. Verifique a permissão do microfone.';
}

// Baralho de uma sessão de flashcards: queue é a fila de índices dos cartões e pos, o cartão aberto. O material não
// muda de ordem. A sessão começa com todos os cartões e acaba quando pos passa do fim da fila.
export function deckStart(count) {
  return { queue: Array.from({ length: count }, (_, i) => i), pos: 0 };
}

export function deckRight(deck) {
  return { ...deck, pos: deck.pos + 1 };
}

// O cartão errado entra de novo no fim da fila: volta até ser acertado.
export function deckWrong(deck) {
  return { queue: [...deck.queue, deck.queue[deck.pos]], pos: deck.pos + 1 };
}

// "Revisar depois": o cartão aberto vai para o fim da fila e o seguinte toma o lugar dele.
// No último não há para onde mandar: o baralho volta igual.
export function deckLater(deck) {
  if (deck.pos >= deck.queue.length - 1) return deck;
  const queue = [...deck.queue];
  queue.push(queue.splice(deck.pos, 1)[0]);
  return { ...deck, queue };
}

// Cartões que voltaram por erro: os que aparecem mais de uma vez na fila.
// "Revisar depois" só muda o cartão de lugar, sem repetir.
export function deckMissed(deck) {
  return [...new Set(deck.queue.filter((card, i) => deck.queue.indexOf(card) !== i))].sort((a, b) => a - b);
}

// Nova sessão só com os cartões que voltaram por erro.
export function deckRedo(deck) {
  return { queue: deckMissed(deck), pos: 0 };
}

// "Recomeçar" no meio: a mesma sessão desde o início, com os cartões dela na ordem do material e sem as voltas por
// erro. No "Refazer só os que errei" recomeçam só esses cartões, como o quiz recomeça só as questões erradas.
export function deckRestart(deck) {
  return { queue: [...new Set(deck.queue)].sort((a, b) => a - b), pos: 0 };
}

// Frase do fim do baralho.
export function deckSummary(deck) {
  const cards = new Set(deck.queue).size;
  const missed = deckMissed(deck).length;
  return cards + (cards === 1 ? ' cartão revisado; ' : ' cartões revisados; ') +
    (missed === 0 ? 'nenhum voltou' : missed === 1 ? '1 voltou' : missed + ' voltaram') + ' por erro.';
}

// Caderno de erros: as questões erradas de todos os materiais, para refazer. Cada erro é { key, item, title, area,
// date }: a questão inteira, o material e a área de onde veio e quando o aluno a errou por último.
// As funções recebem a lista como está gravada no navegador: item que a tela ignora fica onde está.

// Chave de uma questão no caderno: o material e o enunciado, sem acentos nem maiúsculas.
export function mistakeKey(title, question) {
  return fold(title) + '|' + fold(question);
}

// Errou: a questão entra no caderno ou, se já estava, fica no mesmo lugar com a data nova.
// item leva só os campos da questão: a que vem da tela traz junto a resposta dada na sessão.
export function addMistake(list, item, title, area, now) {
  const { type, question, options, answer, explanation, steps } = item;
  const key = mistakeKey(title, question);
  const entry = {
    key, item: { type, question, options, answer, explanation, steps }, title, area, date: new Date(now).toISOString(),
  };
  return list.some(e => e?.key === key) ? list.map(e => (e?.key === key ? entry : e)) : [...list, entry];
}

// Acertou: a questão só sai do caderno se o erro guardado é de outro dia. Acertar no mesmo dia, logo depois de
// ver a explicação, não prova que aprendeu.
export function clearMistake(list, key, now) {
  return list.filter(e => e?.key !== key || localDay(e.date) === localDay(now));
}

// O aluno tirou a questão do caderno, ou a revisão da IA aceitou a resposta: sai na hora.
// until (só na revisão) é a hora do pedido: erro gravado depois dela fica, porque o aluno errou a questão de novo
// enquanto esperava a IA.
export function removeMistake(list, key, until) {
  return list.filter(e => e?.key !== key || Date.parse(e.date) > Date.parse(until));
}

// Erro lido do navegador ou de um arquivo de backup, antes de ir para a tela. A chave tem de ser a do material e
// do enunciado: é por ela que a questão sai do caderno quando o aluno acerta.
export function validMistake(e) {
  return !!e && validQuestion(e.item) && isText(e.title) && e.title.trim() !== '' && isText(e.area) &&
    isDate(e.date) && e.key === mistakeKey(e.title, e.item.question);
}

// Os erros agrupados por material, na ordem em que cada material apareceu: [título, erros].
export function byMaterial(mistakes) {
  const groups = new Map();
  for (const m of mistakes) groups.set(m.title, [...(groups.get(m.title) || []), m]);
  return [...groups];
}

// Texto que vai num pedido à IA: sem espaços nas pontas e cortado por caractere inteiro (o backend conta
// caracteres, e meio emoji no fim faria o pedido ser recusado).
const cut = (text, max) => [...String(text).trim()].slice(0, max).join('');

// "Não entendi, me explique" numa questão respondida do quiz: a pergunta que vai ao tutor.
// given é o que o aluno respondeu (o índice da opção ou o texto digitado) e só entra quando ele errou.
export function whyQuestion(q, given, ok) {
  return 'Não entendi esta questão: "' + q.question + '". ' +
    (ok ? '' : 'Respondi "' + (q.type === 'short' ? cut(given, 500) : q.options[given]) + '". ') +
    'A resposta certa é "' + expectedText(q) +
    '". Explique de outro jeito, em passos curtos, por que essa é a resposta.';
}

// "Não entendi, me explique" num tópico do resumo.
export function whyTopic(concept) {
  return 'Explique de outro jeito este tópico: "' + concept + '".';
}

// Corpo do pedido de "Pedir revisão da IA" (/api/grade), nos limites do backend: enunciado e resposta com até 500
// caracteres, gabarito com até 200. O gabarito vai como está no material, com as formas separadas por "|".
export function gradeRequest(q, given, area, level) {
  return { question: cut(q.question, 500), expected: cut(q.answer, 200), answer: cut(given, 500), area, level };
}

// A revisão da IA aceitou a resposta que a comparação de texto marcou como errada: a última resposta de quiz
// gravada para a questão (mesmo material e mesmo enunciado) passa a valer como acerto.
// until é a hora do pedido de revisão: resposta gravada depois dela não é a que a IA viu.
export function fixLastQuizEvent(events, title, q, until) {
  const at = events
    .map(e => e?.kind === 'quiz' && e.title === title && e.q === q && !(Date.parse(e.date) > Date.parse(until)))
    .lastIndexOf(true);
  return events.map((e, i) => (i === at ? { ...e, ok: true } : e));
}

// Cópia de segurança: os dados ficam presos a um navegador, e o arquivo os leva para outro computador.
// Lê o texto do arquivo e devolve as listas já conferidas, ou null se ele não é um backup do Cérebro (JSON de
// objeto com versao 1). O arquivo vem de fora: cada item passa pela mesma conferência da leitura do navegador, e
// o que não passa fica de fora e é contado em fora, para o aviso dizer o que não entrou. Material sem data válida
// também sai: é pela data que mergeBackup o reconhece. O perfil (user) só vale com nome de 1 a 50 caracteres, o
// limite do formulário, e área da lista; senão é null. Dele só entram o nome e a área.
export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.versao !== 1) return null;
  const list = (value, ok) => (Array.isArray(value) ? value.filter(ok) : []);
  const saved = list(data.saved, m => validMaterial(m) && isDate(m.date));
  const events = list(data.events, validEvent);
  const erros = list(data.erros, validMistake);
  const left = (value, kept) => (Array.isArray(value) ? value.length - kept.length : 0);
  const name = isText(data.user?.name) ? data.user.name.trim() : '';
  return {
    saved,
    events,
    erros,
    fora: { saved: left(data.saved, saved), events: left(data.events, events), erros: left(data.erros, erros) },
    user: name && name.length <= 50 && AREAS.includes(data.user.area) ? { name, area: data.user.area } : null,
  };
}

// Junta o backup lido (novo) ao que está gravado no navegador (atual) sem duplicar: importar o mesmo arquivo
// duas vezes não muda nada. O perfil fica com o App (importBackup): só entra num navegador que ainda não tem um.
export function mergeBackup(atual, novo) {
  // Material com o mesmo título e a mesma data já está na biblioteca. O que entra com id já usado, ou sem id,
  // ganha id novo: é pelo id que a tela marca o material como salvo e o exclui.
  const ids = new Set(atual.saved.map(m => m?.id));
  const dated = m => JSON.stringify([m?.title, m?.date]);
  const have = new Set(atual.saved.map(dated));
  const fresh = [];
  for (const m of novo.saved) {
    if (!have.has(dated(m))) {
      const id = Number.isSafeInteger(m.id) && !ids.has(m.id)
        ? m.id
        : Math.max(0, ...[...ids].filter(Number.isSafeInteger)) + 1;
      have.add(dated(m));
      ids.add(id);
      fresh.push({ ...m, id });
    }
  }
  // Resposta igual (tipo, data, material e enunciado) não repete. A lista fica em ordem de data: o desempenho
  // conta a primeira resposta de cada questão no dia, e a primeira é a que foi gravada antes.
  const answered = e => JSON.stringify([e?.kind, e?.date, e?.title, e?.q]);
  const seen = new Set(atual.events.map(answered));
  const events = [...atual.events];
  for (const e of novo.events) {
    if (!seen.has(answered(e))) {
      seen.add(answered(e));
      events.push(e);
    }
  }
  const time = e => Date.parse(e?.date) || 0;
  events.sort((a, b) => time(a) - time(b));
  // Erro com a mesma chave fica com a data mais recente.
  const erros = [...atual.erros];
  for (const e of novo.erros) {
    const at = erros.findIndex(old => old?.key === e.key);
    if (at < 0) erros.push(e);
    else if (!(time(erros[at]) >= time(e))) erros[at] = e;
  }
  // O que entra fica no topo da biblioteca, como o material recém-salvo.
  return { saved: [...fresh, ...atual.saved], events, erros };
}

// Contagens numa frase: "2 materiais, 1 resposta e 3 questões do caderno de erros", cada palavra no singular ou no
// plural. items é uma lista de [número, singular, plural].
function countList(items) {
  const said = items.map(([n, one, many]) => n + ' ' + (n === 1 ? one : many));
  return said.length > 1 ? said.slice(0, -1).join(', ') + ' e ' + said[said.length - 1] : said.join('');
}

// As três partes do backup, cada uma com o seu número, para countList.
const backupItems = ({ saved, events, erros }) => [
  [saved, 'material', 'materiais'],
  [events, 'resposta', 'respostas'],
  [erros, 'questão do caderno de erros', 'questões do caderno de erros'],
];

// Aviso depois de exportar: o que foi no arquivo, contado como a tela mostra (só o que passa na conferência).
export function backupSummary(backup) {
  return 'Backup gerado: ' + countList(backupItems({
    saved: backup.saved.filter(validMaterial).length,
    events: backup.events.filter(validEvent).length,
    erros: backup.erros.filter(validMistake).length,
  })) + '.';
}

// Aviso depois de importar: quantos materiais entraram ou, sem material novo, se vieram respostas ou erros. Depois,
// só quando houver, o que ficou de fora por estar incompleto (fora, de readBackup) e o nome do perfil que entrou.
export function backupNote(atual, junto, fora = {}, perfil = '') {
  const materials = junto.saved.length - atual.saved.length;
  const main = materials ? (materials === 1 ? '1 material importado' : materials + ' materiais importados')
    : junto.events.length > atual.events.length || JSON.stringify(junto.erros) !== JSON.stringify(atual.erros)
      ? 'Desempenho e caderno de erros atualizados'
      : 'Nada novo neste arquivo';
  const left = countList(backupItems(fora).filter(([n]) => n > 0));
  const parts = [
    main, left && 'Ficaram de fora, por estarem incompletos: ' + left, perfil && 'Perfil de ' + perfil + ' importado',
  ].filter(Boolean);
  // Uma frase só fica como sempre, sem ponto; com mais de uma, cada uma termina com ponto.
  return parts.length > 1 ? parts.join('. ') + '.' : main;
}

// Linha do backup no pé da Biblioteca e do Desempenho. last é a data do último backup, em texto ISO; valor inválido
// vale como nunca. Novo é o material ou a resposta com data depois dele. Os dias contam pelo calendário, no fuso do
// aluno: backup ontem às 23h, conferido à 1h, foi "há 1 dia". due (lembrar o backup) quando há algo novo e são 5
// materiais novos ou 7 dias ou mais desde o backup (sem backup, desde o registro mais antigo).
export function backupStatus({ saved, events, last, now }) {
  const done = isDate(last);
  const since = done ? Date.parse(last) : -Infinity;
  const newer = list => list.map(x => Date.parse(x?.date)).filter(time => time > since);
  const materials = newer(saved);
  const fresh = [...materials, ...newer(events)];
  const noon = date => Date.parse(localDay(date) + 'T12:00');
  const daysTo = date => Math.round((noon(now) - noon(date)) / 864e5);
  const age = done ? daysTo(last) : fresh.length ? daysTo(fresh.reduce((a, b) => Math.min(a, b))) : 0;
  return {
    text: !done ? 'Você ainda não fez backup'
      : 'Último backup: ' + (age < 1 ? 'hoje' : age === 1 ? 'há 1 dia' : 'há ' + age + ' dias'),
    due: fresh.length > 0 && (materials.length >= 5 || age >= 7),
  };
}
