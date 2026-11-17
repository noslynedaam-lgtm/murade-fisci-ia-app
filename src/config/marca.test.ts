import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARCA } from './marca.ts';

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('contraste AA: texto branco sobre a cor, a escura e o menu; texto escuro sobre a clara', () => {
  assert.ok(contraste('#ffffff', MARCA.cor) >= 4.5);
  assert.ok(contraste('#ffffff', MARCA.escura) >= 4.5);
  assert.ok(contraste('#ffffff', MARCA.menu) >= 4.5);
  assert.ok(contraste(MARCA.escura, MARCA.clara) >= 4.5); // texto roxo escuro sobre fundo claro
  assert.ok(contraste(MARCA.cor, '#ffffff') >= 4.5);      // texto/ícone roxo sobre branco
});

test('tokens do CSS, theme-color, manifest e service worker seguem a constante', () => {
  const css = ler('src/index.css');
  assert.match(css, new RegExp(`--marca:\\s*${MARCA.cor}`, 'i'));
  assert.match(css, new RegExp(`--marca-escura:\\s*${MARCA.escura}`, 'i'));
  assert.match(css, new RegExp(`--marca-clara:\\s*${MARCA.clara}`, 'i'));
  assert.match(css, new RegExp(`--marca-menu:\\s*${MARCA.menu}`, 'i'));
  assert.match(ler('index.html'), new RegExp(`name="theme-color" content="${MARCA.escura}"`, 'i'));
  const m = JSON.parse(ler('public/manifest.webmanifest'));
  assert.equal(m.theme_color.toLowerCase(), MARCA.escura);
  assert.equal(m.background_color.toLowerCase(), MARCA.escura);
  const v = /\?v=(\d+)/.exec(ler('index.html'))![1];
  assert.ok(m.icons.every((i: { src: string }) => i.src.endsWith(`?v=${v}`)));
  assert.match(ler('public/sw.js'), new RegExp(`murade-casca-v${v}'`));
});
