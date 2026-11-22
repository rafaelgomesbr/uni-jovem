import { Redirect } from 'expo-router'

/**
 * Rota antiga, juntada a "Tenho um código" (UX v3, seção 2.6): a mesma tela aceita código, link do
 * código e link de convite, com ou sem conta. Fica como redirecionamento por um ciclo de
 * lançamento, para os links e as notificações que ainda apontam para cá.
 */
export default function Rota() {
  return <Redirect href="/tenho-um-codigo" />
}
