// Sobe os prints da versão em pt-BR: cria o conjunto por tipo de tela, reserva,
// envia as partes e confirma com o MD5. Repetir não duplica (apaga o conjunto antes).
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
const V = 'a672d0a1-c28f-4450-9154-3a3fccdc2837'
const issuer = readFileSync('issuer', 'utf8').trim()
const asc = (m, c, b) => {
  const o = execFileSync(
    'node',
    ['asc.mjs', '5D35YX6U6U', issuer, m, c, ...(b ? [JSON.stringify(b)] : [])],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  )
  const i = o.indexOf('\n')
  const t = o.slice(i + 1).trim()
  return { status: Number(o.slice(0, i)), corpo: t ? JSON.parse(t) : null }
}
const loc = asc('GET', `/v1/appStoreVersions/${V}/appStoreVersionLocalizations`).corpo.data.find(
  (l) => l.attributes.locale === 'pt-BR',
)
console.log('localizacao', loc.id)
const TIPOS = { 'apple-6.9': 'APP_IPHONE_67', 'apple-6.3': 'APP_IPHONE_61' }
const existentes = asc('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`).corpo
  .data
for (const [pasta, tipo] of Object.entries(TIPOS)) {
  for (const s of existentes.filter((x) => x.attributes.screenshotDisplayType === tipo))
    asc('DELETE', `/v1/appScreenshotSets/${s.id}`)
  const conjunto = asc('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: tipo },
      relationships: {
        appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } },
      },
    },
  })
  if (conjunto.status >= 300) {
    console.log(tipo, 'erro', JSON.stringify(conjunto.corpo.errors).slice(0, 300))
    continue
  }
  const idConjunto = conjunto.corpo.data.id
  for (const arquivo of readdirSync(`prints/${pasta}`).sort()) {
    const caminho = `prints/${pasta}/${arquivo}`
    const bytes = readFileSync(caminho)
    const res = asc('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName: arquivo, fileSize: statSync(caminho).size },
        relationships: {
          appScreenshotSet: { data: { type: 'appScreenshotSets', id: idConjunto } },
        },
      },
    })
    if (res.status >= 300) {
      console.log(arquivo, 'erro', JSON.stringify(res.corpo.errors).slice(0, 200))
      continue
    }
    for (const op of res.corpo.data.attributes.uploadOperations) {
      const cab = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]))
      const r = await fetch(op.url, {
        method: op.method,
        headers: cab,
        body: bytes.subarray(op.offset, op.offset + op.length),
      })
      if (!r.ok) console.log(arquivo, 'parte falhou', r.status)
    }
    const md5 = createHash('md5').update(bytes).digest('hex')
    const fim = asc('PATCH', `/v1/appScreenshots/${res.corpo.data.id}`, {
      data: {
        type: 'appScreenshots',
        id: res.corpo.data.id,
        attributes: { uploaded: true, sourceFileChecksum: md5 },
      },
    })
    console.log(tipo, arquivo, fim.status)
  }
}
