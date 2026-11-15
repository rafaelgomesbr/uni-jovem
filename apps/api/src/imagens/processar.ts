import { createHash } from 'node:crypto'
import sharp, { type OutputInfo } from 'sharp'
import { ErroHttp } from '../http.ts'

/**
 * Foto de perfil e logotipo da comunidade (D33): imagens pequenas guardadas no
 * próprio Postgres. Tudo o que chega é tratado como hostil:
 *
 * - o tipo sai dos BYTES (assinatura de JPEG, PNG ou WebP), nunca da extensão,
 *   do `Content-Type` ou do prefixo `data:` que o app mandar;
 * - a imagem é decodificada e REGRAVADA: o arquivo enviado nunca é guardado.
 *   A regravação descarta EXIF (GPS, modelo do aparelho, data), XMP e perfil
 *   ICC, aplica a orientação do EXIF antes de descartá-lo e reduz para caber
 *   em 512 × 512;
 * - o que não decodifica é recusado, e o decodificador tem teto de pixels e
 *   de tempo (uma imagem de 2 MB pode declarar 50 000 × 50 000 pixels).
 */

/** O que o servidor aceita receber (o app recorta e reduz antes de enviar). */
export const BYTES_MAXIMOS_NA_ENTRADA = 2 * 1024 * 1024
/** O que o banco aceita guardar (o CHECK de 0018 confere de novo). */
export const BYTES_MAXIMOS_GUARDADOS = 300 * 1024
export const LADO_MAXIMO = 512
/** Base64 de 2 MB, com folga para o prefixo `data:` e quebras de linha. */
export const CARACTERES_MAXIMOS_EM_BASE64 = Math.ceil(BYTES_MAXIMOS_NA_ENTRADA / 3) * 4 + 1024
/** Corpo JSON da rota de envio: o base64 mais o envelope. */
export const LIMITE_DO_CORPO = 3 * 1024 * 1024

// Uma foto de câmera de 40 MP ainda passa; um "pixel flood" não.
const PIXELS_MAXIMOS_NA_ENTRADA = 40_000_000
// Qualidades tentadas em ordem: a primeira que couber em 300 KB fica.
const QUALIDADES = [82, 70, 55, 40] as const

export type TipoDeEntrada = 'jpeg' | 'png' | 'webp'

export interface ImagemProcessada {
  conteudo: Buffer
  tipo: 'image/webp'
  /** SHA-256 do conteúdo guardado: vira o ETag e, encurtado, a versão. */
  hash: Buffer
  largura: number
  altura: number
}

/** Tipo pela assinatura do arquivo. `null` para qualquer outra coisa. */
export function tipoPeloConteudo(bytes: Buffer): TipoDeEntrada | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png'
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

export const IMAGEM_GRANDE_DEMAIS = () =>
  new ErroHttp(
    'imagem_grande_demais',
    413,
    'A imagem é grande demais. Escolha uma foto menor ou recorte antes de enviar.',
  )
const TIPO_NAO_ACEITO = () =>
  new ErroHttp(
    'tipo_de_imagem_nao_aceito',
    415,
    'Este arquivo não é uma foto em JPEG, PNG ou WebP. Escolha outra imagem.',
  )
const IMAGEM_INVALIDA = () =>
  new ErroHttp(
    'imagem_invalida',
    400,
    'Não conseguimos abrir esta imagem. Ela pode estar danificada; tente outra foto.',
  )

/**
 * Lê o campo `imagem` do corpo: base64 puro ou com o prefixo `data:...;base64,`
 * (o prefixo é ignorado, inclusive o tipo que ele declara).
 */
export function bytesDoBase64(texto: string): Buffer {
  if (texto.length > CARACTERES_MAXIMOS_EM_BASE64) throw IMAGEM_GRANDE_DEMAIS()
  const semPrefixo = texto.replace(/^data:[^,]{0,100},/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(semPrefixo)) throw IMAGEM_INVALIDA()
  const bytes = Buffer.from(semPrefixo, 'base64')
  if (bytes.length > BYTES_MAXIMOS_NA_ENTRADA) throw IMAGEM_GRANDE_DEMAIS()
  return bytes
}

// O cache de operações do sharp guardaria imagens de pessoas na memória do
// processo sem ganho nenhum (cada envio é uma imagem diferente).
sharp.cache(false)

/** Confere, decodifica e regrava a imagem. Lança ErroHttp com mensagem para a tela. */
export async function processarImagem(bytes: Buffer): Promise<ImagemProcessada> {
  if (bytes.length > BYTES_MAXIMOS_NA_ENTRADA) throw IMAGEM_GRANDE_DEMAIS()
  const tipo = tipoPeloConteudo(bytes)
  if (!tipo) throw TIPO_NAO_ACEITO()

  const opcoes = {
    // 'error' inclui 'truncated': arquivo cortado ou com dado de pixel inválido
    // é recusado; avisos menores de JPEG de câmera passam.
    failOn: 'error',
    limitInputPixels: PIXELS_MAXIMOS_NA_ENTRADA,
    // Só o primeiro quadro de um WebP animado.
    pages: 1,
  } as const

  // Só o cabeçalho: formato e dimensões declaradas, antes de decodificar pixels.
  let cabecalho: { format?: string; width?: number; height?: number }
  try {
    // Sem o teto de pixels aqui: só o cabeçalho é lido, e o teto vem logo abaixo, com 413.
    cabecalho = await sharp(bytes, { ...opcoes, limitInputPixels: false }).metadata()
  } catch {
    throw IMAGEM_INVALIDA()
  }
  // A assinatura e o decodificador precisam concordar (arquivo poliglota não passa).
  if (cabecalho.format !== tipo) throw TIPO_NAO_ACEITO()
  if (!cabecalho.width || !cabecalho.height) throw IMAGEM_INVALIDA()
  // "Pixel flood": arquivo pequeno que declara dimensões enormes.
  if (cabecalho.width * cabecalho.height > PIXELS_MAXIMOS_NA_ENTRADA) throw IMAGEM_GRANDE_DEMAIS()

  for (const qualidade of QUALIDADES) {
    let saida: { data: Buffer; info: OutputInfo }
    try {
      saida = await sharp(bytes, opcoes)
        .timeout({ seconds: 10 })
        // Gira conforme o EXIF ANTES de o EXIF ser descartado.
        .autoOrient()
        .resize(LADO_MAXIMO, LADO_MAXIMO, { fit: 'inside', withoutEnlargement: true })
        // Sem keepMetadata/withMetadata: a saída não leva EXIF, XMP nem ICC (sai em sRGB).
        .webp({ quality: qualidade, alphaQuality: 90, effort: 4 })
        .toBuffer({ resolveWithObject: true })
    } catch {
      throw IMAGEM_INVALIDA()
    }
    if (saida.data.length <= BYTES_MAXIMOS_GUARDADOS) {
      return {
        conteudo: saida.data,
        tipo: 'image/webp',
        hash: createHash('sha256').update(saida.data).digest(),
        largura: saida.info.width,
        altura: saida.info.height,
      }
    }
  }
  throw IMAGEM_GRANDE_DEMAIS()
}

/** Versão curta para o app (cache e `?v=`): os 16 primeiros dígitos do SHA-256. */
export function versaoDoHash(hashHex: string | null): string | null {
  return hashHex ? hashHex.slice(0, 16) : null
}
