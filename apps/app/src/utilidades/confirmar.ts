import { Alert } from 'react-native'

export interface PedidoDeConfirmacao {
  titulo: string
  mensagem: string
  /** Texto do botão que confirma; deve dizer a ação (ex.: "Sair de Jovens Centro"). */
  confirmar: string
  destrutivo?: boolean
}

/** Diálogo nativo de confirmação. Cancelar é sempre a opção segura. */
export function confirmar({
  titulo,
  mensagem,
  confirmar: rotulo,
  destrutivo,
}: PedidoDeConfirmacao) {
  return new Promise<boolean>((resolver) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        {
          text: rotulo,
          style: destrutivo ? 'destructive' : 'default',
          onPress: () => resolver(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    )
  })
}
