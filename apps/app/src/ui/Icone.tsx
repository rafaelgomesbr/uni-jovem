import { SymbolView } from 'expo-symbols'
import type { ColorValue } from 'react-native'

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
} as const

export type NomeDoIcone = keyof typeof ICONES

interface PropsDoIcone {
  nome: NomeDoIcone
  cor: ColorValue
  tamanho?: number
}

export function Icone({ nome, cor, tamanho = 22 }: PropsDoIcone) {
  return (
    <SymbolView
      name={ICONES[nome]}
      tintColor={cor}
      size={tamanho}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}
