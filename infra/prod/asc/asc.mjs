// Chamada à API do App Store Connect com a chave local (nunca sai do Mac).
// Uso: node asc.mjs <keyId> <issuer|-> <METODO> <caminho> [corpoJson]
import { createSign, createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
const [keyId, issuer, metodo, caminho, corpo] = process.argv.slice(2)
const chave = createPrivateKey(
  readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`),
)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const agora = Math.floor(Date.now() / 1000)
const payload =
  issuer === '-'
    ? { sub: 'user', iat: agora, exp: agora + 1100, aud: 'appstoreconnect-v1' }
    : { iss: issuer, iat: agora, exp: agora + 1100, aud: 'appstoreconnect-v1' }
const cabeca = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' })
const dados = `${cabeca}.${b64(payload)}`
const assinatura = createSign('SHA256')
  .update(dados)
  .sign({ key: chave, dsaEncoding: 'ieee-p1363' })
  .toString('base64url')
const r = await fetch(`https://api.appstoreconnect.apple.com${caminho}`, {
  method: metodo,
  headers: { authorization: `Bearer ${dados}.${assinatura}`, 'content-type': 'application/json' },
  ...(corpo ? { body: corpo } : {}),
})
const texto = await r.text()
process.stdout.write(`${r.status}\n${texto}\n`)
