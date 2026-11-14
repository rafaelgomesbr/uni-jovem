import { useQuery } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDaPlataforma } from '@/servicos/contrato'

export function useComunidadesDaPlataforma() {
  const { conta } = useSessao()
  return useQuery({
    queryKey: CHAVES.plataforma,
    queryFn: () =>
      api
        .get<{ comunidades: ComunidadeDaPlataforma[] }>('/api/v1/plataforma/comunidades')
        .then((r) => r.comunidades),
    enabled: conta?.criador === true,
  })
}
