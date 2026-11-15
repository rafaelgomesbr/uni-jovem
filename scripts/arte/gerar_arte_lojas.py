"""Gera a arte das lojas: ícone 512x512 (Google Play) e imagem de destaque 1024x500.

Uso: python -I scripts/arte/gerar_arte_lojas.py docs/lojas/arte
Reaproveita o desenho do ícone (gerar_icone.py): sol nascendo sobre o horizonte.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from gerar_icone import icone, simbolo, NOITE, VIOLETA, CORAL  # noqa: E402

destino = Path(sys.argv[1]); destino.mkdir(parents=True, exist_ok=True)
icone(512).save(destino / 'icone-play-512.png')

L, A = 1024, 500
fundo = Image.new('RGB', (L, A), NOITE).convert('RGBA')
brilho = Image.new('RGBA', (L, A), (0, 0, 0, 0))
d = ImageDraw.Draw(brilho)
d.ellipse([L - 420, -260, L + 140, 300], fill=CORAL + (150,))
d.ellipse([-260, 120, 300, 680], fill=(124, 108, 255, 120))
fundo.alpha_composite(brilho.filter(ImageFilter.GaussianBlur(90)))
fundo.alpha_composite(simbolo(300), (L - 360, (A - 300) // 2))

RAIZ = Path(__file__).resolve().parents[2] / 'node_modules' / '@expo-google-fonts'
FONTES = {
    True: sorted((RAIZ / 'bricolage-grotesque' / '800ExtraBold').glob('*.ttf')),
    False: sorted((RAIZ / 'inter' / '400Regular').glob('*.ttf')),
}


def fonte(tamanho, negrito=True):
    for nome in [str(f) for f in FONTES[negrito]] + (['segoeuib.ttf'] if negrito else ['segoeui.ttf']):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            pass
    return ImageFont.load_default()

t = ImageDraw.Draw(fundo)
t.text((64, 150), 'Uni Jovem', font=fonte(92), fill=(245, 243, 255))
t.text((68, 268), 'A agenda da juventude,', font=fonte(38, False), fill=(201, 196, 236))
t.text((68, 316), 'num lugar só.', font=fonte(38, False), fill=(201, 196, 236))
fundo.convert('RGB').save(destino / 'destaque-play-1024x500.png')
print('ok')
