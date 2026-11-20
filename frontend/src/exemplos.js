// Exemplos prontos do Estudar, num arquivo à parte (11 kB): só a caixa do editor (a frase de exemplo do campo vazio) e
// o clique em "Usar um exemplo" usam, e eles saíram do JavaScript da abertura. A caixa os busca quando monta, e o
// App.jsx espera por eles no clique. Lógica pura, como o lib.js: tests/lib.test.js confere.
import { AREAS, EXAMPLE, fold } from './lib.js';

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
