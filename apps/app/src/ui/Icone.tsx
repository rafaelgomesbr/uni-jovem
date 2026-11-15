import { SymbolView } from 'expo-symbols'
import type { ColorValue } from 'react-native'
import { IconeDeTraco, TRACOS, type NomeDoTraco } from './IconeDeTraco'

/**
 * Catálogo de ícones: SF Symbols no iOS, Material Symbols no Android e na web
 * (a fonte vem com o expo-symbols, sem dependência nova). Ícone é sempre
 * decorativo: o sentido vai no texto ou no rótulo acessível ao lado.
 */
export const ICONES = {
  inicio: { ios: 'house', android: 'home', web: 'home' },
  agenda: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  programacoes: { ios: 'list.bullet.rectangle', android: 'event_note', web: 'event_note' },
  comunidade: { ios: 'person.3', android: 'groups', web: 'groups' },
  perfil: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  erro: { ios: 'exclamationmark.triangle', android: 'error', web: 'error' },
  semConexao: { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' },
  copiar: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  compartilhar: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  trocar: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },
  adicionar: { ios: 'plus', android: 'add', web: 'add' },
  sair: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  seguranca: { ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' },
  aparelho: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  computador: { ios: 'laptopcomputer', android: 'laptop', web: 'laptop' },
  confirmado: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  mostrar: { ios: 'eye', android: 'visibility', web: 'visibility' },
  ocultar: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  avancar: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  abrirLista: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  // Barra de abas: traços como no mockup (casa, calendário, três linhas, duas pessoas).
  abaInicio: { ios: 'house', android: 'home', web: 'home' },
  abaAgenda: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  abaProgramas: { ios: 'text.alignleft', android: 'notes', web: 'notes' },
  abaEquipe: { ios: 'person.2', android: 'group', web: 'group' },
  voltar: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  email: { ios: 'envelope', android: 'mail', web: 'mail' },
  tarefas: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  escalas: { ios: 'person.badge.clock', android: 'assignment_ind', web: 'assignment_ind' },
  eventos: { ios: 'calendar.badge.clock', android: 'event', web: 'event' },
  plataforma: { ios: 'building.2', android: 'domain', web: 'domain' },
  excluir: { ios: 'trash', android: 'delete', web: 'delete' },
  convidar: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  link: { ios: 'link', android: 'link', web: 'link' },
  fechar: { ios: 'xmark', android: 'close', web: 'close' },
  chave: { ios: 'key', android: 'key', web: 'key' },
  oracao: { ios: 'hands.sparkles', android: 'volunteer_activism', web: 'volunteer_activism' },
  editar: { ios: 'pencil', android: 'edit', web: 'edit' },
  subir: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  descer: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  iniciar: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pausar: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  encerrar: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  proximaEtapa: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' },
  etapaAnterior: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' },
  aoVivo: {
    ios: 'dot.radiowaves.left.and.right',
    android: 'sensors',
    web: 'sensors',
  },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  buscar: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  local: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  relogio: { ios: 'clock', android: 'schedule', web: 'schedule' },
  duplicar: { ios: 'plus.square.on.square', android: 'library_add', web: 'library_add' },
  repetir: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  cancelar: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
  inscricoes: { ios: 'person.crop.rectangle.stack', android: 'how_to_reg', web: 'how_to_reg' },
  material: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' },
  nota: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  etapas: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' },
  pendente: { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
  mapa: { ios: 'map', android: 'map', web: 'map' },
  publicar: { ios: 'paperplane', android: 'send', web: 'send' },
  modelo: { ios: 'doc.on.clipboard', android: 'content_paste', web: 'content_paste' },
  mais: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
  sugestao: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  aviso: { ios: 'megaphone', android: 'campaign', web: 'campaign' },
  conteudo: { ios: 'music.note.list', android: 'library_music', web: 'library_music' },
  musica: { ios: 'music.note', android: 'music_note', web: 'music_note' },
  pessoa: { ios: 'person', android: 'person', web: 'person' },
  relatorio: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  versiculo: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  missao: { ios: 'flag', android: 'flag', web: 'flag' },
  fixar: { ios: 'pin', android: 'push_pin', web: 'push_pin' },
  baixar: { ios: 'arrow.down.circle', android: 'download', web: 'download' },
  sino: { ios: 'bell', android: 'notifications', web: 'notifications' },
  sinoDesligado: { ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' },
  ajustes: { ios: 'gearshape', android: 'settings', web: 'settings' },
  denuncia: { ios: 'flag.badge.ellipsis', android: 'report', web: 'report' },
  documento: { ios: 'doc.text', android: 'description', web: 'description' },
  ajuda: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  anonimo: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  celebrar: { ios: 'sparkles', android: 'celebration', web: 'celebration' },
  sincronizar: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  guardadoNoAparelho: { ios: 'externaldrive', android: 'offline_pin', web: 'offline_pin' },
  // Seção 2.10 e componentes da 2.12.
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  erroDeCampo: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  avisoInfo: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  avisoSucesso: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  avisoAlerta: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  avisoErro: { ios: 'xmark.octagon.fill', android: 'report', web: 'report' },
  maisAcoes: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  externo: { ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' },
  faceId: { ios: 'faceid', android: 'face', web: 'face' },
  pessoas: { ios: 'person.2', android: 'group', web: 'group' },
  calendario: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  limpar: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
} as const

export type NomeDoIcone = keyof typeof ICONES

/** Peso do traço: médio por padrão (o traço de 2 px do mockup); `forte` na aba ativa e no chevron. */
export type PesoDoIcone = 'medio' | 'semibold' | 'forte'

const PESO_DO_SIMBOLO = { medio: 'medium', semibold: 'semibold', forte: 'bold' } as const
const TRACO = { medio: 2, semibold: 2.25, forte: 2.5 } as const

interface PropsDoIcone {
  nome: NomeDoIcone
  cor: ColorValue
  tamanho?: number
  peso?: PesoDoIcone
}

/** Tamanhos da 2.10: 22 na barra de abas; 18 em botões, avisos, toast e ladrilho; 16 no status, erro e chip; 14 no chevron. */
export function Icone({ nome, cor, tamanho = 22, peso = 'medio' }: PropsDoIcone) {
  // Os ícones que aparecem no mockup aprovado usam o desenho exato dele.
  if (nome in TRACOS) {
    return (
      <IconeDeTraco nome={nome as NomeDoTraco} cor={cor} tamanho={tamanho} traco={TRACO[peso]} />
    )
  }
  return (
    <SymbolView
      name={ICONES[nome]}
      tintColor={cor}
      size={tamanho}
      weight={PESO_DO_SIMBOLO[peso]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}
