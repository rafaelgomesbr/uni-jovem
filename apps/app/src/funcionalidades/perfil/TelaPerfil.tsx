import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Conta } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { normalizarWhatsApp } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { MissoesDeConfiguracao } from '../onboarding/MissoesDeConfiguracao'
import { abrirDocumento, DOCUMENTOS } from '../privacidade/TelaPrivacidade'

/** Perfil: aba na web larga; no celular, abre pelo "Mais" (`/conta`, na pilha). */
export function TelaPerfil({ naPilha = false }: { naPilha?: boolean }) {
  const { conta, sair, comunidadeAtiva } = useSessao()
  const pode = usePode()
  const [saindo, setSaindo] = useState(false)
  const Moldura = naPilha ? TelaNaPilha : TelaDoApp

  if (!conta) return null

  async function pedirParaSair() {
    const ok = await confirmar({
      titulo: 'Sair deste aparelho?',
      mensagem: 'Você vai precisar do e-mail e da senha para entrar de novo.',
      confirmar: 'Sair',
      destrutivo: true,
    })
    if (!ok) return
    setSaindo(true)
    await sair()
  }

  return (
    <Moldura titulo="Perfil">
      <DadosDaConta conta={conta} />

      <Cartao titulo="Notificações" icone="sino">
        <Linha
          titulo="Notificações"
          descricao="O que o app avisa, por tipo e por comunidade, e a permissão do aparelho."
          icone="sino"
          aoPressionar={() => router.push('/notificacoes')}
        />
        <Linha
          titulo="Versículo do dia"
          descricao="Ligar, desligar e escolher o horário."
          icone="versiculo"
          aoPressionar={() => router.push('/versiculo')}
        />
      </Cartao>

      <Cartao titulo="Mapa da missão" icone="missao">
        <Linha
          titulo="Rever o mapa da missão"
          descricao="O passeio pelo app, com exemplos que não mudam nada de verdade."
          icone="missao"
          aoPressionar={() => router.push({ pathname: '/missao', params: { rever: '1' } })}
        />
        <MissoesDeConfiguracao />
      </Cartao>

      <Cartao titulo="Segurança" icone="seguranca">
        <Linha
          titulo="Verificação em duas etapas"
          descricao={
            conta.doisFatores
              ? 'Ligada: além da senha, o app autenticador confirma que é você.'
              : 'Desligada. Recomendado para quem administra uma comunidade.'
          }
          extra={
            <Selo
              texto={conta.doisFatores ? 'Ligada' : 'Desligada'}
              cor={conta.doisFatores ? 'sucesso' : 'alerta'}
            />
          }
        />
        {!conta.doisFatores ? (
          <Botao
            titulo="Ligar a verificação em duas etapas"
            icone="seguranca"
            variante="secundario"
            aoPressionar={() => router.push('/ativar-2fa')}
          />
        ) : null}
        <Linha
          titulo="Aparelhos conectados"
          descricao="Veja onde sua conta está aberta e desconecte o que não reconhecer."
          icone="aparelho"
          aoPressionar={() => router.push('/aparelhos')}
        />
      </Cartao>

      {conta.criador ? (
        <Cartao titulo="Plataforma" icone="plataforma">
          <Linha
            titulo="Comunidades da plataforma"
            descricao="Criar, suspender, reativar e agendar exclusão de comunidades."
            aoPressionar={() => router.push('/plataforma')}
          />
        </Cartao>
      ) : null}

      {comunidadeAtiva && pode('denuncia', 'ler') ? (
        <Cartao titulo="Administração" icone="denuncia">
          <Linha
            titulo="Denúncias"
            descricao={`Conteúdos de ${comunidadeAtiva.nome} apontados como problema.`}
            icone="denuncia"
            aoPressionar={() => router.push('/denuncias')}
          />
        </Cartao>
      ) : null}

      <Cartao titulo="Privacidade" icone="seguranca">
        <Linha
          titulo="Exportar meus dados"
          descricao="Uma cópia de tudo que é seu no Uni Jovem."
          icone="baixar"
          aoPressionar={() => router.push('/privacidade')}
        />
        {DOCUMENTOS.map((d) => (
          <Linha
            key={d.caminho}
            titulo={d.titulo}
            descricao="Abre no navegador."
            icone={d.icone}
            aoPressionar={() => void abrirDocumento(d.caminho)}
          />
        ))}
        <Linha
          titulo="Excluir minha conta"
          descricao="Apaga a conta e sai de todas as comunidades."
          icone="excluir"
          aoPressionar={() => router.push('/excluir-conta')}
        />
      </Cartao>

      <Cartao>
        <Botao
          titulo="Sair deste aparelho"
          icone="sair"
          variante="perigo"
          carregando={saindo}
          aoPressionar={() => void pedirParaSair()}
        />
      </Cartao>
    </Moldura>
  )
}

function TelaNaPilha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Tela cabecalhoNativo titulo={titulo}>
      {children}
    </Tela>
  )
}

function DadosDaConta({ conta }: { conta: Conta }) {
  const consultas = useQueryClient()
  const [nome, setNome] = useState(conta.nome)
  const [whatsapp, setWhatsapp] = useState(conta.whatsapp ?? '')
  const [erros, setErros] = useState<{ nome?: string; whatsapp?: string }>({})

  const salvar = useMutation({
    mutationFn: (corpo: { nome?: string; whatsapp?: string | null }) =>
      api.patch('/api/v1/eu', corpo),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.eu }),
  })

  // Vazio remove o WhatsApp; preenchido precisa virar o formato +55...
  const whatsappNormalizado = whatsapp.trim() ? normalizarWhatsApp(whatsapp) : null
  const whatsappInvalido = whatsapp.trim() !== '' && !whatsappNormalizado
  const mudouNome = nome.trim() !== conta.nome
  const mudouWhatsapp = whatsappInvalido || whatsappNormalizado !== conta.whatsapp

  function enviar() {
    const novos: { nome?: string; whatsapp?: string } = {}
    if (!nome.trim()) novos.nome = 'Informe seu nome.'
    if (whatsappInvalido) {
      novos.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.'
    }
    setErros(novos)
    if (novos.nome || novos.whatsapp) return
    salvar.mutate({
      ...(mudouNome ? { nome: nome.trim() } : {}),
      ...(mudouWhatsapp ? { whatsapp: whatsappNormalizado } : {}),
    })
  }

  return (
    <Cartao titulo="Seus dados" icone="perfil">
      <Campo
        rotulo="Nome"
        value={nome}
        onChangeText={setNome}
        erro={erros.nome ?? null}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <Campo
        rotulo="WhatsApp"
        ajuda="Com DDD. Deixe em branco para remover."
        exemplo="(11) 91234-5678"
        value={whatsapp}
        onChangeText={setWhatsapp}
        erro={erros.whatsapp ?? null}
        keyboardType="phone-pad"
        inputMode="tel"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <Texto variante="apoio" cor="textoSuave">
        E-mail: {conta.email}
      </Texto>
      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
      {salvar.isSuccess && !mudouNome && !mudouWhatsapp ? (
        <Texto variante="apoio" cor="sucesso" accessibilityLiveRegion="polite">
          Dados salvos.
        </Texto>
      ) : null}
      <Botao
        titulo="Salvar dados"
        variante="secundario"
        aoPressionar={enviar}
        carregando={salvar.isPending}
        desabilitado={!mudouNome && !mudouWhatsapp}
        motivo="Altere o nome ou o WhatsApp para salvar."
      />
    </Cartao>
  )
}
