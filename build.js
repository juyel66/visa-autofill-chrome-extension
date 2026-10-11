import { build, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const __dirname = import.meta.dirname || '.'

async function runBuild() {
  const env = loadEnv('production', __dirname, '')
  const backendUrl = env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || 'http://localhost:8000'
  const apiUrl = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'http://localhost:8000'
  const extractorUrl = env.VITE_PYTHON_EXTRACTOR_URL || 'http://127.0.0.1:8001'
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '478244875026-tpnqtk9ke8e1tpldgrsu40gft4r65ifu.apps.googleusercontent.com'
  const googleRedirectUri = env.VITE_GOOGLE_REDIRECT_URI || 'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/'
  const geminiKey = env.VITE_GEMINI_API_KEY || ''

  console.log(`[build] Baking environment configuration:`)
  console.log(`  - Backend URL: ${backendUrl}`)
  console.log(`  - API Base URL: ${apiUrl}`)
  console.log(`  - OCR Extractor URL: ${extractorUrl}`)

  const defineEnv = {
    'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl),
    'import.meta.env.VITE_PYTHON_EXTRACTOR_URL': JSON.stringify(extractorUrl),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    'import.meta.env.VITE_GOOGLE_REDIRECT_URI': JSON.stringify(googleRedirectUri),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
  }

  console.log('\n--- STEP 1: Building Extension Popup and Background Service Worker (ES modules) ---')
  await build({
    configFile: false,
    base: './',
    define: defineEnv,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
          application: resolve(__dirname, 'application.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background.js'
            return 'assets/[name]-[hash].js'
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          format: 'es',
        },
      },
    },
  })

  console.log('\n--- STEP 2: Building Content Script (self-contained IIFE) ---')
  await build({
    configFile: false,
    base: './',
    define: defineEnv,
    plugins: [],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          content: resolve(__dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: 'content.js',
          format: 'iife',
          name: 'VisaAutofillContent',
        },
      },
    },
  })

  console.log('\n--- BUILD COMPLETED SUCCESSFULLY ---')
}

runBuild().catch((err) => {
  console.error('Build process failed:', err)
  process.exit(1)
})
