import { router } from 'expo-router'

import { Aviso } from '@/ui/Aviso'
import { Cartao } from '@/ui/Cartao'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'

/**
 * Rota `/louvor` (D61, D71): o atalho "Louvor" da aba Comunidade. Reúne o caminho para o Meu
 * repertório, a Biblioteca de músicas e os músicos, e lembra onde fica o repertório de cada
 * encontro (no próprio encontro, na etapa do Louvor).
 */
export function TelaLouvor() {
  const pode = usePode()
  const gerencia = pode('conteudo', 'gerenciar')
  return (
    <TelaDaComunidade
      oQue="o louvor"
      titulo="Louvor"
      descricao="Músicas, cifras e o repertório dos encontros."
    >
      {() => (
        <>
          <EntradaEmCascata ordem={1}>
            <Cartao lista>
              <Lista>
                <LinhaDeLista
                  icone="musica"
                  titulo="Meu repertório"
                  descricao="As músicas que você toca no próximo encontro, no tom do dia."
                  rotuloAcessivel="Meu repertório. As músicas que você toca no próximo encontro, no tom do dia."
                  aoPressionar={() => router.push('/meu-repertorio')}
                />
                <LinhaDeLista
                  icone="conteudo"
                  titulo="Biblioteca de músicas"
                  descricao={
                    gerencia
                      ? 'Cadastre músicas, cifras, tons e andamento.'
                      : 'As músicas da comunidade, com cifras, tons e andamento.'
                  }
                  rotuloAcessivel="Biblioteca de músicas. As músicas da comunidade."
                  aoPressionar={() =>
                    router.push({ pathname: '/conteudos', params: { tipo: 'musicas' } })
                  }
                />
                <LinhaDeLista
                  icone="pessoa"
                  titulo="Músicos"
                  descricao="Quem toca na comunidade e o que toca."
                  rotuloAcessivel="Músicos. Quem toca na comunidade e o que toca."
                  aoPressionar={() =>
                    router.push({ pathname: '/conteudos', params: { tipo: 'musicos' } })
                  }
                />
                <LinhaDeLista
                  icone="eventos"
                  titulo="Encontros"
                  descricao="Abra o encontro e veja o repertório do louvor e a banda."
                  rotuloAcessivel="Encontros. Abra o encontro e veja o repertório do louvor e a banda."
                  aoPressionar={() => router.push('/agenda')}
                />
              </Lista>
            </Cartao>
          </EntradaEmCascata>
          <Aviso tipo="info" titulo="Só dentro da comunidade">
            As letras e cifras ficam visíveis só para quem é da comunidade: não há link público nem
            exportação.
          </Aviso>
        </>
      )}
    </TelaDaComunidade>
  )
}
