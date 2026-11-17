/**
 * Cor de marca do FISCO IA (roxo). Cada sistema Murade tem a sua:
 * DP azul, Escrita Fiscal verde, Contábil âmbar, FISCO IA roxo, Agente IA ciano.
 *
 * PARA TROCAR A COR: edite aqui, as variáveis --marca* em src/index.css, o theme-color de index.html,
 * theme_color/background_color de public/manifest.webmanifest e rode scripts/gerar-icones-marca.py.
 * O teste src/config/marca.test.ts confere que tudo continua igual e com contraste AA.
 */
export const MARCA = {
  nome: 'FISCO IA',
  cor: '#7c3aed',
  escura: '#5b21b6',
  clara: '#ede9fe',
  /** fundo da barra lateral: a mesma família, mais escura, para o item ativo (cor da marca) destacar */
  menu: '#2e1065',
} as const;
