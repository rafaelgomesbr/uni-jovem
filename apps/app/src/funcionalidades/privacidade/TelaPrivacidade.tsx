import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Platform } from 'react-native'

import { api } from '@/servicos/api'
import { origemPublica } from '@/servicos/enderecos'
import { abrirLink } from '@/utilidades/compartilhar'
import { salvarArquivo } from '@/utilidades/salvarArquivo'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

/** TC-14.v1, adaptado: a API gera o arquivo na hora e ele vem direto para você. */
export const TEXTO_DA_EXPORTACAO =
  'Vamos gerar um arquivo com os seus dados: conta, comunidades, escalas, inscrições, presenças, seus pedidos de oração e suas sugestões. Só você pode gerar o seu. Guarde-o com cuidado: ele contém seus pedidos de oração sem cifragem.'

export const DOCUMENTOS = [
  { caminho: '/privacidade', titulo: 'Política de Privacidade', icone: 'seguranca' },
  { caminho: '/termos', titulo: 'Termos de Uso', icone: 'documento' },
  { caminho: '/suporte', titulo: 'Suporte', icone: 'ajuda' },
] as const

export function abrirDocumento(caminho: string) {
  return abrirLink(`${origemPublica()}${caminho}`)
}

/** Rota `/privacidade`: meus dados, documentos e excluir conta. */
export function TelaPrivacidade() {
  const exportar = useMutation({
    mutationFn: async () =>
      salvarArquivo(
        'meus-dados-uni-jovem.json',
        await api.pedir<string>('/api/v1/eu/exportar', { formato: 'texto' }),
        'json',
      ),
    // O resultado tem pedidos de oração em claro: nada fica em cache.
    gcTime: 0,
  })

  return (
    <Tela cabecalhoNativo titulo="Privacidade e dados">
      <Cartao titulo="Exportar meus dados" icone="baixar">
        <Texto>{TEXTO_DA_EXPORTACAO}</Texto>
        {exportar.error ? <AvisoDeErro erro={exportar.error} /> : null}
        {exportar.isSuccess ? (
          <Aviso tipo="sucesso" anunciar>
            {Platform.OS === 'web'
              ? 'Arquivo baixado: meus-dados-uni-jovem.json.'
              : 'Arquivo pronto. Escolha onde guardar na folha de compartilhamento.'}
          </Aviso>
        ) : null}
        <Botao
          titulo="Gerar arquivo"
          icone="baixar"
          carregando={exportar.isPending}
          aoPressionar={() => exportar.mutate()}
        />
      </Cartao>

      <Cartao titulo="Documentos" icone="documento">
        {DOCUMENTOS.map((d) => (
          <Linha
            key={d.caminho}
            icone={d.icone}
            titulo={d.titulo}
            descricao="Abre no navegador."
            aoPressionar={() => void abrirDocumento(d.caminho)}
          />
        ))}
      </Cartao>

      <Cartao titulo="Excluir conta" icone="excluir">
        <Texto variante="apoio" cor="textoSuave">
          Apaga sua conta e sai de todas as comunidades. Pede sua senha.
        </Texto>
        <Botao
          titulo="Excluir minha conta"
          icone="excluir"
          variante="perigo"
          aoPressionar={() => router.push('/excluir-conta')}
        />
      </Cartao>
    </Tela>
  )
}
