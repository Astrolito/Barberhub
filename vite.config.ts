import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run build` gera dist/ para web e Capacitor.
// `npm run dev:https` serve em https na rede local (o GPS do navegador exige https).
// `npm run build:single` gera um único index.html (prévia/compartilhamento).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : []), ...(mode === 'https' ? [basicSsl()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}))
