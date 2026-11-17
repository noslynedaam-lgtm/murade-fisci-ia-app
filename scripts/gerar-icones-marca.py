#!/usr/bin/env python3
"""Gera os ícones do app instalável/favicon do Murade Fisco IA na cor de marca (roxo).

Parte da arte original (scripts/icones-base/original-512.png, símbolo + texto intactos),
desloca o matiz do fundo azul-marinho para roxo, acrescenta halo luminoso roxo ao redor do símbolo
e um aro luminoso na borda. Para trocar a cor: ajuste MARCA/MARCA_ESCURA/MARCA_CLARA abaixo
(e src/config/marca.ts + src/index.css) e rode:  python3 scripts/gerar-icones-marca.py
"""
import colorsys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
MARCA = (0x7c, 0x3a, 0xed)
MARCA_ESCURA = (0x5b, 0x21, 0xb6)
MARCA_CLARA = (0xed, 0xe9, 0xfe)

def matiz(rgb):
    return colorsys.rgb_to_hsv(*[c / 255 for c in rgb])[0]

def recolorir(img):
    """Fundo azul-marinho -> tonalidade roxa; prata do símbolo e do texto permanece."""
    arr = np.asarray(img.convert('RGBA')).astype(np.float32) / 255
    rgb, alfa = arr[..., :3], arr[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    peso = np.clip(sat / 0.22, 0, 1)                       # só tinge o que é colorido (fundo), poupa o prata
    h2 = h * (1 - peso) + matiz(MARCA_ESCURA) * peso
    s2 = np.clip(sat * 1.15 + 0.10 * peso, 0, 1)
    v2 = np.clip(mx * (1 + 0.10 * peso), 0, 1)
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p, q, t = v2 * (1 - s2), v2 * (1 - f * s2), v2 * (1 - (1 - f) * s2)
    canais = [(v2, t, p), (q, v2, p), (p, v2, t), (p, q, v2), (t, p, v2), (v2, p, q)]
    out = np.stack([np.choose(i, [c[k] for c in canais]) for k in range(3)], -1)
    return Image.fromarray((np.concatenate([out, alfa], -1) * 255).astype(np.uint8), 'RGBA')

def screen(base, camada):
    a = np.asarray(base).astype(np.float32) / 255
    c = np.asarray(camada).astype(np.float32) / 255
    ca = c[..., 3:]
    rgb = 1 - (1 - a[..., :3]) * (1 - c[..., :3] * ca)
    return Image.fromarray((np.concatenate([rgb, a[..., 3:]], -1) * 255).astype(np.uint8), 'RGBA')

def com_halo(img):
    n = img.width
    halo = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(halo)
    cx, cy, r = n * 0.46, n * 0.42, n * 0.33                # centro do símbolo (arte original)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MARCA + (150,))
    halo = halo.filter(ImageFilter.GaussianBlur(n * 0.07))
    out = screen(img, halo)
    aro = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ad = ImageDraw.Draw(aro)
    m = max(2, int(n * 0.012))
    ad.rounded_rectangle([m, m, n - m, n - m], radius=int(n * 0.19), outline=MARCA_CLARA + (230,), width=max(2, int(n * 0.018)))
    brilho = aro.filter(ImageFilter.GaussianBlur(n * 0.018))
    out = screen(out, brilho)
    mascara = Image.new('L', img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.2), fill=255)
    out.putalpha(mascara)
    return Image.alpha_composite(Image.new('RGBA', img.size, (0, 0, 0, 0)), out)

def main():
    base = Image.open(RAIZ / 'scripts/icones-base/original-512.png').convert('RGBA')
    mestre = com_halo(recolorir(base))
    saidas = {'icone-app-512.png': 512, 'icone-app-192.png': 192, 'favicon-48.png': 48}
    for nome, lado in saidas.items():
        (mestre if lado == 512 else mestre.resize((lado, lado), Image.LANCZOS)).save(RAIZ / 'public' / nome, optimize=True)
    # iOS não aceita transparência: cantos viram o roxo escuro da marca e o próprio iOS arredonda.
    fundo = Image.new('RGBA', (180, 180), MARCA_ESCURA + (255,))
    ios = mestre.resize((180, 180), Image.LANCZOS)
    fundo.alpha_composite(ios)
    fundo.convert('RGB').save(RAIZ / 'public/apple-touch-icon.png', optimize=True)

if __name__ == '__main__':
    main()
