"""Gera o ícone e a splash do Uni Jovem (direção A, Aurora): sol nascendo no horizonte."""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

DESTINO = Path(sys.argv[1])
ESCALA = 4  # supersampling para bordas suaves

NOITE = (18, 16, 42)
VIOLETA = (58, 42, 120)
LILAS = (157, 143, 255)
CORAL = (255, 138, 101)
OURO = (255, 209, 102)
BRANCO = (255, 255, 255)


def misturar(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ceu(lado):
    """Gradiente vertical: noite no topo, violeta no meio, brilho coral no horizonte."""
    img = Image.new('RGB', (lado, lado))
    px = img.load()
    for y in range(lado):
        t = y / (lado - 1)
        if t < 0.55:
            cor = misturar(NOITE, VIOLETA, t / 0.55)
        else:
            cor = misturar(VIOLETA, (150, 70, 110), (t - 0.55) / 0.45)
        for x in range(lado):
            px[x, y] = cor
    return img


def simbolo(lado, cor_sol=None, cor_raio=None, monocromatico=False):
    """Sol nascendo (meio disco), raios e linha do horizonte, em camada transparente.
    Ocupa a área segura central (cerca de 60% do lado)."""
    s = lado * ESCALA
    camada = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    cx = s / 2
    horizonte = s * 0.62
    raio = s * 0.2
    sol_a = BRANCO if monocromatico else (cor_sol or CORAL)
    sol_b = BRANCO if monocromatico else OURO
    raio_cor = BRANCO if monocromatico else (cor_raio or OURO)

    # Disco do sol com gradiente (ouro em cima, coral embaixo), cortado no horizonte.
    disco = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    dd = ImageDraw.Draw(disco)
    topo = horizonte - raio
    for y in range(int(topo), int(horizonte) + 1):
        t = (y - topo) / raio
        cor = misturar(sol_b, sol_a, t)
        meia = math.sqrt(max(raio * raio - (horizonte - y) ** 2, 0))
        dd.line([(cx - meia, y), (cx + meia, y)], fill=cor + (255,))
    camada.alpha_composite(disco)

    # Raios: cinco traços arredondados em leque.
    espessura = s * 0.034
    for ang in (-60, -30, 0, 30, 60):
        a = math.radians(ang - 90)
        r1 = raio * 1.32
        r2 = raio * 1.72
        x1, y1 = cx + r1 * math.cos(a), horizonte + r1 * math.sin(a)
        x2, y2 = cx + r2 * math.cos(a), horizonte + r2 * math.sin(a)
        d.line([(x1, y1), (x2, y2)], fill=raio_cor + (255,), width=int(espessura))
        for (x, y) in ((x1, y1), (x2, y2)):
            d.ellipse([x - espessura / 2, y - espessura / 2, x + espessura / 2, y + espessura / 2], fill=raio_cor + (255,))

    # Horizonte: faixa arredondada sob o sol.
    altura = s * 0.036
    largura = s * 0.56
    d.rounded_rectangle(
        [cx - largura / 2, horizonte + s * 0.03, cx + largura / 2, horizonte + s * 0.03 + altura],
        radius=altura / 2,
        fill=(BRANCO if monocromatico else (255, 236, 220)) + (255,),
    )
    # Segunda faixa menor: reflexo, dá leitura de "comunidade reunida no amanhecer".
    largura2 = s * 0.34
    y2 = horizonte + s * 0.03 + altura * 2.4
    d.rounded_rectangle(
        [cx - largura2 / 2, y2, cx + largura2 / 2, y2 + altura],
        radius=altura / 2,
        fill=(BRANCO if monocromatico else (255, 236, 220)) + (200 if not monocromatico else 255,),
    )
    return camada.resize((lado, lado), Image.LANCZOS)


def brilho(lado):
    """Halo suave atrás do sol."""
    s = lado
    h = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(h)
    cx, cy, r = s / 2, s * 0.62, s * 0.36
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CORAL + (90,))
    return h.filter(ImageFilter.GaussianBlur(s * 0.08))


def icone(lado=1024):
    base = ceu(lado).convert('RGBA')
    base.alpha_composite(brilho(lado))
    base.alpha_composite(simbolo(lado))
    return base.convert('RGB')  # iOS recusa transparência no ícone


def principal():
    DESTINO.mkdir(parents=True, exist_ok=True)
    icone().save(DESTINO / 'icon.png')

    # Android adaptativo: fundo e frente separados; a frente fica na área segura (66%).
    fundo = ceu(1024).convert('RGBA')
    fundo.alpha_composite(brilho(1024))
    fundo.convert('RGB').save(DESTINO / 'android-icon-background.png')
    frente = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    menor = simbolo(700)
    frente.alpha_composite(menor, (162, 162))
    frente.save(DESTINO / 'android-icon-foreground.png')
    mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    mono.alpha_composite(simbolo(700, monocromatico=True), (162, 162))
    mono.save(DESTINO / 'android-icon-monochrome.png')

    # Splash: só o símbolo, sobre o fundo noite definido no app.config.
    simbolo(1024).save(DESTINO / 'splash-icon.png')

    # Favicon da web.
    icone(512).resize((48, 48), Image.LANCZOS).save(DESTINO / 'favicon.png')


if __name__ == '__main__':
    principal()
