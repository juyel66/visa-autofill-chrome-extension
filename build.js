import { build, loadEnv } from 'vite'
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

  // 1. Worker (packaged and patched for Chrome MV3 extension protocol support)
  const workerSrc = join(__dirname, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js')
  if (fs.existsSync(workerSrc)) {
    let workerCode = fs.readFileSync(workerSrc, 'utf8')
    const target1 = 'if((U=t.sent).ok){t.next=32;break}'
    const repl1 = 'if((U=t.sent).ok||0===U.status||200===U.status){t.next=32;break}'
    if (workerCode.includes(target1)) {
      workerCode = workerCode.replace(target1, repl1)
    }
    fs.writeFileSync(join(publicTesseractDir, 'worker.min.js'), workerCode)
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

function ensurePdfjsAssets() {
  const publicPdfjsDir = join(__dirname, 'public', 'pdfjs')
  if (!fs.existsSync(publicPdfjsDir)) {
    fs.mkdirSync(publicPdfjsDir, { recursive: true })
  }

  const pdfjsBuildDir = join(__dirname, 'node_modules', 'pdfjs-dist', 'build')
  if (fs.existsSync(pdfjsBuildDir)) {
    const files = fs.readdirSync(pdfjsBuildDir)
    for (const f of files) {
      if (f.startsWith('pdf.worker')) {
        fs.copyFileSync(join(pdfjsBuildDir, f), join(publicPdfjsDir, f))
      }
    }
  }
}

async function runBuild() {
  ensureTesseractAssets()
  ensurePdfjsAssets()
  const env = loadEnv('production', process.cwd(), '')
  console.log('--- STEP 1: Building Extension Popup and Background Service Worker (ES modules) ---')
  await build({
    configFile: false,
    base: './',
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
    },
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
