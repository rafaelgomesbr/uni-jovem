import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, Conta, Membro, RespostaEu } from '@/servicos/contrato'
import { ErroLocal } from '@/servicos/erros'
import type { FotoDoAvatar } from '@/ui/Avatar'

/**
 * Foto de perfil e logotipo da comunidade (D33). O app recorta em 1:1, reduz
 * para até 512 e converte em JPEG antes de enviar; o servidor confere o tipo
 * pelo conteúdo, regrava em WebP sem metadados e devolve a versão nova.
 * Envio: `PUT` com `{ imagem: <base64> }`. Trocar e remover dividem a cota de
 * 20 gravações por hora (429 com mensagem pronta para a tela).
 */

/** Lado máximo enviado (o servidor também reduz para caber em 512 × 512). */
export const LADO_DA_IMAGEM = 512
/** Compressão do JPEG: nítido num avatar de 72 e leve na rede. */
const QUALIDADE_DO_JPEG = 0.8

export const CAMINHO_DA_MINHA_FOTO = '/api/v1/eu/foto'

export function caminhoDoLogotipo(comunidadeId: string): string {
  return `/api/v1/c/${comunidadeId}/logo`
}

export function caminhoDaFotoDoMembro(comunidadeId: string, vinculoId: string): string {
  return `/api/v1/c/${comunidadeId}/pessoas/${vinculoId}/foto`
}

/** Campos da D33 nas respostas da API (ausentes numa API anterior à migração 0018). */
export interface ComFoto {
  temFoto?: boolean
  fotoVersao?: string | null
}

export interface ComLogo {
  temLogo?: boolean
  logoVersao?: string | null
}

/** A foto da própria conta, para o `Avatar`; `null` sem foto. */
export function fotoDaConta(conta: Conta & ComFoto): FotoDoAvatar | null {
  return conta.temFoto && conta.fotoVersao
    ? { caminho: CAMINHO_DA_MINHA_FOTO, versao: conta.fotoVersao }
    : null
}

/** A foto de outra pessoa da mesma comunidade (a API só serve a quem tem vínculo ativo nela). */
export function fotoDoMembro(comunidadeId: string, membro: Membro & ComFoto): FotoDoAvatar | null {
  return membro.temFoto && membro.fotoVersao
    ? { caminho: caminhoDaFotoDoMembro(comunidadeId, membro.vinculoId), versao: membro.fotoVersao }
    : null
}

/** O logotipo da comunidade (só membros recebem). */
export function logoDaComunidade(
  comunidade: Pick<ComunidadeDoVinculo, 'id'> & ComLogo,
): FotoDoAvatar | null {
  return comunidade.temLogo && comunidade.logoVersao
    ? { caminho: caminhoDoLogotipo(comunidade.id), versao: comunidade.logoVersao }
    : null
}

export type OrigemDaImagem = 'camera' | 'galeria'

export const MENSAGEM_SEM_CAMERA = `O ${NOME_DO_APP} não tem acesso à câmera. Libere nos Ajustes do aparelho ou escolha da galeria.`
const MENSAGEM_SEM_PREPARO = 'Não conseguimos preparar esta imagem. Tente outra foto.'

/** Recorte central em quadrado (a web não tem o editor do sistema) e redução para até 512. */
async function prepararImagem(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const { uri, width, height } = asset
  let contexto = ImageManipulator.manipulate(uri)
  const lado = Math.min(width, height)
  if (lado > 0 && width !== height) {
    contexto = contexto.crop({
      originX: Math.floor((width - lado) / 2),
      originY: Math.floor((height - lado) / 2),
      width: lado,
      height: lado,
    })
  }
  if (lado === 0 || lado > LADO_DA_IMAGEM) {
    contexto = contexto.resize({ width: LADO_DA_IMAGEM, height: LADO_DA_IMAGEM })
  }
  const imagem = await contexto.renderAsync()
  try {
    const salva = await imagem.saveAsync({
      format: SaveFormat.JPEG,
      compress: QUALIDADE_DO_JPEG,
      base64: true,
    })
    if (!salva.base64) throw new ErroLocal(MENSAGEM_SEM_PREPARO)
    return salva.base64
  } finally {
    imagem.release()
    contexto.release()
  }
}

/**
 * Abre a câmera ou a galeria com o recorte 1:1 do sistema e devolve a imagem
 * pronta para enviar (JPEG em base64, até 512). `null` quando a pessoa
 * desiste. Nada é gravado no aparelho além do arquivo temporário do sistema.
 */
export async function escolherImagem(
  origem: OrigemDaImagem,
  camera: 'frente' | 'tras' = 'frente',
): Promise<string | null> {
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  }
  let resultado: ImagePicker.ImagePickerResult
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissao.granted) throw new ErroLocal(MENSAGEM_SEM_CAMERA)
    resultado = await ImagePicker.launchCameraAsync({
      ...opcoes,
      cameraType: camera === 'frente' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    })
  } else {
    // A galeria do sistema (PHPicker no iOS) não pede permissão: só a foto escolhida chega ao app.
    resultado = await ImagePicker.launchImageLibraryAsync(opcoes)
  }
  const asset = resultado.canceled ? null : resultado.assets[0]
  if (!asset) return null
  try {
    return await prepararImagem(asset)
  } catch (erro) {
    if (erro instanceof ErroLocal) throw erro
    throw new ErroLocal(MENSAGEM_SEM_PREPARO)
  }
}

/** Escolher e enviar numa ação só; a resposta `null` quer dizer que a pessoa desistiu. */
export interface MutacoesDaImagem {
  enviar: UseMutationResult<unknown, Error, OrigemDaImagem>
  remover: UseMutationResult<unknown, Error, void>
}

function useMutacoesDaImagem(
  caminho: string,
  camera: 'frente' | 'tras',
  aoMudar: (resposta: unknown) => Promise<unknown>,
): MutacoesDaImagem {
  const enviar = useMutation<unknown, Error, OrigemDaImagem>({
    mutationFn: async (origem) => {
      const imagem = await escolherImagem(origem, camera)
      if (!imagem) return null
      return api.put(caminho, { imagem })
    },
    onSuccess: (resposta) => (resposta ? aoMudar(resposta) : undefined),
    // A imagem em base64 não fica no cache do React Query.
    gcTime: 0,
  })
  const remover = useMutation<unknown, Error, void>({
    mutationFn: () => api.delete(caminho),
    onSuccess: (resposta) => aoMudar(resposta),
  })
  return { enviar, remover }
}

/**
 * Trocar e remover a própria foto. A resposta do envio já diz a versão nova:
 * ela entra na conta em cache (`/eu`) na hora, e Perfil, aba e Dados pessoais
 * mostram a foto sem esperar a volta da rede. Depois, `/eu` é buscado de novo
 * (e a cópia para abrir sem internet acompanha).
 */
export function useFotoDePerfil(): MutacoesDaImagem {
  const consultas = useQueryClient()
  return useMutacoesDaImagem(CAMINHO_DA_MINHA_FOTO, 'frente', async (resposta) => {
    const foto = resposta as ComFoto | null
    if (foto && typeof foto.temFoto === 'boolean') {
      consultas.setQueryData<RespostaEu>(CHAVES.eu, (eu) =>
        eu
          ? {
              ...eu,
              conta: { ...eu.conta, temFoto: foto.temFoto, fotoVersao: foto.fotoVersao ?? null },
            }
          : eu,
      )
    }
    await consultas.invalidateQueries({ queryKey: CHAVES.eu })
  })
}

/** Trocar e remover o logotipo (só admin; a API confere). */
export function useLogotipo(comunidadeId: string): MutacoesDaImagem {
  const consultas = useQueryClient()
  return useMutacoesDaImagem(caminhoDoLogotipo(comunidadeId), 'tras', () =>
    Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.eu }),
      consultas.invalidateQueries({ queryKey: CHAVES.comunidade(comunidadeId) }),
    ]),
  )
}
