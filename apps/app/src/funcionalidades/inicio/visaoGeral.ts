import { useQuery } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { MinhaVisaoGeral, VisaoGeralDaComunidade } from '@/servicos/contratoDosEventos'

import { naComunidade } from '../eventos/consultas'

/** Os números da própria pessoa na comunidade (`GET /visao-geral`, todo membro). */
export function useMinhaVisaoGeral(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.visaoGeral(comunidadeId, 'minha'),
    queryFn: () =>
      api.get<MinhaVisaoGeral>(`${naComunidade(comunidadeId)}/visao-geral?escopo=minha`),
  })
}

/** Os números da comunidade inteira: só organizador e administrador (membro recebe 403). */
export function useVisaoGeralDaComunidade(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.visaoGeral(comunidadeId, 'comunidade'),
    queryFn: () =>
      api.get<VisaoGeralDaComunidade>(
        `${naComunidade(comunidadeId)}/visao-geral?escopo=comunidade`,
      ),
  })
}
