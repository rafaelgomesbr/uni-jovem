"""Gera packages/conteudo/src/versiculos.ts a partir do texto oficial da Bíblia Livre.

Uso:
    python -I scripts/conteudo/gerar_versiculos.py <porbr2018_vpl.txt> <saida.ts>

O arquivo de entrada é o "_vpl.txt" de https://ebible.org/Scriptures/porbr2018_vpl.zip
(Bíblia Livre, CC BY 4.0 Brasil). O texto é copiado SEM alteração: versículo
cujo texto começa com título de salmo é recusado (para não ter de cortar o
título), e o script falha se alguma referência não existir.
"""
import json
import sys

LIVROS = {
    'GEN': 'Gênesis', 'EXO': 'Êxodo', 'LEV': 'Levítico', 'NUM': 'Números', 'DEU': 'Deuteronômio',
    'JOS': 'Josué', 'JDG': 'Juízes', 'RUT': 'Rute', '1SA': '1 Samuel', '2SA': '2 Samuel',
    '1KI': '1 Reis', '2KI': '2 Reis', '1CH': '1 Crônicas', '2CH': '2 Crônicas', 'EZR': 'Esdras',
    'NEH': 'Neemias', 'EST': 'Ester', 'JOB': 'Jó', 'PSA': 'Salmos', 'PRO': 'Provérbios',
    'ECC': 'Eclesiastes', 'SOL': 'Cânticos', 'ISA': 'Isaías', 'JER': 'Jeremias',
    'LAM': 'Lamentações', 'EZE': 'Ezequiel', 'DAN': 'Daniel', 'HOS': 'Oseias', 'JOE': 'Joel',
    'AMO': 'Amós', 'OBA': 'Obadias', 'JON': 'Jonas', 'MIC': 'Miqueias', 'NAH': 'Naum',
    'HAB': 'Habacuque', 'ZEP': 'Sofonias', 'HAG': 'Ageu', 'ZEC': 'Zacarias', 'MAL': 'Malaquias',
    'MAT': 'Mateus', 'MAR': 'Marcos', 'LUK': 'Lucas', 'JOH': 'João', 'ACT': 'Atos',
    'ROM': 'Romanos', '1CO': '1 Coríntios', '2CO': '2 Coríntios', 'GAL': 'Gálatas',
    'EPH': 'Efésios', 'PHI': 'Filipenses', 'COL': 'Colossenses', '1TH': '1 Tessalonicenses',
    '2TH': '2 Tessalonicenses', '1TI': '1 Timóteo', '2TI': '2 Timóteo', 'TIT': 'Tito',
    'PHM': 'Filemom', 'HEB': 'Hebreus', 'JAM': 'Tiago', '1PE': '1 Pedro', '2PE': '2 Pedro',
    '1JO': '1 João', '2JO': '2 João', '3JO': '3 João', 'JUD': 'Judas', 'REV': 'Apocalipse',
}

# Seleção: versículos de ânimo, fé, serviço e convivência, pensados para jovens.
SELECAO = """
GEN 1:1; GEN 1:27; GEN 12:2; GEN 28:15; GEN 50:20; EXO 14:14; EXO 15:2; EXO 33:14;
NUM 6:24; NUM 6:25; NUM 6:26; NUM 23:19; DEU 6:5; DEU 31:6; DEU 31:8; DEU 7:9; DEU 30:19;
JOS 1:9; JOS 1:8; JOS 24:15; RUT 1:16; 1SA 16:7; 1SA 2:2; 1SA 12:24; 2SA 22:31; 2SA 22:2;
1KI 8:61; 1CH 16:11; 1CH 16:34; 1CH 29:11; 1CH 28:20; 2CH 7:14; 2CH 16:9; 2CH 20:15;
EZR 10:4; NEH 8:10; NEH 9:6; JOB 19:25; JOB 42:2; JOB 1:21;
PSA 1:2; PSA 1:3; PSA 3:3; PSA 4:8; PSA 5:3; PSA 8:4; PSA 9:1; PSA 9:10; PSA 16:8;
PSA 16:11; PSA 18:2; PSA 19:14; PSA 23:4; PSA 23:6; PSA 25:4; PSA 25:5; PSA 27:14;
PSA 28:7; PSA 30:5; PSA 31:24; PSA 32:8; PSA 34:4; PSA 34:8; PSA 34:18; PSA 37:4; PSA 37:5;
PSA 37:7; PSA 42:11; PSA 46:10; PSA 51:10; PSA 55:22; PSA 56:3; PSA 57:10; PSA 62:8;
PSA 63:3; PSA 66:20; PSA 71:14; PSA 73:26; PSA 84:11; PSA 86:5; PSA 90:12; PSA 91:1;
PSA 91:2; PSA 91:11; PSA 94:19; PSA 95:6; PSA 96:1; PSA 100:4; PSA 100:5; PSA 103:2;
PSA 103:12; PSA 107:1; PSA 112:7; PSA 115:1; PSA 118:24; PSA 119:9; PSA 119:11;
PSA 119:105; PSA 119:114; PSA 121:2; PSA 121:8; PSA 126:5; PSA 133:1; PSA 136:1;
PSA 138:8; PSA 139:14; PSA 139:23; PSA 143:8; PSA 145:18; PSA 147:3; PSA 150:6;
PSA 4:1; PSA 18:1; PSA 18:30; PSA 27:4; PSA 31:3; PSA 33:4; PSA 36:5; PSA 40:3; PSA 46:2;
PSA 48:14; PSA 59:16; PSA 61:2; PSA 65:11; PSA 68:19; PSA 89:1; PSA 92:1; PSA 97:11;
PSA 103:8; PSA 106:1; PSA 113:3; PSA 116:1; PSA 118:6; PSA 118:14; PSA 119:50;
PSA 119:165; PSA 119:130; PSA 130:5; PSA 141:3; PSA 145:3; PSA 145:9; PSA 146:5;
PRO 1:7; PRO 3:5; PRO 3:6; PRO 4:23; PRO 9:10; PRO 10:12; PRO 11:25; PRO 12:25; PRO 14:29;
PRO 15:1; PRO 16:3; PRO 16:9; PRO 17:17; PRO 18:10; PRO 18:24; PRO 19:21; PRO 20:24;
PRO 22:6; PRO 27:17; PRO 3:27; PRO 13:20; PRO 16:24; PRO 21:21; PRO 31:30; PRO 2:6;
PRO 4:18; PRO 11:2; PRO 12:22; PRO 15:13; PRO 17:22; PRO 19:17; PRO 25:11; PRO 28:13;
ECC 3:1; ECC 3:11; ECC 4:9; ECC 4:12; ECC 12:1; ECC 9:10; SOL 8:7;
ISA 6:8; ISA 9:6; ISA 12:2; ISA 26:3; ISA 26:4; ISA 30:15; ISA 40:8; ISA 40:29; ISA 40:31;
ISA 41:10; ISA 41:13; ISA 43:1; ISA 43:2; ISA 43:19; ISA 49:15; ISA 49:16; ISA 53:5;
ISA 54:10; ISA 55:6; ISA 55:8; ISA 55:9; ISA 58:11; ISA 60:1; ISA 61:1; ISA 64:8; ISA 65:24;
ISA 25:1; ISA 40:11; ISA 46:4; ISA 52:7; ISA 57:15;
JER 17:7; JER 29:11; JER 29:12; JER 29:13; JER 31:3; JER 32:17; JER 33:3; JER 15:16;
LAM 3:22; LAM 3:23; LAM 3:25; LAM 3:26; EZE 36:26; DAN 2:20; DAN 12:3; HOS 6:3; JOE 2:28;
JOE 2:13; MIC 6:8; MIC 7:7; NAH 1:7; HAB 3:17; HAB 3:18; HAB 3:19; ZEP 3:17; HAG 2:4;
ZEC 4:6; MAL 3:10;
MAT 4:4; MAT 5:3; MAT 5:4; MAT 5:5; MAT 5:6; MAT 5:7; MAT 5:8; MAT 5:9; MAT 5:14; MAT 5:16;
MAT 5:44; MAT 6:6; MAT 6:21; MAT 6:33; MAT 6:34; MAT 7:7; MAT 7:12; MAT 11:28; MAT 11:29;
MAT 16:24; MAT 18:20; MAT 19:26; MAT 22:37; MAT 22:39; MAT 28:19; MAT 28:20; MAT 5:13;
MAT 6:26; MAT 10:31; MAT 17:20; MAT 21:22; MAT 24:35; MAT 25:40; MAT 9:37; MAT 20:28;
MAR 9:23; MAR 10:27; MAR 10:45; MAR 11:24; MAR 12:30; MAR 16:15; MAR 1:35; MAR 5:36;
LUK 1:37; LUK 1:45; LUK 2:52; LUK 6:31; LUK 6:38; LUK 9:23; LUK 10:27; LUK 11:9; LUK 12:34;
LUK 15:7; LUK 18:27; LUK 19:10; LUK 6:36; LUK 12:7; LUK 16:10; LUK 21:33;
JOH 1:1; JOH 1:5; JOH 1:12; JOH 3:16; JOH 3:17; JOH 4:14; JOH 6:35; JOH 8:12; JOH 8:32;
JOH 8:36; JOH 10:10; JOH 10:11; JOH 10:27; JOH 11:25; JOH 13:34; JOH 13:35; JOH 14:1;
JOH 14:6; JOH 14:27; JOH 15:5; JOH 15:7; JOH 15:12; JOH 15:13; JOH 15:16; JOH 16:33;
JOH 17:17; JOH 20:29; JOH 14:21; JOH 3:30; JOH 6:37; JOH 7:38; JOH 12:46;
ACT 1:8; ACT 2:42; ACT 4:12; ACT 16:31; ACT 20:35; ACT 17:28; ACT 2:21;
ROM 1:16; ROM 3:23; ROM 5:1; ROM 5:5; ROM 5:8; ROM 6:23; ROM 8:1; ROM 8:18; ROM 8:28;
ROM 8:31; ROM 8:37; ROM 8:38; ROM 8:39; ROM 10:9; ROM 10:17; ROM 12:1; ROM 12:2; ROM 12:10;
ROM 12:12; ROM 12:21; ROM 15:13; ROM 13:8; ROM 14:19; ROM 15:7; ROM 12:18;
1CO 2:9; 1CO 6:19; 1CO 10:13; 1CO 10:31; 1CO 13:4; 1CO 13:7; 1CO 13:13; 1CO 15:58;
1CO 16:13; 1CO 16:14; 1CO 1:9; 1CO 3:16; 1CO 12:27; 1CO 15:57;
2CO 4:16; 2CO 4:17; 2CO 4:18; 2CO 5:7; 2CO 5:17; 2CO 9:7; 2CO 12:9; 2CO 1:3; 2CO 3:17;
GAL 2:20; GAL 5:1; GAL 5:13; GAL 5:22; GAL 5:23; GAL 6:2; GAL 6:9; GAL 6:10; GAL 3:28;
EPH 2:8; EPH 2:10; EPH 3:20; EPH 4:2; EPH 4:29; EPH 4:32; EPH 5:2; EPH 6:10; EPH 6:11;
EPH 1:3; EPH 4:3; EPH 3:17; EPH 5:19;
PHI 1:6; PHI 1:21; PHI 2:3; PHI 2:4; PHI 2:5; PHI 3:13; PHI 3:14; PHI 4:4; PHI 4:6; PHI 4:7;
PHI 4:8; PHI 4:13; PHI 4:19; PHI 2:13; PHI 4:5;
COL 1:17; COL 2:6; COL 3:2; COL 3:12; COL 3:13; COL 3:14; COL 3:15; COL 3:17; COL 3:23;
COL 4:2; COL 4:6; COL 3:16;
1TH 4:11; 1TH 5:11; 1TH 5:16; 1TH 5:17; 1TH 5:18; 1TH 5:24; 1TH 5:15; 2TH 3:3; 2TH 3:13;
1TI 4:12; 1TI 6:6; 1TI 6:12; 1TI 2:1; 1TI 4:8; 2TI 1:7; 2TI 2:15; 2TI 2:22; 2TI 3:16;
2TI 4:7; 2TI 1:9; TIT 2:7; TIT 3:5; PHM 1:6;
HEB 4:12; HEB 4:16; HEB 10:23; HEB 10:24; HEB 10:25; HEB 11:1; HEB 11:6; HEB 12:1;
HEB 12:2; HEB 13:5; HEB 13:8; HEB 13:16; HEB 6:19; HEB 13:2; HEB 12:11;
JAM 1:2; JAM 1:3; JAM 1:5; JAM 1:12; JAM 1:17; JAM 1:19; JAM 1:22; JAM 4:7; JAM 4:8;
JAM 5:16; JAM 4:10; JAM 2:17; JAM 3:17;
1PE 2:9; 1PE 3:15; 1PE 4:8; 1PE 4:10; 1PE 5:6; 1PE 5:7; 1PE 5:10; 1PE 1:3; 1PE 3:8;
2PE 1:3; 2PE 3:9; 2PE 3:18;
1JO 1:7; 1JO 1:9; 1JO 3:1; 1JO 3:18; 1JO 4:4; 1JO 4:7; 1JO 4:8; 1JO 4:10; 1JO 4:18; 1JO 4:19;
1JO 5:4; 1JO 5:14; 1JO 2:17; 1JO 3:16; 3JO 1:2; JUD 1:24; JUD 1:25; JUD 1:21;
REV 3:20; REV 21:4; REV 21:5; REV 22:13; REV 1:8; REV 4:11; REV 3:8; REV 7:17
"""

TITULOS = ('Salmo', 'Ao regente', 'Oração', 'Mictão', 'Masquil', 'Cântico', 'Hino', 'Para o músico')


def principal(entrada, saida):
    textos = {}
    with open(entrada, encoding='utf-8') as f:
        for linha in f:
            codigo, resto = linha.rstrip('\n').split(' ', 1)
            ref, texto = resto.split(' ', 1)
            textos[f'{codigo} {ref}'] = texto.strip()

    vistos, itens, recusados = set(), [], []
    for bruto in SELECAO.replace('\n', ' ').split(';'):
        ref = bruto.strip()
        if not ref or ref in vistos:
            continue
        vistos.add(ref)
        if ref not in textos:
            raise SystemExit(f'Referência inexistente no texto: {ref}')
        texto = textos[ref]
        if texto.startswith(TITULOS):
            recusados.append(ref)
            continue
        codigo, cv = ref.split(' ')
        cap, ver = cv.split(':')
        livro = LIVROS[codigo]
        legivel = f'{livro} {ver}' if codigo in ('PHM', '2JO', '3JO', 'JUD', 'OBA') else f'{livro} {cap}:{ver}'
        itens.append({'referencia': legivel, 'texto': texto})

    if recusados:
        print('Recusados por começarem com título de salmo:', ', '.join(recusados), file=sys.stderr)
    if len(itens) < 366:
        raise SystemExit(f'Só {len(itens)} versículos válidos; são necessários 366.')
    itens = itens[:366]

    corpo = ',\n'.join(
        f'  {{ referencia: {json.dumps(i["referencia"], ensure_ascii=False)}, texto: {json.dumps(i["texto"], ensure_ascii=False)} }}'
        for i in itens
    )
    with open(saida, 'w', encoding='utf-8', newline='\n') as f:
        f.write(
            '// Gerado por scripts/conteudo/gerar_versiculos.py a partir do texto oficial da\n'
            '// Bíblia Livre (eBible.org, porbr2018). Não edite à mão: o texto é citado sem\n'
            '// alteração, como pede a licença CC BY 4.0 Brasil.\n\n'
            "import type { Versiculo } from './tipos.ts'\n\n"
            f'export const VERSICULOS: readonly Versiculo[] = [\n{corpo},\n]\n'
        )
    print(f'{len(itens)} versículos gravados em {saida}')


if __name__ == '__main__':
    principal(sys.argv[1], sys.argv[2])
