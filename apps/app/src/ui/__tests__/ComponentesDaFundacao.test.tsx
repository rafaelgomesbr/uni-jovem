/**
 * D65 e D67: os componentes da fundação da direção A (sol, cartões, chip, linha de lista,
 * esqueleto, folha, ícones) nos dois temas e nos estados. As cores vêm dos tokens, nunca
 * escritas aqui; o dublê do Reanimated vai direto ao valor final, então o teste lê o estado
 * final de cada animação e confere o que foi PEDIDO (duração, atraso) por `withTiming`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { MOVIMENTO_DAS_TELAS, POSES_DO_SOL, POSES_DO_SOL_EM_ORDEM, TEMAS } from '@uj/tokens'
import { StyleSheet, useColorScheme } from 'react-native'
import { withDelay, withTiming } from 'react-native-reanimated'

import { Botao } from '../Botao'
import { Cartao } from '../Cartao'
import { CartaoDoMomento } from '../CartaoDoMomento'
import { Chip, SITUACOES_DO_CHIP, type SituacaoDoChip } from '../Chip'
import { EsqueletoDoMomento, LinhaDeEsqueleto } from '../Esqueleto'
import { AlcaDaFolha, FolhaNaTela } from '../FolhaNaTela'
import { Icone } from '../Icone'
import { LinhaDeLista, Lista } from '../LinhaDeLista'
import { Sol } from '../Sol'
import { ProvedorDeTemaForcado } from '../tema'

jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(),
}))
const preferencias = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function definir(
  p: Partial<
    Record<'reduzirMovimento' | 'reduzirTransparencia' | 'aumentarContraste', boolean>
  > = {},
) {
  preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste: false,
    ...p,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  definir()
})

const COM_ESCONDIDOS = { includeHiddenElements: true }

function achatado(no: { props: { style?: unknown } }): Record<string, unknown> {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

function translacaoY(no: { props: { style?: unknown } }): number {
  const t = achatado(no).transform as { translateY?: number }[] | undefined
  return t?.find((x) => x.translateY !== undefined)?.translateY ?? 0
}

function escala(no: { props: { style?: unknown } }): number {
  const t = achatado(no).transform as { scale?: number }[] | undefined
  return t?.find((x) => x.scale !== undefined)?.scale ?? 1
}

const sol = (id: string) => screen.getByTestId(id, COM_ESCONDIDOS)

describe('Sol: as cinco poses (seção 7)', () => {
  for (const pose of POSES_DO_SOL_EM_ORDEM) {
    test(`${pose}: corpo, raios, halo e barras vão aos valores da tabela`, async () => {
      const v = POSES_DO_SOL[pose]
      await render(<Sol pose={pose} lado={96} />)
      expect(translacaoY(sol('sol-corpo'))).toBeCloseTo((v.corpoY / 712) * 96, 3)
      for (let i = 0; i < 5; i++) {
        expect(achatado(sol(`sol-raio-${i}`)).opacity).toBe(v.raios.opacidade)
        expect(escala(sol(`sol-raio-${i}`))).toBe(v.raios.escala)
      }
      expect(achatado(sol('sol-halo')).opacity).toBe(v.halo.opacidade)
      expect(escala(sol('sol-halo'))).toBe(v.halo.escala)
      expect(achatado(sol('sol-barra-1')).opacity).toBe(v.barra1)
      expect(achatado(sol('sol-barra-2')).opacity).toBe(v.barra2)
    })
  }

  test('é decorativo e escondido do leitor de tela; com `alternativa`, vira imagem com texto', async () => {
    const { rerender } = await render(<Sol pose="pleno" lado={96} testID="sol" />)
    expect(screen.getByTestId('sol', COM_ESCONDIDOS)).toHaveProp(
      'accessibilityElementsHidden',
      true,
    )
    expect(screen.queryByRole('image')).toBeNull()
    await rerender(<Sol pose="pleno" lado={96} alternativa="Sol nascendo" testID="sol" />)
    expect(screen.getByRole('image', { name: 'Sol nascendo' })).toBeOnTheScreen()
  })

  test('troca de pose: 600 ms, e os raios nascem um depois do outro, de 40 em 40 ms', async () => {
    const { rerender } = await render(<Sol pose="escondido" lado={96} />)
    jest.clearAllMocks()
    await rerender(<Sol pose="pleno" lado={96} />)
    const duracoes = (withTiming as jest.Mock).mock.calls.map((c) => c[1].duration)
    expect(duracoes).toContain(MOVIMENTO_DAS_TELAS.sol.pose)
    const atrasos = (withDelay as jest.Mock).mock.calls.map((c) => c[0] as number)
    for (const i of [0, 1, 2, 3, 4])
      expect(atrasos).toContain(i * MOVIMENTO_DAS_TELAS.sol.passoDoRaio)
    expect(translacaoY(sol('sol-corpo'))).toBe(0)
  })

  test('Reduzir movimento: só dissolve em 120 ms, sem atraso, e o corpo já aparece no lugar', async () => {
    definir({ reduzirMovimento: true })
    const { rerender } = await render(<Sol pose="escondido" lado={96} />)
    jest.clearAllMocks()
    await rerender(<Sol pose="radiante" lado={96} />)
    const duracoes = (withTiming as jest.Mock).mock.calls.map((c) => c[1].duration)
    expect(new Set(duracoes)).toEqual(new Set([MOVIMENTO_DAS_TELAS.dissolver]))
    expect((withDelay as jest.Mock).mock.calls.every((c) => c[0] === 0)).toBe(true)
    expect(translacaoY(sol('sol-corpo'))).toBe(0)
    expect(escala(sol('sol-raio-2'))).toBe(POSES_DO_SOL.radiante.raios.escala)
  })

  test('`de`: parte da pose de origem e sobe até a pedida (o encanto do "Tudo em dia")', async () => {
    await render(<Sol de="escondido" pose="pleno" lado={30} halo={false} />)
    expect(translacaoY(sol('sol-corpo'))).toBe(0)
    expect(screen.queryByTestId('sol-halo', COM_ESCONDIDOS)).toBeNull()
    const pedidas = (withTiming as jest.Mock).mock.calls.map((c) => c[0] as number)
    // O corpo subiu de 215/712 do lado até 0.
    expect(pedidas).toContain(0)
  })

  test('as cores seguem o tema: poente no claro usa o âmbar mais fundo (SOL_POENTE)', async () => {
    await render(
      <ProvedorDeTemaForcado nome="claro">
        <Sol pose="poente" lado={96} />
      </ProvedorDeTemaForcado>,
    )
    expect(translacaoY(sol('sol-corpo'))).toBeCloseTo((62 / 712) * 96, 3)
  })
})

describe('Cartões: tinta, plano e momento', () => {
  test('tinta: tinta translúcida e o fio de luz no topo (escuro); sem realce no claro', async () => {
    jest.mocked(useColorScheme)
    const { toJSON } = await render(
      <ProvedorDeTemaForcado nome="escuro">
        <Cartao sobrancelha="Resumo">
          <Chip situacao="novo" />
        </Cartao>
      </ProvedorDeTemaForcado>,
    )
    const json = JSON.stringify(toJSON())
    expect(json).toContain(TEMAS.escuro.base.superficieTranslucida)
    expect(json).toContain('linear-gradient(180deg, rgba(255,255,255,0.06)')
    await render(
      <ProvedorDeTemaForcado nome="claro">
        <Cartao sobrancelha="Resumo claro">
          <Chip situacao="novo" />
        </Cartao>
      </ProvedorDeTemaForcado>,
    )
    expect(screen.getByText('Resumo claro')).toBeOnTheScreen()
  })

  test('com Aumentar contraste ou Reduzir transparência: opaco, sem realce; contraste: borda de 2', async () => {
    definir({ aumentarContraste: true })
    const { toJSON } = await render(
      <ProvedorDeTemaForcado nome="escuro">
        <Cartao sobrancelha="Opaco" />
      </ProvedorDeTemaForcado>,
    )
    const json = JSON.stringify(toJSON())
    expect(json).toContain(TEMAS.escuro.base.superficie)
    expect(json).not.toContain('linear-gradient(180deg')
    expect(json).toContain('"borderWidth":2')
  })

  test('plano: opaco, borda de 1, sem sombra e sem realce', async () => {
    const { toJSON } = await render(
      <ProvedorDeTemaForcado nome="escuro">
        <Cartao variante="plano">
          <Chip situacao="rascunho" />
        </Cartao>
      </ProvedorDeTemaForcado>,
    )
    const json = JSON.stringify(toJSON())
    expect(json).toContain(TEMAS.escuro.base.superficie)
    expect(json).not.toContain('boxShadow')
    expect(json).not.toContain('linear-gradient')
  })

  test('momento: moldura de 1,5 em degradê de 140 graus, miolo de 160 graus, sombra, brilho e o sol', async () => {
    const E = TEMAS.escuro.base
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <CartaoDoMomento
          momento="agora"
          etiqueta="Acontecendo agora"
          aoVivo
          titulo="Sábado Jovem"
          meta="Hoje · 16:00"
        />
      </ProvedorDeTemaForcado>,
    )
    const fora = achatado(screen.getByTestId('cartao-do-momento'))
    expect(fora).toMatchObject({ padding: 1.5, borderRadius: 28 })
    expect(String(fora.backgroundImage)).toBe(
      `linear-gradient(140deg, ${E.momentoBorda1}, ${E.momentoBorda2} 55%, ${E.momentoBorda3})`,
    )
    expect(String(fora.boxShadow)).toContain('rgba(255,138,101,0.38)')
    const json = JSON.stringify(screen.toJSON())
    expect(json).toContain(`linear-gradient(160deg, ${E.momentoTopo}, ${E.momentoBase})`)
    expect(json).toContain('radial-gradient(circle at 100% 0%, rgba(255,138,101,0.26)')
    // O miolo tem raio 26,5 (28 menos a moldura) e o ponto "ao vivo" aparece.
    expect(json).toContain('"borderRadius":26.5')
    expect(screen.getByTestId('ponto-ao-vivo', COM_ESCONDIDOS)).toBeOnTheScreen()
    // O momento "agora" põe o sol na pose radiante.
    expect(escala(sol('sol-raio-0'))).toBe(POSES_DO_SOL.radiante.raios.escala)
    expect(screen.getByText('Sábado Jovem')).toHaveStyle({ fontSize: 26, lineHeight: 30 })
  })

  test('momento: cada momento escolhe a pose do sol; `pose` vence `momento`; `semSol` tira o sol', async () => {
    const { rerender } = await render(<CartaoDoMomento momento="fim" titulo="Obrigado" />)
    expect(translacaoY(sol('sol-corpo'))).toBeCloseTo((62 / 712) * 96, 3)
    await rerender(<CartaoDoMomento momento="fim" pose="pleno" titulo="Obrigado" />)
    expect(translacaoY(sol('sol-corpo'))).toBe(0)
    await rerender(<CartaoDoMomento semSol titulo="Obrigado" />)
    expect(screen.queryByTestId('sol-corpo', COM_ESCONDIDOS)).toBeNull()
  })

  test('momento com Aumentar contraste: moldura de 2 pt na cor do texto, sem brilho nem sombra', async () => {
    definir({ aumentarContraste: true })
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <CartaoDoMomento momento="dia" titulo="Hoje" />
      </ProvedorDeTemaForcado>,
    )
    const fora = achatado(screen.getByTestId('cartao-do-momento'))
    expect(fora).toMatchObject({ padding: 2, backgroundColor: TEMAS.escuro.base.texto })
    expect(fora.boxShadow).toBeUndefined()
    expect(JSON.stringify(screen.toJSON())).not.toContain('radial-gradient')
  })

  test('momento tocável: o corpo abre o detalhe e as ações ficam fora da área tocável', async () => {
    const abrir = jest.fn()
    const aceitar = jest.fn()
    await render(
      <CartaoDoMomento
        titulo="Sábado Jovem"
        meta="16:00"
        aoPressionar={abrir}
        acoes={<Botao titulo="Aceitar" aoPressionar={aceitar} />}
      />,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Sábado Jovem. 16:00' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }))
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(aceitar).toHaveBeenCalledTimes(1)
  })
})

describe('Chip: situações com texto e ícone', () => {
  const ESPERADO: Record<SituacaoDoChip, string> = {
    aceitou: 'Confirmado',
    aguardando: 'Aguardando',
    naoPode: 'Não pode',
    aoVivo: 'Ao vivo',
    novo: 'Novo',
    rascunho: 'Rascunho',
  }
  for (const situacao of Object.keys(ESPERADO) as SituacaoDoChip[]) {
    test(`${situacao}: a palavra "${ESPERADO[situacao]}" sempre aparece (cor nunca é o único sinal)`, async () => {
      await render(<Chip situacao={situacao} />)
      expect(screen.getByText(ESPERADO[situacao])).toBeOnTheScreen()
    })
  }

  test('a tabela: cada situação tem tom e, menos novo e rascunho, ícone ou ponto', () => {
    expect(SITUACOES_DO_CHIP.aceitou).toMatchObject({ tom: 'sucesso', icone: 'check' })
    expect(SITUACOES_DO_CHIP.aguardando).toMatchObject({ tom: 'alerta', icone: 'relogio' })
    expect(SITUACOES_DO_CHIP.naoPode).toMatchObject({ tom: 'erro', icone: 'fechar' })
    expect(SITUACOES_DO_CHIP.aoVivo).toMatchObject({ tom: 'quente', ponto: true })
    expect(SITUACOES_DO_CHIP.novo.tom).toBe('info')
    expect(SITUACOES_DO_CHIP.rascunho.tom).toBe('neutro')
  })

  test('ao vivo traz o ponto que pulsa; um texto próprio vence o padrão', async () => {
    await render(
      <>
        <Chip situacao="aoVivo" />
        <Chip situacao="aguardando" texto="Aguardando sua resposta" />
      </>,
    )
    expect(screen.getByTestId('ponto-ao-vivo', COM_ESCONDIDOS)).toBeOnTheScreen()
    expect(screen.getByText('Aguardando sua resposta')).toBeOnTheScreen()
  })

  test('aparecer: "confirmado" entra em mola e "presente" em 160 ms; Reduzir movimento só dissolve', async () => {
    const { rerender } = await render(
      <Chip situacao="aceitou" aparecer="presente" texto="Presente" />,
    )
    expect(screen.getByTestId('chip-entrando')).toBeOnTheScreen()
    expect((withTiming as jest.Mock).mock.calls.map((c) => c[1].duration)).toContain(
      MOVIMENTO_DAS_TELAS.chipPresente,
    )
    expect(escala(screen.getByTestId('chip-entrando'))).toBe(1)
    jest.clearAllMocks()
    definir({ reduzirMovimento: true })
    await rerender(<Chip situacao="aceitou" aparecer="confirmado" />)
    expect((withTiming as jest.Mock).mock.calls.map((c) => c[1].duration)).toEqual([
      MOVIMENTO_DAS_TELAS.dissolver,
    ])
  })

  test('as cores do chip seguem o tema (escuro e claro)', async () => {
    await render(
      <ProvedorDeTemaForcado nome="claro">
        <Chip situacao="aceitou" />
      </ProvedorDeTemaForcado>,
    )
    expect(screen.getByText('Confirmado')).toHaveStyle({ color: TEMAS.claro.base.sucesso })
  })
})

describe('LinhaDeLista: 56 pt, 72 pt no check-in e os estados', () => {
  test('normal: 56 de altura mínima; check-in: 72 com avatar de 44', async () => {
    await render(
      <Lista>
        <LinhaDeLista titulo="Agenda" icone="agenda" aoPressionar={() => {}} />
        <LinhaDeLista
          variante="checkin"
          avatar={{ nome: 'Ana Ribeiro' }}
          titulo="Ana Ribeiro"
          aoPressionar={() => {}}
        />
      </Lista>,
    )
    expect(achatado(screen.getByRole('button', { name: 'Agenda' })).minHeight).toBe(56)
    expect(achatado(screen.getByRole('button', { name: 'Ana Ribeiro' })).minHeight).toBe(72)
  })

  test('desabilitada: sem toque, motivo escrito e o texto em cor suave (nunca só opacidade)', async () => {
    const aoPressionar = jest.fn()
    await render(
      <LinhaDeLista
        titulo="Pedro Lima"
        descricao="Já convocado"
        desabilitada
        aoPressionar={aoPressionar}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Já convocado')).toBeOnTheScreen()
    expect(screen.getByText('Pedro Lima')).toHaveStyle({ color: TEMAS.claro.base.textoSuave })
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('marcada: estado acessível e camada tonal; o toque funciona', async () => {
    const aoPressionar = jest.fn()
    await render(<LinhaDeLista titulo="Bruno" marcada aoPressionar={aoPressionar} />)
    const linha = screen.getByRole('checkbox', { name: 'Bruno' })
    expect(linha).toBeChecked()
    await fireEvent.press(linha)
    expect(aoPressionar).toHaveBeenCalledTimes(1)
  })

  test('ladrilho quente: ícone em destaque sobre quenteFundo', async () => {
    const { toJSON } = await render(
      <ProvedorDeTemaForcado nome="escuro">
        <LinhaDeLista titulo="Pedidos" icone="coracao" />
      </ProvedorDeTemaForcado>,
    )
    expect(JSON.stringify(toJSON())).toContain(TEMAS.escuro.base.quenteFundo)
  })
})

describe('Esqueleto, folha e ícones', () => {
  test('o esqueleto do momento tem 262 de altura e a linha de esqueleto a altura pedida', async () => {
    await render(
      <>
        <EsqueletoDoMomento />
        <LinhaDeEsqueleto altura={88} />
        <LinhaDeEsqueleto />
      </>,
    )
    const json = JSON.stringify(screen.toJSON())
    expect(json).toContain('"height":262')
    expect(json).toContain('"height":88')
    expect(json).toContain('"height":72')
  })

  test('a alça da folha: 40 por 5, cápsula, escondida do leitor de tela', async () => {
    await render(<AlcaDaFolha />)
    const alca = screen.getByTestId('alca-da-folha', COM_ESCONDIDOS)
    expect(achatado(alca)).toMatchObject({ width: 40, height: 5, borderRadius: 999 })
  })

  test('a folha traz a alça, o título e o "Fechar" de sempre', async () => {
    const aoFechar = jest.fn()
    await render(
      <FolhaNaTela aberta titulo="Trocar de comunidade" aoFechar={aoFechar}>
        <LinhaDeLista titulo="Jovens Esperança" />
      </FolhaNaTela>,
    )
    expect(screen.getByTestId('alca-da-folha', COM_ESCONDIDOS)).toBeOnTheScreen()
    expect(screen.getByText('Trocar de comunidade')).toBeOnTheScreen()
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /fechar/i }))
    })
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  test('os ícones da direção A desenham em traço (SVG), sem a fonte de símbolos', async () => {
    const nomes = [
      'sol',
      'agenda',
      'pessoas',
      'perfil',
      'sino',
      'check',
      'relogio',
      'cadeado',
      'coracao',
    ] as const
    await render(
      <>
        {nomes.map((n) => (
          <Icone key={n} nome={n} cor="#000" />
        ))}
      </>,
    )
    const json = JSON.stringify(screen.toJSON())
    expect(json).not.toContain('"name":{"ios"')
    expect(json.match(/RNSVGSvgView/g)?.length ?? 0).toBeGreaterThanOrEqual(nomes.length)
  })
})
