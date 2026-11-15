// Preenche o App Review Information da versão (sem senha: o dono cola a senha).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const V = 'a672d0a1-c28f-4450-9154-3a3fccdc2837'
const issuer = readFileSync('issuer', 'utf8').trim()
const asc = (m, c, b) => {
  const o = execFileSync(
    'node',
    ['asc.mjs', '5D35YX6U6U', issuer, m, c, ...(b ? [JSON.stringify(b)] : [])],
    { encoding: 'utf8' },
  )
  const i = o.indexOf('\n')
  return {
    status: Number(o.slice(0, i)),
    corpo: o.slice(i + 1).trim() ? JSON.parse(o.slice(i + 1)) : null,
  }
}
const g = readFileSync('gamora-contato.json', 'utf8')
const gamora = JSON.parse(g.slice(g.indexOf('\n') + 1)).data.attributes
const atributos = {
  contactFirstName: gamora.contactFirstName,
  contactLastName: gamora.contactLastName,
  contactEmail: gamora.contactEmail,
  contactPhone: gamora.contactPhone,
  demoAccountRequired: true,
  demoAccountName: 'demo.admin@unijovem.invalid',
  notes: readFileSync('notas.txt', 'utf8').trim(),
}
const atual = asc('GET', `/v1/appStoreVersions/${V}/appStoreReviewDetail`)
let r
if (atual.status === 200 && atual.corpo?.data) {
  r = asc('PATCH', `/v1/appStoreReviewDetails/${atual.corpo.data.id}`, {
    data: { type: 'appStoreReviewDetails', id: atual.corpo.data.id, attributes: atributos },
  })
} else {
  r = asc('POST', '/v1/appStoreReviewDetails', {
    data: {
      type: 'appStoreReviewDetails',
      attributes: atributos,
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: V } } },
    },
  })
}
console.log(
  'revisao',
  r.status,
  r.status >= 300 ? JSON.stringify(r.corpo?.errors).slice(0, 400) : 'ok',
)
