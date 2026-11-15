import { Platform, useWindowDimensions } from 'react-native'

import { LARGURA_DA_BARRA_LATERAL } from '@/constantes'

import { TelaPerfil } from '../perfil/TelaPerfil'
import { TelaMais } from './TelaMais'

/**
 * Quinta aba: na web larga é o Perfil (os módulos estão na barra lateral);
 * no celular e na web estreita é "Mais", com o Perfil dentro.
 */
export function AbaPerfilOuMais() {
  const { width } = useWindowDimensions()
  const lateral = Platform.OS === 'web' && width >= LARGURA_DA_BARRA_LATERAL
  return lateral ? <TelaPerfil /> : <TelaMais />
}
