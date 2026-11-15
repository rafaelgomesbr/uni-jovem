import { Redirect } from 'expo-router'
import { lazy, Suspense } from 'react'

// Fora dos builds de produção: lá o `__DEV__` é falso, o Metro corta este ramo e
// o arquivo do catálogo nem entra no pacote.
const Catalogo = __DEV__
  ? lazy(() => import('@/catalogo/Catalogo').then((m) => ({ default: m.Catalogo })))
  : null

/** Rota de desenvolvimento `/_catalogo`: os componentes de `src/ui` em todos os estados. */
export default function RotaDoCatalogo() {
  if (!Catalogo) return <Redirect href="/" />
  return (
    <Suspense fallback={null}>
      <Catalogo />
    </Suspense>
  )
}
