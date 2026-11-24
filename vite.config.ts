import { cp, mkdir, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind(), {
    name: 'reviewcanvas-public-assets',
    apply: 'build',
    async closeBundle() {
      const assets = resolve('ReviewCanvas-assets')
      for (const directory of ['01-marca', '02-web', '03-mockups', '04-plantillas', '05-decoraciones', '06-fondos', 'miniaturas']) {
        const target = resolve('dist', directory)
        await mkdir(target, { recursive: true })
        for (const file of await readdir(resolve(assets, directory))) {
          if (directory === '04-plantillas' && !file.endsWith('.svg')) continue
          if (directory === '01-marca' && !file.endsWith('.svg')) continue
          if (directory === '02-web' && file !== 'tarjetas-impresas.webp') continue
          await cp(resolve(assets, directory, file), resolve(target, file))
        }
      }
      await Promise.all(['_routes.json', '_headers', '_redirects'].map((file) => cp(resolve('deploy', file), resolve('dist', file))))
    },
  }],
  publicDir: 'ReviewCanvas-assets',
  build: { copyPublicDir: false },
  server: { proxy: {
    '/api': process.env.API_PROXY ?? 'http://127.0.0.1:4174',
    '/r/': process.env.API_PROXY ?? 'http://127.0.0.1:4174',
  } },
})
