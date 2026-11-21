// "Abrir arquivo" do editor do Estudar (#84): o PDF, o TXT e o MD são lidos aqui, no navegador, e o arquivo não sai
// do computador; só o texto que fica no editor vai para a IA, quando o aluno gera o material. Este arquivo vem à parte,
// no primeiro uso (App.jsx, openFile), e o leitor de PDF (pdf.js, na versão fixa do package.json) só quando o arquivo
// é um PDF: nenhum dos dois entra no JavaScript da abertura. As regras puras estão em tests/arquivo.test.js.
import { MAX_INPUT, capText, fold } from './lib.js';

// O arquivo mais pesado que o editor abre: 20 MB, contados como o Windows conta.
const MAX_FILE = 20 * 1024 * 1024;

// Frase de cada arquivo que não abre, para o aluno: o que houve e o que ele pode fazer.
export const FILE_ERRORS = {
  tipo: 'Este tipo de arquivo não abre aqui. Abra um PDF, um TXT ou um MD.',
  office: 'Arquivos do Word e do PowerPoint não abrem aqui. ' +
    'Salve o arquivo como PDF (Arquivo > Salvar como > PDF) e abra o PDF.',
  grande: 'O arquivo passa de 20 MB. Salve só as páginas que vai estudar num PDF menor e abra esse.',
  vazio: 'O arquivo está vazio.',
  leitura: 'Não foi possível ler o arquivo. Tente abrir de novo.',
  leitor: 'Não foi possível carregar o leitor de PDF. Recarregue a página e tente de novo.',
  senha: 'Este PDF tem senha. Abra no seu leitor de PDF, salve uma cópia sem senha e abra a cópia aqui.',
  imagem: 'Este PDF não tem texto, só imagem: parece digitalizado. ' +
    'Cole o texto no editor ou peça o arquivo original.',
  pdf: 'Não foi possível ler este PDF. ' +
    'Se ele abre no seu leitor de PDF, salve uma cópia por lá e abra a cópia aqui.',
};

// Erro de um arquivo que não abre, no formato dos erros da IA (App.jsx, Problem): a frase para o aluno (message) e os
// detalhes técnicos (tech). code diz ao App que a frase é daqui.
function problem(code, cause) {
  return Object.assign(Error(FILE_ERRORS[code]), { code, tech: cause ? String(cause) : '' });
}

// O tipo do arquivo pela extensão ou, sem uma conhecida, pelo tipo que o navegador informou (no celular o nome pode
// vir sem extensão): 'pdf', 'texto' (TXT e MD), 'office' (Word, PowerPoint e os do LibreOffice, que pedem o PDF) ou ''.
export function fileKind({ name, type }) {
  const ext = /\.(\w+)$/.exec(name)?.[1].toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'txt' || ext === 'md') return 'texto';
  if (/^(docx?|odt|rtf|pptx?|odp)$/.test(ext)) return 'office';
  return type === 'application/pdf' ? 'pdf' : /^text\/(plain|markdown)$/.test(type) ? 'texto' : '';
}

// Texto de um TXT ou MD. O Bloco de Notas antigo grava em Windows-1252 (o "ANSI") ou em UTF-16 (o "Unicode", que
// começa com a marca FF FE): o que não é UTF-8 válido é lido como Windows-1252, e "ação" e "você" chegam com os acentos
// certos. A quebra de linha do Windows vira a do editor.
export function decodeText(bytes) {
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : '';
  let text;
  try {
    text = new TextDecoder(utf16 || 'utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/\r\n?/g, '\n');
}

// As linhas de uma página do PDF, dos pedaços de texto do pdf.js (getTextContent): cada um traz o texto (str), se a
// linha acaba nele (hasEOL) e a posição (transform, com a altura no índice 5, que cresce para cima). Um espaço até a
// linha de baixo bem maior que o comum da página separa parágrafos (ou o título do texto) e vira uma linha vazia. O
// comum sai da própria página, o do primeiro quarto dos espaços em ordem, e não de um número fixo: com o espaçamento
// 1,5 das normas da ABNT cada linha virava um parágrafo. A mediana falhava com parágrafos de duas linhas.
export function pdfLines(items) {
  const lines = [];
  let line = null;
  for (const item of items) {
    line ||= { text: '', y: null };
    line.text += item.str;
    if (line.y === null && item.str.trim()) line.y = item.transform[5];
    if (item.hasEOL) {
      lines.push(line);
      line = null;
    }
  }
  if (line) lines.push(line);
  const full = lines.filter(l => l.y !== null);
  const gaps = full.slice(1).map((l, i) => full[i].y - l.y).filter(gap => gap > 0).sort((a, b) => a - b);
  const usual = gaps[Math.floor(gaps.length / 4)];
  return full.flatMap((l, i) => (i && full[i - 1].y - l.y > usual * 1.3 ? ['', l.text] : [l.text]));
}

// As pontas de uma página: as 3 primeiras e as 3 últimas linhas com texto, onde ficam o cabeçalho, o rodapé e o
// número da página. O pdf.js segue a ordem em que o PDF desenha, e o rodapé às vezes vem logo depois do cabeçalho.
function edges(lines) {
  const full = lines.flatMap((line, i) => (line.trim() ? [i] : []));
  return new Set([...full.slice(0, 3), ...full.slice(-3)]);
}

// Linha só com o número da página: "3", "- 3 -", "3/10".
const PAGE_NUMBER = /^[\s\-–—]*\d{1,4}(\s*\/\s*\d{1,4})?[\s\-–—]*$/;

// O texto limpo de cada página do PDF (pages: as linhas de cada página, de pdfLines). Nas pontas da página sai a linha
// que só tem o número da página e, com 3 páginas ou mais, a que se repete em pelo menos metade delas: o cabeçalho e o
// rodapé. A comparação não liga para maiúsculas e acentos e troca os números por #: "Página 3" e "Página 4" são iguais.
export function pdfText(pages) {
  const key = line => fold(line).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  const count = new Map();
  for (const lines of pages) {
    for (const k of new Set([...edges(lines)].map(i => key(lines[i])))) count.set(k, (count.get(k) || 0) + 1);
  }
  const noise = line => PAGE_NUMBER.test(line) || (pages.length >= 3 && count.get(key(line)) >= pages.length / 2);
  return pages.map(lines => {
    const edge = edges(lines);
    return reflow(lines.filter((line, i) => !edge.has(i) || !noise(line)));
  });
}

// Fim de linha com a palavra cortada por hífen (o comum ou o invisível, que só aparece na quebra).
const BROKEN = /\p{L}[-\u00ad\u2010]$/u;

// Junta a linha ao texto. A que começa com minúscula continua a frase: com um espaço ou, depois da palavra cortada por
// hífen, colada, sem o hífen ("fotos-" e "síntese" dão "fotossíntese"). As outras (título, item de lista, frase nova)
// vão depois de sep: a quebra de linha, ou a linha em branco entre parágrafos e entre páginas.
function join(text, line, sep) {
  if (!text) return line;
  if (!/^\p{Ll}/u.test(line)) return text + sep + line;
  return BROKEN.test(text) ? text.slice(0, -1) + line : text + ' ' + line;
}

// Uma página em texto corrido (join); a linha vazia de pdfLines vira a linha em branco entre parágrafos.
function reflow(lines) {
  let text = '';
  let gap = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line) text = join(text, line, gap ? '\n\n' : '\n');
    gap = !line;
  }
  return text;
}

// O texto das páginas de from a to (contadas de 1), o que vai para o editor: as páginas sem texto saem, e a frase que
// continua na página seguinte volta a ficar inteira (join).
export function pageSpan(pages, from, to) {
  return pages.slice(from - 1, to).filter(Boolean).reduce((text, page) => join(text, page, '\n\n'), '');
}

// Quantas páginas, do começo, cabem no editor: a escolha de páginas começa com elas (pelo menos a primeira).
export function firstPages(pages) {
  let to = 1;
  while (to < pages.length && pageSpan(pages, 1, to + 1).length <= MAX_INPUT) to++;
  return to;
}

// As linhas de cada página do PDF (pdfLines). O pdf.js e o worker dele (o arquivo que lê o PDF fora da tela, que o
// build copia do próprio pacote) só chegam agora. É a versão legacy do pacote: a outra usa recursos de JavaScript que
// só os navegadores mais novos têm, e o PDF não abriria num celular com o sistema atrasado.
async function readPdf(bytes) {
  let pdfjs;
  try {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs = lib;
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch (e) {
    throw problem('leitor', e);
  }
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      pages.push(pdfLines((await page.getTextContent()).items));
    }
    return pages;
  } catch (e) {
    // O worker que não carrega (servidor que não manda o .mjs como JavaScript, rede caída) não é defeito do PDF.
    throw problem(e?.name === 'PasswordException' ? 'senha' : /worker/i.test(e?.message) ? 'leitor' : 'pdf', e);
  } finally {
    task.destroy();
  }
}

// Lê o arquivo escolhido ou solto no editor. Devolve { text, cut } (cut: o texto passou do limite do editor, e entrou
// só o começo) ou, no PDF de mais de uma página com mais texto que o editor recebe, { pages }, para a escolha de
// páginas. O que não abre sai como erro (problem).
export async function readFile(file) {
  const kind = fileKind(file);
  if (kind !== 'pdf' && kind !== 'texto') throw problem(kind || 'tipo');
  if (file.size > MAX_FILE) throw problem('grande');
  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (e) {
    throw problem('leitura', e);
  }
  let text;
  if (kind === 'texto') {
    text = decodeText(bytes).trim();
    if (!text) throw problem('vazio');
  } else {
    const pages = pdfText(await readPdf(bytes));
    // Digitalizado: só imagem, sem uma letra de texto em página nenhuma.
    if (!pages.some(page => /\p{L}/u.test(page))) throw problem('imagem');
    text = pageSpan(pages, 1, pages.length);
    if (text.length > MAX_INPUT && pages.length > 1) return { pages };
  }
  return { text: capText(text), cut: text.length > MAX_INPUT };
}
