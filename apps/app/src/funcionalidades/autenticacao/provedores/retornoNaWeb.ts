import { maybeCompleteAuthSession } from 'expo-web-browser'
import { Platform } from 'react-native'

// Entrar com Google na web abre uma janela que volta para /app. Lá, este
// módulo (carregado com a sessão, antes de qualquer rota) fecha a janela e
// devolve o resultado à página que pediu.
if (Platform.OS === 'web') maybeCompleteAuthSession()
