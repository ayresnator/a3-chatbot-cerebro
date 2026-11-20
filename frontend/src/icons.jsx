import React from 'react';

// Ícones do app, desenhados para o Cérebro: grade de 24, traço único de 1,75 px (styles.css, .icon), cor do texto.
// Ficam fora da árvore de acessibilidade: o nome de cada controle vem do texto dele ou do aria-label, nunca do ícone.
const PATHS = {
  // Seções (a mesma ordem do menu)
  estudar: 'M5 19l.9-3.6L15.7 5.6a1.8 1.8 0 0 1 2.6 0l.1.1a1.8 1.8 0 0 1 0 2.6L8.6 18.1zM14 7.3l2.7 2.7M13.5 20.5H20',
  duvidas: 'M20 11.5a7.5 7.5 0 0 1-10.6 6.8L5 19.5l1.2-4A7.5 7.5 0 1 1 20 11.5zM10.4 9.4a2.1 2.1 0 1 1 3 1.9c-.7.3-1.1.8-1.1 1.5v.3M12.3 15.6v.01',
  resumos: 'M5 6h14M5 10h14M5 14h14M5 18h8',
  flashcards: 'M6 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM8 5h10a2 2 0 0 1 2 2v8',
  quizzes: 'M4 6.5l1.6 1.6L8.5 5M4 12.5l1.6 1.6L8.5 11M6.2 19.8a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM11.5 7h8.5M11.5 13h8.5M11.5 18.5h8.5',
  erros: 'M7 3.5h7.5L19 8v12.5H7zM14.5 3.5V8H19M10.5 12.5l4 4M14.5 12.5l-4 4',
  desempenho: 'M4 20h16M7 20v-5M12 20V8.5M17 20v-9',
  biblioteca: 'M5 4.5h3.5v15H5zM10.5 4.5H14v15h-3.5zM15.6 5.6l3.3-.9 3.1 14.1-3.3.9z',
  mais: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  // Editor e ações
  falar: 'M12 3.5a2.8 2.8 0 0 0-2.8 2.8v5.4a2.8 2.8 0 0 0 5.6 0V6.3A2.8 2.8 0 0 0 12 3.5zM6.2 11.5a5.8 5.8 0 0 0 11.6 0M12 17.3v3.2',
  exemplo: 'M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9zM13.5 3.5V9H19M8.5 13h7M8.5 16.5h4.5',
  limpar: 'M8.3 19.5l-4-4a1.4 1.4 0 0 1 0-2l8.6-8.6a1.4 1.4 0 0 1 2 0l4.6 4.6a1.4 1.4 0 0 1 0 2l-8 8zM8.3 19.5H20M9.2 9.2l6 6',
  desfazer: 'M8.5 13.5L4 9l4.5-4.5M4 9h10a6 6 0 0 1 0 12h-3',
  seta: 'M5 12h14M13 6l6 6-6 6',
  abrir: 'M8 16L16 8M9.5 8H16v6.5',
  fechar: 'M6 6l12 12M18 6L6 18',
  abaixo: 'M7 10l5 5 5-5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  salvar: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z',
  copiar: 'M9 8.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19v-9A1.5 1.5 0 0 1 9 8.5zM16 8.5V5a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 5v8.5A1.5 1.5 0 0 0 6 15h1.5',
  exportar: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  importar: 'M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 20h14',
  buscar: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.3 15.3L20 20',
  excluir: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10 11v5.5M14 11v5.5',
  refazer: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.7h-4.7',
  privacidade: 'M12 3.5l7 2.8v5.2c0 4.3-2.9 7.8-7 9-4.1-1.2-7-4.7-7-9V6.3zM9.3 12.2l1.9 1.9 3.6-3.8',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5M12 7.8v.01',
  alerta: 'M12 4.5l8.5 15h-17zM12 10v4.5M12 17v.01',
  // A tecla "/" da caixa do chat, que abre os atalhos.
  atalhos: 'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM14 8.5l-4 7',
};

export function Icon({ name, className = '' }) {
  return (
    <svg className={'icon ' + className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

// A marca do Cérebro no app: a faísca de oito raios em preto sobre o círculo ciano, como no favicon.
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="16" />
      <path d="M16 7.5v5.2M16 19.3v5.2M7.5 16h5.2M19.3 16h5.2M10 10l3.7 3.7M18.3 18.3L22 22M10 22l3.7-3.7M18.3 13.7L22 10" />
    </svg>
  );
}
