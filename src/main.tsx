import { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/lora'
import '@fontsource-variable/lora/wght-italic.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/700.css'
import { useLibrary } from './storage'
import { BrandLogo } from './components/ui'
import './styles.css'

const Landing = lazy(() => import('./components/Landing'))
const Editor = lazy(() => import('./editor/Editor'))
const Projects = lazy(() => import('./components/Projects'))
const path = location.pathname
const editorRoute = /^\/editor(?:\/([\w-]+))?\/?$/.exec(path)

function App() {
  const load = useLibrary((state) => state.load)
  useEffect(() => { void load().catch(() => {}) }, [load])
  return <Suspense fallback={<div className="app-loading"><BrandLogo /><p role="status">Cargando ReviewCanvas…</p></div>}>
    {editorRoute ? <Editor id={editorRoute[1]} /> : path === '/proyectos' || path === '/proyectos/' ? <Projects /> : <Landing />}
  </Suspense>
}

createRoot(document.getElementById('root')!).render(<App />)
