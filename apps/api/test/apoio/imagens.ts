import { crc32, deflateSync } from 'node:zlib'
import sharp from 'sharp'

/** Imagem lisa (com um degradê, para não ser trivial) no formato pedido. */
export async function imagem(
  formato: 'jpeg' | 'png' | 'webp' | 'gif',
  largura: number,
  altura: number,
): Promise<Buffer> {
  const base = sharp({
    create: { width: largura, height: altura, channels: 3, background: '#5B4BDB' },
  }).composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
           <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#f60"/></linearGradient></defs>
           <circle cx="${largura / 2}" cy="${altura / 2}" r="${Math.min(largura, altura) / 3}" fill="url(#g)"/>
         </svg>`,
      ),
    },
  ])
  return base.toFormat(formato).toBuffer()
}

/** Texto que identifica o bloco EXIF de teste (fabricante da "câmera"). */
export const FABRICANTE_SECRETO = 'CameraSecretaUJ'

/**
 * Bloco EXIF montado à mão (TIFF little-endian), com fabricante, orientação e
 * coordenadas GPS (23°33'12.34"S 46°38'56.78"W). Montado byte a byte para o
 * teste não depender do escritor de EXIF da própria biblioteca que ele testa.
 */
function blocoExif(orientacao: number): Buffer {
  const fabricante = Buffer.from(`${FABRICANTE_SECRETO}\0`, 'latin1')
  const fabricantePar = fabricante.length % 2 ? fabricante.length + 1 : fabricante.length
  const ifd0 = 8
  const entradas0 = 3
  const fimIfd0 = ifd0 + 2 + entradas0 * 12 + 4
  const posFabricante = fimIfd0
  const ifdGps = posFabricante + fabricantePar
  const entradasGps = 4
  const posLatitude = ifdGps + 2 + entradasGps * 12 + 4
  const posLongitude = posLatitude + 24
  const tiff = Buffer.alloc(posLongitude + 24)

  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(ifd0, 4)

  const entrada = (pos: number, tag: number, tipo: number, qtd: number) => {
    tiff.writeUInt16LE(tag, pos)
    tiff.writeUInt16LE(tipo, pos + 2)
    tiff.writeUInt32LE(qtd, pos + 4)
    return pos + 8
  }
  let p = ifd0
  tiff.writeUInt16LE(entradas0, p)
  p += 2
  // Make (ASCII) -> área de dados
  tiff.writeUInt32LE(posFabricante, entrada(p, 0x010f, 2, fabricante.length))
  p += 12
  // Orientation (SHORT), valor no próprio campo
  tiff.writeUInt16LE(orientacao, entrada(p, 0x0112, 3, 1))
  p += 12
  // GPSInfo (LONG) -> IFD do GPS
  tiff.writeUInt32LE(ifdGps, entrada(p, 0x8825, 4, 1))
  p += 12
  tiff.writeUInt32LE(0, p)
  fabricante.copy(tiff, posFabricante)

  p = ifdGps
  tiff.writeUInt16LE(entradasGps, p)
  p += 2
  tiff.write('S\0', entrada(p, 0x0001, 2, 2), 'latin1')
  p += 12
  tiff.writeUInt32LE(posLatitude, entrada(p, 0x0002, 5, 3))
  p += 12
  tiff.write('W\0', entrada(p, 0x0003, 2, 2), 'latin1')
  p += 12
  tiff.writeUInt32LE(posLongitude, entrada(p, 0x0004, 5, 3))
  p += 12
  tiff.writeUInt32LE(0, p)
  const racionais = (pos: number, valores: [number, number][]) => {
    valores.forEach(([n, d], i) => {
      tiff.writeUInt32LE(n, pos + i * 8)
      tiff.writeUInt32LE(d, pos + i * 8 + 4)
    })
  }
  racionais(posLatitude, [
    [23, 1],
    [33, 1],
    [1234, 100],
  ])
  racionais(posLongitude, [
    [46, 1],
    [38, 1],
    [5678, 100],
  ])

  const corpo = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const cabecalho = Buffer.from([0xff, 0xe1, 0, 0])
  cabecalho.writeUInt16BE(corpo.length + 2, 2)
  return Buffer.concat([cabecalho, corpo])
}

/** JPEG com o bloco EXIF (APP1) logo depois do SOI. */
export async function jpegComGps(largura: number, altura: number, orientacao = 1): Promise<Buffer> {
  const jpeg = await imagem('jpeg', largura, altura)
  return Buffer.concat([jpeg.subarray(0, 2), blocoExif(orientacao), jpeg.subarray(2)])
}

function pedacoPng(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const tipoEDados = Buffer.concat([Buffer.from(tipo, 'latin1'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(tipoEDados))
  return Buffer.concat([tamanho, tipoEDados, crc])
}

/** PNG de poucos bytes que DECLARA dimensões enormes ("pixel flood"). */
export function pngQueDeclara(largura: number, altura: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedacoPng('IHDR', ihdr),
    pedacoPng('IDAT', deflateSync(Buffer.alloc(16))),
    pedacoPng('IEND', Buffer.alloc(0)),
  ])
}

export const emBase64 = (b: Buffer) => b.toString('base64')
