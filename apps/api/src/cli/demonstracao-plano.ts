import { MODELO_SABADO_PADRAO } from '@uj/dominio'

/**
 * O que a comunidade de demonstração (A) deve ter, como DADO puro: figurantes,
 * agenda relativa à data de hoje, escalas, avisos, pedidos de oração,
 * sugestões e conteúdos. A gravação, e com ela a idempotência, fica em
 * `demonstracao-comunidade-a.ts`; aqui não há banco nem relógio.
 *
 * Tudo é inventado: nomes, e-mails `@unijovem.invalid`, nenhum telefone,
 * lugares sem endereço real. Música só tem título, tom e observação, nunca
 * letra; os hinos citados são de domínio público.
 */

export type ChaveDeFigurante =
  | 'julia'
  | 'pedro'
  | 'larissa'
  | 'mateus'
  | 'beatriz'
  | 'thiago'
  | 'camila'
  | 'gustavo'
  | 'leticia'
  | 'davi'

/** Quem aparece na comunidade A: as contas de demonstração com senha e os figurantes. */
export type ChaveEmA = 'admin' | 'organizador' | 'membro' | 'admin2' | 'nas_duas' | ChaveDeFigurante

/** Nomes da lista fechada da migração 0016 (e de packages/tokens/src/avatar.ts). */
type IconeDeAvatar = 'flor' | 'bola' | 'sol' | 'musica' | 'livro' | 'camera' | 'montanha' | 'jogo'
type CorDeAvatar = 'rosa' | 'azul' | 'ambar' | 'violeta' | 'menta' | 'petroleo' | 'verde' | 'noite'

export interface Figurante {
  chave: ChaveDeFigurante
  nome: string
  email: string
  papel: 'organizador' | 'membro'
  avatar?: { icone: IconeDeAvatar; cor: CorDeAvatar }
}

/**
 * Membros que só existem para a comunidade parecer viva. Ficam SEM senha
 * (`senha_hash` nulo): ninguém entra com essas contas, e o e-mail `.invalid`
 * não recebe recuperação de senha.
 */
export const FIGURANTES_DE_A: readonly Figurante[] = [
  {
    chave: 'julia',
    nome: 'Júlia Ramos',
    email: 'demo.julia@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'flor', cor: 'rosa' },
  },
  {
    chave: 'pedro',
    nome: 'Pedro Lima',
    email: 'demo.pedro@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'bola', cor: 'azul' },
  },
  {
    chave: 'larissa',
    nome: 'Larissa Duarte',
    email: 'demo.larissa@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'sol', cor: 'ambar' },
  },
  {
    chave: 'mateus',
    nome: 'Mateus Pereira',
    email: 'demo.mateus@unijovem.invalid',
    papel: 'organizador',
    avatar: { icone: 'musica', cor: 'violeta' },
  },
  {
    chave: 'beatriz',
    nome: 'Beatriz Moraes',
    email: 'demo.beatriz@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'livro', cor: 'menta' },
  },
  {
    chave: 'thiago',
    nome: 'Thiago Azevedo',
    email: 'demo.thiago@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'camera', cor: 'petroleo' },
  },
  { chave: 'camila', nome: 'Camila Nunes', email: 'demo.camila@unijovem.invalid', papel: 'membro' },
  {
    chave: 'gustavo',
    nome: 'Gustavo Teixeira',
    email: 'demo.gustavo@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'montanha', cor: 'verde' },
  },
  {
    chave: 'leticia',
    nome: 'Letícia Barros',
    email: 'demo.leticia@unijovem.invalid',
    papel: 'membro',
  },
  {
    chave: 'davi',
    nome: 'Davi Monteiro',
    email: 'demo.davi@unijovem.invalid',
    papel: 'membro',
    avatar: { icone: 'jogo', cor: 'noite' },
  },
]

// ---------------------------------------------------------------- tipos do plano

/** Data e hora de parede no fuso da comunidade (AAAA-MM-DD e HH:MM). */
export interface HorarioLocal {
  data: string
  hora: string
}

export interface LocalDoPlano {
  nome: string
  tipo: 'interno' | 'externo'
  endereco: string | null
  referencia: string
}

export type ChaveDeLocal = 'salao' | 'sitio'

export interface EtapaDoPlano {
  titulo: string
  duracaoMin: number
  descricao?: string
}

export interface EscalaDoPlano {
  /** Título da etapa; nulo para quem responde pelo evento inteiro. */
  etapa: string | null
  pessoa: ChaveEmA
  /** Com maiúscula inicial: vira título de cartão ("Coordenação", "Vocal"). */
  funcao: string
  estado: 'pendente' | 'confirmada'
  /** Motivo de um pedido de substituição aberto, feito pela própria pessoa. */
  pedirSubstituicao?: string
}

export interface TarefaDoPlano {
  titulo: string
  descricao?: string
  responsavel: ChaveEmA
  prazo?: HorarioLocal
  concluida?: boolean
}

export interface ItemDeChecklistDoPlano {
  tipo: 'preparacao' | 'encerramento'
  texto: string
  responsavel?: ChaveEmA
  marcado?: boolean
}

export interface EventoDoPlano {
  titulo: string
  descricao: string
  categoria: string
  inicio: HorarioLocal
  duracaoMin: number
  status: 'publicado' | 'encerrado'
  visibilidade: 'interna' | 'publica'
  local: ChaveDeLocal
  capacidade?: number
  listaDeEspera?: boolean
  inscricaoAte?: HorarioLocal
  informacoesUteis?: string
  /**
   * Como reconhecer o evento numa base que já o tem: 'data' é o mesmo título
   * no mesmo dia (encontros semanais); 'proximo' é qualquer evento futuro com o
   * título (evento especial: rodar a semente outro dia não cria um segundo).
   */
  identidade: 'data' | 'proximo'
  /** Quem cria (organizador ou admin). Também registra as presenças. */
  autor: ChaveEmA
  etapas: readonly EtapaDoPlano[]
  checklist: readonly ItemDeChecklistDoPlano[]
  escalas: readonly EscalaDoPlano[]
  tarefas: readonly TarefaDoPlano[]
  /** Membros inscritos (só enquanto as inscrições estão abertas). */
  inscricoes: readonly ChaveEmA[]
  /** Presenças registradas (só em evento que já aconteceu). */
  presencas: readonly ChaveEmA[]
  /** Visitantes sem conta, registrados pelo nome na entrada. */
  visitantes: readonly string[]
}

export interface AvisoDoPlano {
  autor: ChaveEmA
  titulo: string
  texto: string
  fixado: boolean
}

export interface PedidoDeOracaoDoPlano {
  autor: ChaveEmA
  visibilidade: 'comunidade' | 'somente_eu'
  texto: string
  /** Há quantas horas o pedido foi feito (a lista mostra o tempo relativo). */
  horasAtras: number
  respondido?: boolean
  orando: readonly ChaveEmA[]
}

export interface SugestaoDoPlano {
  autor: ChaveEmA
  anonima: boolean
  titulo: string
  texto: string
  status: 'recebida' | 'em_analise' | 'aceita'
  resposta?: string
  /** Quem moderou (obrigatório quando o status não é 'recebida'). */
  moderadaPor?: ChaveEmA
  horasAtras: number
}

export interface MusicaDoPlano {
  titulo: string
  artista: string
  tom: string
  observacoes: string
}

export interface PalestranteDoPlano {
  nome: string
  temas: string
  origem: string
  observacoes: string | null
}

export interface DinamicaDoPlano {
  titulo: string
  objetivo: string
  instrucoes: string
  duracaoMin: number
  materiais: string
}

export interface DisponibilidadeDoPlano {
  pessoa: ChaveEmA
  data: string
  disponivel: boolean
  observacao: string
}

export interface PlanoDaComunidadeA {
  locais: Record<ChaveDeLocal, LocalDoPlano>
  eventos: readonly EventoDoPlano[]
  avisos: readonly AvisoDoPlano[]
  pedidosDeOracao: readonly PedidoDeOracaoDoPlano[]
  sugestoes: readonly SugestaoDoPlano[]
  musicas: { autor: ChaveEmA; itens: readonly MusicaDoPlano[] }
  palestrantes: { autor: ChaveEmA; itens: readonly PalestranteDoPlano[] }
  dinamicas: { autor: ChaveEmA; itens: readonly DinamicaDoPlano[] }
  disponibilidades: readonly DisponibilidadeDoPlano[]
}

// ---------------------------------------------------------------- datas

function paraUtc(data: string): Date {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d))
}

export function somarDias(data: string, dias: number): string {
  const d = paraUtc(data)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Sábado depois de hoje (nunca hoje), mais `semanas` semanas. */
export function proximoSabado(hoje: string, semanas = 0): string {
  const faltam = (6 - paraUtc(hoje).getUTCDay() + 7) % 7 || 7
  return somarDias(hoje, faltam + semanas * 7)
}

/** O `n`-ésimo sábado antes de hoje (nunca hoje): 1 é o mais recente. */
export function sabadoPassado(hoje: string, n = 1): string {
  const desde = (paraUtc(hoje).getUTCDay() - 6 + 7) % 7 || 7
  return somarDias(hoje, -desde - (n - 1) * 7)
}

/** 21/11/2026, para as linhas do relatório da semente. */
export function dataPorExtenso(data: string): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

// ---------------------------------------------------------------- o plano

export const LOCAIS_DE_A: Record<ChaveDeLocal, LocalDoPlano> = {
  salao: {
    nome: 'Salão da igreja',
    tipo: 'interno',
    endereco: null,
    referencia: 'Entrada lateral, ao lado da secretaria',
  },
  sitio: {
    nome: 'Sítio Recanto Verde',
    tipo: 'externo',
    endereco: 'Estrada do Recanto, km 6, zona rural',
    referencia: 'Portão verde logo depois da ponte',
  },
}

const DESCRICAO_DO_SABADO = 'Programação de sábado com louvor, dinâmica e estudo.'

interface OpcoesDoSabado {
  data: string
  tema: string
  passado?: boolean
  publico?: boolean
  escalas: readonly EscalaDoPlano[]
  tarefas?: readonly TarefaDoPlano[]
  presencas?: readonly ChaveEmA[]
  visitantes?: readonly string[]
}

/** Responsáveis por itens do checklist do modelo (os demais ficam sem dono). */
const DONO_DO_ITEM: Record<string, ChaveEmA> = {
  'Testar som, microfones e projeção': 'thiago',
  'Registrar a presença': 'organizador',
  'Separar o brinde': 'camila',
}

/** Um "Sábado Jovem" com a programação do modelo padrão (o mesmo que o app oferece). */
function sabadoJovem(o: OpcoesDoSabado): EventoDoPlano {
  const etapas = MODELO_SABADO_PADRAO.etapas.map((e) =>
    e.titulo === 'Estudo da lição' ? { ...e, descricao: `Tema: ${o.tema}.` } : { ...e },
  )
  return {
    titulo: 'Sábado Jovem',
    descricao: DESCRICAO_DO_SABADO,
    categoria: MODELO_SABADO_PADRAO.categoria,
    inicio: { data: o.data, hora: '16:00' },
    duracaoMin: etapas.reduce((t, e) => t + e.duracaoMin, 0),
    status: o.passado ? 'encerrado' : 'publicado',
    visibilidade: o.publico ? 'publica' : 'interna',
    local: 'salao',
    // O primeiro sábado é o da semente antiga: público, 60 vagas e lista de espera.
    ...(o.publico ? { capacidade: 60, listaDeEspera: true } : {}),
    identidade: 'data',
    autor: 'organizador',
    etapas,
    checklist: MODELO_SABADO_PADRAO.checklist.map((item) => {
      const dono = DONO_DO_ITEM[item.texto]
      return {
        ...item,
        ...(dono ? { responsavel: dono } : {}),
        ...(o.passado ? { marcado: true } : {}),
      }
    }),
    escalas: o.escalas,
    tarefas: o.tarefas ?? [],
    inscricoes: [],
    presencas: o.presencas ?? [],
    visitantes: o.visitantes ?? [],
  }
}

const confirmada = (
  etapa: string | null,
  pessoa: ChaveEmA,
  funcao: string,
  extra: Partial<EscalaDoPlano> = {},
): EscalaDoPlano => ({ etapa, pessoa, funcao, estado: 'confirmada', ...extra })
const pendente = (etapa: string | null, pessoa: ChaveEmA, funcao: string): EscalaDoPlano => ({
  etapa,
  pessoa,
  funcao,
  estado: 'pendente',
})

const LICAO: TarefaDoPlano = { titulo: 'Imprimir a lição da semana', responsavel: 'organizador' }

/**
 * Agenda das próximas cinco semanas e das duas anteriores, contada a partir de
 * `hoje` (data local da comunidade). Mesma data, mesmo plano: rodar a semente
 * duas vezes no mesmo dia pede exatamente as mesmas coisas.
 */
export function planoDaComunidadeA(hoje: string): PlanoDaComunidadeA {
  const s = (semanas: number) => proximoSabado(hoje, semanas)
  const retiro = s(4)

  const eventos: EventoDoPlano[] = [
    sabadoJovem({
      data: sabadoPassado(hoje, 2),
      tema: 'gratidão no dia a dia',
      passado: true,
      escalas: [
        confirmada(null, 'admin2', 'Coordenação'),
        confirmada('Boas-vindas', 'camila', 'Recepção'),
        confirmada('Louvor', 'mateus', 'Violão'),
        confirmada('Louvor', 'leticia', 'Vocal'),
        confirmada('Oração intercessora', 'membro', 'Condução'),
        confirmada('Dinâmica', 'davi', 'Condução'),
        confirmada('Estudo da lição', 'organizador', 'Condução'),
      ],
      tarefas: [{ ...LICAO, concluida: true }],
      presencas: [
        'organizador',
        'membro',
        'admin2',
        'mateus',
        'leticia',
        'davi',
        'camila',
        'gustavo',
        'beatriz',
      ],
    }),
    sabadoJovem({
      data: sabadoPassado(hoje, 1),
      tema: 'amizades que fortalecem',
      passado: true,
      escalas: [
        confirmada(null, 'organizador', 'Coordenação'),
        confirmada('Boas-vindas', 'julia', 'Recepção'),
        confirmada('Louvor', 'mateus', 'Violão'),
        confirmada('Louvor', 'membro', 'Vocal'),
        confirmada('Louvor', 'thiago', 'Projeção'),
        confirmada('Oração intercessora', 'beatriz', 'Condução'),
        confirmada('Dinâmica', 'pedro', 'Condução'),
        confirmada('Estudo da lição', 'organizador', 'Condução'),
        confirmada('Brinde', 'camila', 'Brinde'),
        confirmada('Encerramento', 'larissa', 'Condução'),
      ],
      tarefas: [
        { ...LICAO, concluida: true },
        { titulo: 'Comprar o brinde', responsavel: 'camila', concluida: true },
      ],
      presencas: [
        'organizador',
        'membro',
        'admin',
        'mateus',
        'julia',
        'thiago',
        'beatriz',
        'pedro',
        'camila',
        'larissa',
        'gustavo',
        'nas_duas',
      ],
      visitantes: ['Paula, amiga da Júlia'],
    }),
    sabadoJovem({
      data: s(0),
      tema: 'coragem para recomeçar',
      publico: true,
      escalas: [
        confirmada(null, 'organizador', 'Coordenação'),
        confirmada('Boas-vindas', 'larissa', 'Recepção'),
        // As duas primeiras são as da semente antiga (vocal e violão no louvor).
        confirmada('Louvor', 'membro', 'Vocal'),
        pendente('Louvor', 'organizador', 'Violão'),
        confirmada('Louvor', 'mateus', 'Teclado'),
        confirmada('Louvor', 'thiago', 'Projeção'),
        confirmada('Oração intercessora', 'beatriz', 'Condução'),
        pendente('Dinâmica', 'davi', 'Condução'),
        confirmada('Estudo da lição', 'organizador', 'Condução'),
        confirmada('Brinde', 'camila', 'Brinde'),
        confirmada('Encerramento', 'gustavo', 'Condução'),
      ],
      tarefas: [
        LICAO,
        {
          titulo: 'Comprar o brinde',
          descricao: 'Algo simples para umas 40 pessoas.',
          responsavel: 'camila',
          prazo: { data: somarDias(s(0), -1), hora: '18:00' },
        },
        {
          titulo: 'Testar o projetor e o som',
          responsavel: 'thiago',
          prazo: { data: s(0), hora: '15:30' },
        },
      ],
    }),
    {
      titulo: 'Noite de jogos',
      descricao: 'Jogos de tabuleiro e lanche.',
      categoria: 'Noite de jogos',
      inicio: { data: s(1), hora: '19:30' },
      duracaoMin: 150,
      status: 'publicado',
      visibilidade: 'interna',
      local: 'salao',
      identidade: 'data',
      autor: 'admin',
      etapas: [],
      checklist: [],
      escalas: [],
      tarefas: [{ titulo: 'Levar jogos de tabuleiro', responsavel: 'davi' }],
      inscricoes: [],
      presencas: [],
      visitantes: [],
    },
    sabadoJovem({
      data: s(1),
      tema: 'servir com alegria',
      escalas: [
        pendente(null, 'organizador', 'Coordenação'),
        pendente('Boas-vindas', 'julia', 'Recepção'),
        confirmada('Louvor', 'mateus', 'Violão'),
        pendente('Louvor', 'membro', 'Vocal'),
        confirmada('Louvor', 'leticia', 'Vocal'),
        confirmada('Louvor', 'thiago', 'Projeção', {
          pedirSubstituicao: 'Vou viajar com a família neste fim de semana.',
        }),
        confirmada('Oração intercessora', 'pedro', 'Condução'),
        confirmada('Dinâmica', 'membro', 'Condução'),
        pendente('Estudo da lição', 'admin2', 'Condução'),
        pendente('Brinde', 'larissa', 'Brinde'),
        confirmada('Encerramento', 'davi', 'Condução'),
      ],
      tarefas: [
        LICAO,
        {
          titulo: 'Preparar a dinâmica do sábado',
          descricao: 'A "Teia da amizade" está em Conteúdos.',
          responsavel: 'membro',
          prazo: { data: somarDias(s(1), -2), hora: '20:00' },
        },
      ],
    }),
    {
      titulo: 'Noite de Louvor',
      descricao: 'Uma noite só de música e oração, com espaço para quem quiser compartilhar.',
      categoria: 'Noite de louvor',
      inicio: { data: somarDias(s(2), -1), hora: '20:00' },
      duracaoMin: 120,
      status: 'publicado',
      visibilidade: 'interna',
      local: 'salao',
      identidade: 'data',
      autor: 'mateus',
      etapas: [
        { titulo: 'Abertura', duracaoMin: 10 },
        { titulo: 'Louvor', duracaoMin: 60 },
        { titulo: 'Momento de oração', duracaoMin: 20 },
        { titulo: 'Partilha', duracaoMin: 20 },
        { titulo: 'Encerramento', duracaoMin: 10 },
      ],
      checklist: [
        { tipo: 'preparacao', texto: 'Montar o som e testar os microfones', responsavel: 'thiago' },
        { tipo: 'preparacao', texto: 'Separar as cifras impressas', responsavel: 'mateus' },
        { tipo: 'encerramento', texto: 'Guardar os instrumentos' },
      ],
      escalas: [
        confirmada(null, 'mateus', 'Coordenação'),
        confirmada('Abertura', 'organizador', 'Condução'),
        confirmada('Louvor', 'mateus', 'Violão'),
        confirmada('Louvor', 'membro', 'Vocal'),
        confirmada('Louvor', 'leticia', 'Vocal'),
        pendente('Momento de oração', 'beatriz', 'Condução'),
        pendente('Louvor', 'thiago', 'Som'),
      ],
      tarefas: [],
      inscricoes: [],
      presencas: [],
      visitantes: [],
    },
    sabadoJovem({
      data: s(2),
      tema: 'escolhas e propósito',
      escalas: [
        pendente(null, 'organizador', 'Coordenação'),
        pendente('Boas-vindas', 'camila', 'Recepção'),
        pendente('Louvor', 'mateus', 'Violão'),
        pendente('Louvor', 'beatriz', 'Vocal'),
        pendente('Oração intercessora', 'organizador', 'Condução'),
        pendente('Dinâmica', 'julia', 'Condução'),
        pendente('Estudo da lição', 'gustavo', 'Condução'),
        pendente('Encerramento', 'pedro', 'Condução'),
      ],
      tarefas: [LICAO],
    }),
    sabadoJovem({
      data: s(3),
      tema: 'esperança que não desiste',
      escalas: [
        pendente(null, 'admin2', 'Coordenação'),
        pendente('Louvor', 'mateus', 'Violão'),
        pendente('Louvor', 'leticia', 'Vocal'),
        pendente('Dinâmica', 'larissa', 'Condução'),
        pendente('Estudo da lição', 'organizador', 'Condução'),
      ],
    }),
    {
      titulo: 'Retiro de Verão',
      descricao:
        'Um dia inteiro no sítio, com louvor, palestra, gincana e piscina. Traga um amigo!',
      categoria: 'Retiro',
      inicio: { data: retiro, hora: '08:00' },
      duracaoMin: 570,
      status: 'publicado',
      visibilidade: 'publica',
      local: 'sitio',
      capacidade: 40,
      listaDeEspera: true,
      inscricaoAte: { data: somarDias(retiro, -3), hora: '23:59' },
      informacoesUteis:
        'Saída às 7h em frente ao salão da igreja. Leve roupa de banho, protetor solar, ' +
        'garrafa de água e Bíblia. O almoço está incluído.',
      identidade: 'proximo',
      autor: 'admin',
      etapas: [
        { titulo: 'Chegada e café da manhã', duracaoMin: 60 },
        { titulo: 'Louvor', duracaoMin: 30 },
        {
          titulo: 'Palestra',
          duracaoMin: 60,
          descricao: 'Com Helena Prado: ansiedade, propósito e fé no dia a dia.',
        },
        { titulo: 'Almoço', duracaoMin: 90 },
        { titulo: 'Gincana', duracaoMin: 120 },
        { titulo: 'Piscina e tempo livre', duracaoMin: 120 },
        { titulo: 'Roda de conversa', duracaoMin: 60 },
        { titulo: 'Louvor de encerramento', duracaoMin: 30 },
      ],
      checklist: [
        { tipo: 'preparacao', texto: 'Conferir a lista de inscritos', responsavel: 'organizador' },
        { tipo: 'preparacao', texto: 'Separar o kit de primeiros socorros', responsavel: 'admin2' },
        { tipo: 'preparacao', texto: 'Levar caixa de som e extensão', responsavel: 'thiago' },
        {
          tipo: 'encerramento',
          texto: 'Conferir se todos voltaram no ônibus',
          responsavel: 'admin',
        },
        { tipo: 'encerramento', texto: 'Recolher o lixo e o material da gincana' },
      ],
      escalas: [
        confirmada(null, 'admin', 'Coordenação'),
        pendente('Louvor', 'mateus', 'Violão'),
        pendente('Louvor', 'membro', 'Vocal'),
        confirmada('Gincana', 'gustavo', 'Condução'),
        pendente('Roda de conversa', 'organizador', 'Condução'),
      ],
      tarefas: [
        { titulo: 'Reservar o ônibus', responsavel: 'admin2', concluida: true },
        {
          titulo: 'Montar as equipes da gincana',
          responsavel: 'gustavo',
          prazo: { data: somarDias(retiro, -7), hora: '20:00' },
        },
        {
          titulo: 'Fechar o cardápio do almoço',
          responsavel: 'camila',
          prazo: { data: somarDias(retiro, -10), hora: '20:00' },
        },
      ],
      inscricoes: [
        'membro',
        'organizador',
        'julia',
        'pedro',
        'larissa',
        'mateus',
        'beatriz',
        'gustavo',
        'davi',
        'camila',
      ],
      presencas: [],
      visitantes: [],
    },
  ]

  return {
    locais: LOCAIS_DE_A,
    eventos,
    avisos: [
      {
        autor: 'mateus',
        titulo: 'Ensaio do louvor às 15h',
        texto:
          'Neste sábado o ensaio começa às 15h, no salão. Quem canta ou toca, chegue um ' +
          'pouquinho antes para afinarmos tudo com calma.',
        fixado: true,
      },
      {
        autor: 'admin',
        titulo: 'Inscrições abertas para o Retiro de Verão',
        texto:
          'As vagas são limitadas e a inscrição é pela Agenda. Chame um amigo: a página do ' +
          'retiro pode ser compartilhada.',
        fixado: false,
      },
      {
        autor: 'organizador',
        titulo: 'Bem-vindos, novos amigos!',
        texto:
          'Que alegria ver gente nova chegando! Se é a sua primeira vez, procure a equipe de ' +
          'recepção na entrada. Estamos felizes por você estar aqui.',
        fixado: false,
      },
    ],
    pedidosDeOracao: [
      {
        autor: 'larissa',
        visibilidade: 'comunidade',
        texto: 'Pela prova do ENEM da Júlia. Que ela vá tranquila e confiante.',
        horasAtras: 50,
        orando: ['membro', 'organizador', 'beatriz', 'pedro', 'mateus'],
      },
      {
        autor: 'mateus',
        visibilidade: 'comunidade',
        texto: 'Pela recuperação da avó do Pedro, que já está em casa descansando.',
        horasAtras: 30,
        orando: ['membro', 'larissa', 'davi', 'admin', 'julia'],
      },
      {
        autor: 'membro',
        visibilidade: 'comunidade',
        texto: 'Pelo nosso Retiro de Verão: que seja um tempo bom de amizade e de aprender juntos.',
        horasAtras: 20,
        orando: ['organizador', 'julia', 'gustavo'],
      },
      {
        autor: 'thiago',
        visibilidade: 'comunidade',
        texto: 'Por sabedoria para escolher o curso da faculdade.',
        horasAtras: 8,
        orando: ['organizador', 'camila'],
      },
      {
        autor: 'gustavo',
        visibilidade: 'comunidade',
        texto: 'Pela entrevista do meu primeiro estágio.',
        horasAtras: 120,
        respondido: true,
        orando: ['membro', 'leticia', 'thiago', 'mateus'],
      },
      {
        autor: 'membro',
        visibilidade: 'somente_eu',
        texto: 'Por paciência e foco nesta reta final do semestre.',
        horasAtras: 3,
        orando: [],
      },
    ],
    sugestoes: [
      {
        autor: 'pedro',
        anonima: false,
        titulo: 'Piquenique no parque',
        texto:
          'Que tal um piquenique num domingo à tarde, com louvor ao ar livre e jogos? Cada um ' +
          'leva alguma coisa.',
        status: 'recebida',
        horasAtras: 6,
      },
      {
        autor: 'leticia',
        anonima: true,
        titulo: 'Estudo em grupos menores',
        texto:
          'No grupo grande algumas pessoas ficam com vergonha de falar. Dividir o estudo em ' +
          'grupos menores ajudaria todo mundo a participar.',
        status: 'em_analise',
        moderadaPor: 'organizador',
        horasAtras: 72,
      },
      {
        autor: 'membro',
        anonima: false,
        titulo: 'Lista com as músicas do louvor',
        texto:
          'Seria ótimo ter as músicas que cantamos aos sábados num lugar só, com o tom, para ' +
          'ensaiar em casa.',
        status: 'aceita',
        resposta: 'Ótima ideia! As músicas já estão em Conteúdos, com o tom de cada uma.',
        moderadaPor: 'organizador',
        horasAtras: 160,
      },
    ],
    musicas: {
      autor: 'mateus',
      itens: [
        {
          titulo: 'Canção de abertura',
          artista: 'Equipe de louvor',
          tom: 'G',
          observacoes: 'Começa só com violão e voz; a banda entra no refrão.',
        },
        {
          titulo: 'Castelo Forte',
          artista: 'Hino tradicional',
          tom: 'C',
          observacoes: 'Andamento firme, sem pressa.',
        },
        {
          titulo: 'Santo, Santo, Santo',
          artista: 'Hino tradicional',
          tom: 'D',
          observacoes: 'Boa para o momento de oração.',
        },
        {
          titulo: 'Sublime Graça',
          artista: 'Hino tradicional',
          tom: 'G',
          observacoes: 'Última estrofe só com as vozes.',
        },
        {
          titulo: 'Canção de encerramento',
          artista: 'Equipe de louvor',
          tom: 'E',
          observacoes: 'Todos de pé, em roda.',
        },
      ],
    },
    palestrantes: {
      autor: 'admin',
      itens: [
        {
          nome: 'Helena Prado',
          temas: 'Ansiedade, propósito e fé no dia a dia',
          origem: 'Convidada de uma comunidade vizinha',
          observacoes: 'Prefere falar no começo da tarde.',
        },
        {
          nome: 'Samuel Brandão',
          temas: 'Estudo bíblico para quem está começando',
          origem: 'Professor da escola bíblica',
          observacoes: null,
        },
      ],
    },
    dinamicas: {
      autor: 'organizador',
      itens: [
        {
          titulo: 'Teia da amizade',
          objetivo: 'Ajudar quem chegou agora a conhecer o grupo.',
          instrucoes:
            'Em roda, quem está com o novelo diz o nome e algo de que gosta, segura a ponta do ' +
            'fio e joga o novelo para outra pessoa. No fim, a teia mostra como estamos ligados ' +
            'uns aos outros.',
          duracaoMin: 15,
          materiais: 'Um novelo de lã.',
        },
      ],
    },
    disponibilidades: [
      { pessoa: 'membro', data: s(3), disponivel: false, observacao: 'Viagem em família.' },
      {
        pessoa: 'organizador',
        data: s(3),
        disponivel: true,
        observacao: 'Posso ajudar no som se precisar.',
      },
    ],
  }
}
