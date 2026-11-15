import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ipInteiro, truncarIp } from '../src/autenticacao/limitador.ts'
import { ErroHttp, MENSAGEM_DADOS_INVALIDOS, validar } from '../src/http.ts'

/** Mensagem que `validar` mandaria para a tela. */
function mensagem(esquema: z.ZodType, corpo: unknown): string {
  try {
    validar(esquema, corpo)
  } catch (e) {
    expect(e).toBeInstanceOf(ErroHttp)
    expect((e as ErroHttp).status).toBe(400)
    return (e as ErroHttp).message
  }
  throw new Error('deveria ter recusado')
}

/** Nada do texto padrão do Zod (inglês, técnico) pode chegar à tela. */
const TECNICO = /too small|too big|invalid|expected|received|string|number|>=|<=|uuid|regex/i

describe('validar: mensagens humanas em português (A3)', () => {
  const evento = z.object({
    titulo: z.string().trim().min(1).max(10),
    capacidade: z.number().int().min(1).optional(),
    localId: z.uuid().optional(),
    descricao: z.string().min(5).optional(),
  })

  it('campo conhecido vazio ou ausente: "Preencha ..."', () => {
    expect(mensagem(evento, { titulo: '' })).toBe('Preencha o título.')
    expect(mensagem(evento, {})).toBe('Preencha o título.')
  })

  it('texto curto ou longo demais e número fora do permitido, sem jargão', () => {
    expect(mensagem(evento, { titulo: 'x'.repeat(11) })).toBe(
      'Encurte o título: passou do tamanho permitido.',
    )
    expect(mensagem(evento, { titulo: 'ok', descricao: 'abc' })).toBe(
      'Confira a descrição: tem poucos caracteres.',
    )
    expect(mensagem(evento, { titulo: 'ok', capacidade: 0 })).toBe(
      'Confira a capacidade: o valor está fora do permitido.',
    )
  })

  it('campo técnico (id) ou corpo que não é objeto: frase genérica', () => {
    expect(mensagem(evento, { titulo: 'ok', localId: 'lixo' })).toBe(MENSAGEM_DADOS_INVALIDOS)
    expect(mensagem(evento, 'texto solto')).toBe(MENSAGEM_DADOS_INVALIDOS)
    expect(mensagem(z.object({ itens: z.array(z.uuid()) }), { itens: ['a', 'b'] })).toBe(
      MENSAGEM_DADOS_INVALIDOS,
    )
  })

  it('mensagem própria do esquema (regra de negócio) passa como está, sem repetir', () => {
    const cadastro = z.object({
      nome: z.string().trim().min(1, 'Informe seu nome.'),
      apelido: z.string().min(1, 'Informe seu nome.'),
    })
    expect(mensagem(cadastro, { nome: ' ', apelido: '' })).toBe('Informe seu nome.')
  })

  it('nenhuma mensagem padrão tem texto técnico', () => {
    const casos: [z.ZodType, unknown][] = [
      [evento, { titulo: 3 }],
      [evento, { titulo: 'ok', capacidade: 'dez' }],
      [z.object({ email: z.email() }), { email: 'nao-e-email' }],
      [z.object({ tipo: z.enum(['a', 'b']) }), { tipo: 'c' }],
      [z.object({ inicio: z.iso.datetime() }), { inicio: 'ontem' }],
      [z.object({ codigo: z.string().regex(/^\d{6}$/) }), { codigo: '12' }],
    ]
    for (const [esquema, corpo] of casos) expect(mensagem(esquema, corpo)).not.toMatch(TECNICO)
  })
})

describe('ipInteiro (limite de renovar, D44)', () => {
  it('IPv4 fica inteiro; mapeado em IPv6 vira IPv4', () => {
    expect(ipInteiro('203.0.113.77')).toBe('203.0.113.77')
    expect(ipInteiro('::ffff:203.0.113.77')).toBe('203.0.113.77')
    expect(ipInteiro('203.0.113.77')).not.toBe(ipInteiro('203.0.113.78'))
    // A faixa (/24) continua a mesma para os outros limites.
    expect(truncarIp('203.0.113.77')).toBe(truncarIp('203.0.113.78'))
  })

  it('IPv6 normalizado: duas escritas do mesmo endereço são uma chave só', () => {
    expect(ipInteiro('2001:db8::1')).toBe(ipInteiro('2001:0db8:0:0::0001'))
    expect(ipInteiro('2001:db8::1')).not.toBe(ipInteiro('2001:db8::2'))
  })
})
