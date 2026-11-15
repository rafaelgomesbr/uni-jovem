import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Texto } from '@/ui/Texto'

import { ITENS_PESSOAIS, useGruposDoMais } from './mais'
import { TelaDoApp } from './TelaDoApp'

/**
 * Aba "Mais" (celular e web estreita): módulos da comunidade conforme o papel
 * e os atalhos pessoais. Nada essencial fica escondido em gesto.
 */
export function TelaMais() {
  const { conta, comunidadeAtiva } = useSessao()
  const grupos = useGruposDoMais()
  return (
    <TelaDoApp titulo="Mais">
      {comunidadeAtiva ? (
        grupos.map((g) => (
          <Cartao key={g.titulo} titulo={g.titulo}>
            {g.itens.map((i) => (
              <Linha
                key={i.rotulo}
                icone={i.icone}
                titulo={i.rotulo}
                descricao={i.descricao}
                aoPressionar={() => router.push(i.href)}
              />
            ))}
          </Cartao>
        ))
      ) : (
        <Texto variante="apoio" cor="textoSuave">
          Escolha uma comunidade no topo para ver avisos, sugestões, oração e conteúdos.
        </Texto>
      )}
      <Cartao titulo={conta ? conta.nome : 'Você'} icone="perfil">
        {conta ? (
          <Texto variante="apoio" cor="textoSuave">
            {conta.email}
          </Texto>
        ) : null}
        {ITENS_PESSOAIS.map((i) => (
          <Linha
            key={i.rotulo}
            icone={i.icone}
            titulo={i.rotulo}
            descricao={i.descricao}
            aoPressionar={() => router.push(i.href)}
          />
        ))}
      </Cartao>
    </TelaDoApp>
  )
}
