import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, join } from 'path'
import fs from 'fs'
import zlib from 'zlib'

const __dirname = import.meta.dirname || '.'

function ensureTesseractAssets() {
  const publicTesseractDir = join(__dirname, 'public', 'tesseract')
  if (!fs.existsSync(publicTesseractDir)) {
    fs.mkdirSync(publicTesseractDir, { recursive: true })
  }

  // 1. Worker
  const workerSrc = join(__dirname, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js')
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, join(publicTesseractDir, 'worker.min.js'))
  }

  // 2. Core (copy all wasm and wasm.js and js files from tesseract.js-core)
  const coreDir = join(__dirname, 'node_modules', 'tesseract.js-core')
  if (fs.existsSync(coreDir)) {
    const coreFiles = fs.readdirSync(coreDir)
    for (const f of coreFiles) {
      if (f.endsWith('.js') || f.endsWith('.wasm') || f.endsWith('.wasm.js')) {
        fs.copyFileSync(join(coreDir, f), join(publicTesseractDir, f))
      }
    }
  }

  // 3. Traineddata
  const trainedDataSrc = join(__dirname, 'eng.traineddata')
  if (fs.existsSync(trainedDataSrc)) {
    fs.copyFileSync(trainedDataSrc, join(publicTesseractDir, 'eng.traineddata'))
    if (!fs.existsSync(join(publicTesseractDir, 'eng.traineddata.gz'))) {
      const raw = fs.readFileSync(trainedDataSrc)
      fs.writeFileSync(join(publicTesseractDir, 'eng.traineddata.gz'), zlib.gzipSync(raw))
    }
  }
}

async function runBuild() {
  ensureTesseractAssets()
  console.log('--- STEP 1: Building Extension Popup and Background Service Worker (ES modules) ---')
  await build({
    configFile: false,
    base: './',
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
