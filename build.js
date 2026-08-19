import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const __dirname = import.meta.dirname || '.'

async function runBuild() {
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
