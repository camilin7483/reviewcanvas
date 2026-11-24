import { useState } from 'react'
import { ArrowRight, CircleCheck, Download, FilePlus2, LayoutTemplate, Moon, QrCode, Sun } from 'lucide-react'
import { TemplateGallery } from './Galleries'
import { BrandLogo, IconButton } from './ui'

const steps = [
  ['Elige un diseño', 'Encuentra una plantilla que encaje con tu negocio y cambia cualquier elemento.', LayoutTemplate],
  ['Vincula tu negocio', 'Pega el enlace de reseñas de Google. ReviewCanvas genera y verifica el código.', QrCode],
  ['Descarga tu cartel', 'Llévalo a imprenta o compártelo en pantalla. Tú eliges el formato y el tamaño.', Download],
] as const

const faq = [
  ['¿Necesito configurar Google Places?', 'Puedes pegar el enlace de «Pedir reseñas» de tu Perfil de Empresa de Google o introducir el Place ID. La búsqueda de Google Places es opcional.'],
  ['¿Mi código seguirá funcionando después de descargarlo?', 'El QR estático abre tu enlace de Google directamente. Cuando actualices el destino, tendrás que generar y descargar un código nuevo.'],
  ['¿Qué puedo cambiar en una plantilla?', 'Cada diseño contiene capas de texto, ilustraciones, fondo y QR. Puedes mover, recolorear o sustituir las que quieras.'],
  ['¿Puedo preparar un cartel para imprenta?', 'Puedes elegir dimensiones en milímetros, centímetros o pulgadas, añadir sangrado y descargar un PDF o una imagen a 300 DPI.'],
  ['¿Dónde se guardan mis diseños?', 'Se guardan en el navegador donde editas. Para abrir un diseño en otro dispositivo, expórtalo en JSON e impórtalo desde Mis proyectos.'],
]

export default function Landing() {
  const [dark, setDark] = useState(() => localStorage.getItem('rc-theme') === 'dark' || (!localStorage.getItem('rc-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const changeTheme = () => { localStorage.setItem('rc-theme', dark ? 'light' : 'dark'); setDark(!dark) }
  return <div className={`landing ${dark ? 'landing-dark' : ''}`}>
    <a href="#main" className="skip-link">Saltar al contenido</a>
    <header className="site-header"><div className="site-container site-nav">
      <BrandLogo light={dark} />
      <nav aria-label="Principal"><a href="#plantillas">Plantillas</a><a href="#funciona">Cómo funciona</a></nav>
      <div className="site-nav-end"><IconButton label={dark ? 'Modo claro' : 'Modo oscuro'} onClick={changeTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
        <a className="my-projects" href="/proyectos">Mis proyectos</a><a className="button button-primary nav-cta" href="/editor">Abrir editor <ArrowRight size={16} /></a></div>
    </div></header>
    <main id="main">
      <section className="hero site-container">
        <div className="hero-copy">
          <span className="hero-context"><QrCode size={17} /> QR para reseñas en Google Maps</span>
          <h1>Diseña un QR con la identidad de tu negocio.</h1>
          <p>Elige una plantilla, personalízala a tu manera y descarga un cartel listo para imprimir. Todo desde el navegador.</p>
          <div className="hero-actions"><a className="button button-primary button-big" href="/editor?nuevo&amp;vincular"><QrCode size={19} /> Crear desde cero <ArrowRight size={19} /></a>
            <a className="button button-outline button-big" href="#plantillas"><LayoutTemplate size={17} /> Ver plantillas</a></div>
          <div className="hero-links"><p className="hero-note"><CircleCheck size={17} /> Empieza sin crear una cuenta</p>
            <a href="/editor?nuevo"><FilePlus2 size={16} /> Abrir lienzo en blanco</a></div>
        </div>
        <figure className="hero-image">
          <img src="/03-mockups/cafeteria.webp" alt="Cartel de Café Aurora con QR de reseñas sobre el mostrador de una cafetería" width="499" height="496" fetchPriority="high" />
          <figcaption><span>Café Aurora</span><span>Exhibidor de mesa</span></figcaption>
        </figure>
      </section>
      <section className="landing-gallery" id="plantillas"><div className="site-container">
        <div className="section-title"><h2>Encuentra tu punto de partida</h2><p>Explora diseños editables para cafeterías, restaurantes, hoteles y otros negocios.</p></div>
        <TemplateGallery wide onChoose={(template) => { location.href = `/editor?plantilla=${encodeURIComponent(template.id)}` }} />
      </div></section>
      <section className="site-container how" id="funciona">
        <div className="section-title"><h2>Del enlace al cartel</h2></div>
        <ol>{steps.map(([title, description, Icon]) => <li key={title}><Icon size={27} /><h3>{title}</h3><p>{description}</p></li>)}</ol>
      </section>
      <section className="landing-uses"><div className="site-container uses-grid">
        <div><h2>Un QR que encaja donde lo pongas</h2><p>Prepáralo para el mostrador, la mesa, la vitrina o las tarjetas de tu negocio.</p>
          <a href="/editor" className="button button-primary">Probar el editor <ArrowRight size={18} /></a></div>
        <img src="/02-web/tarjetas-impresas.webp" alt="Tarjetas impresas con distintos diseños de códigos QR de reseñas" loading="lazy" width="514" height="363" />
      </div></section>
      <section className="site-container faq">
        <div className="section-title"><h2>Preguntas frecuentes</h2></div>
        {faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
    </main>
    <footer className="site-footer"><div className="site-container"><BrandLogo light /><a href="/proyectos">Mis proyectos</a><a href="#plantillas">Plantillas</a></div></footer>
  </div>
}
