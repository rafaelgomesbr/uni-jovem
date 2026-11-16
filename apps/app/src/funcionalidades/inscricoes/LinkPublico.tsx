import { linkPublicoDoEvento } from '@/servicos/enderecos'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { compartilharTexto, copiarTexto } from '@/utilidades/compartilhar'

interface Props {
  idPublico: string
  titulo: string
}

/**
 * "PÁGINA PÚBLICA": o link de inscrição para copiar ou mandar (WhatsApp pela
 * folha do sistema), sem caixa dentro do cartão. A confirmação vai em toast.
 */
export function LinkPublico({ idPublico, titulo }: Props) {
  const link = linkPublicoDoEvento(idPublico)
  return (
    <CartaoDeVidro
      sobrancelha="Página pública"
      acoes={
        <ParDeBotoes>
          <Botao
            titulo="Copiar link"
            icone="copiar"
            variante="secundario"
            aoPressionar={async () => {
              const ok = await copiarTexto(link)
              mostrarToast(
                ok
                  ? { texto: 'Link copiado.' }
                  : { texto: 'Não foi possível copiar. Selecione o link acima.', tipo: 'erro' },
              )
            }}
          />
          <Botao
            titulo="Compartilhar"
            icone="compartilhar"
            variante="secundario"
            rotuloAcessivel="Compartilhar o link da página pública (WhatsApp e outros apps)"
            aoPressionar={async () => {
              const r = await compartilharTexto(`${titulo}: inscreva-se pelo link\n${link}`)
              if (r === 'copiado') {
                mostrarToast({
                  texto: 'O compartilhamento não abriu aqui; o link foi copiado.',
                  tipo: 'info',
                })
              } else if (r === 'falhou') {
                mostrarToast({ texto: 'Não foi possível compartilhar agora.', tipo: 'erro' })
              }
            }}
          />
        </ParDeBotoes>
      }
    >
      <Texto variante="corpo" cor="textoSuave">
        Quem recebe o link vê as informações do encontro e se inscreve com nome e WhatsApp, sem
        precisar de conta. A lista de participantes nunca aparece lá.
      </Texto>
      <Texto variante="legenda" selectable numberOfLines={1} ellipsizeMode="middle">
        {link}
      </Texto>
    </CartaoDeVidro>
  )
}
