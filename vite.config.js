import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      )
      // Copy popup HTML pages that aren't Vite entry points
      const htmlFiles = ['newtabmodal.html', 'tabswitcher.html']
      for (const f of htmlFiles) {
        if (existsSync(resolve(__dirname, f))) {
          copyFileSync(resolve(__dirname, f), resolve(__dirname, 'dist', f))
        }
      }

      const optionsDir = resolve(__dirname, 'dist/options')
      if (!existsSync(optionsDir)) mkdirSync(optionsDir, { recursive: true })
      if (existsSync(resolve(__dirname, 'src/options/index.html'))) {
        copyFileSync(
          resolve(__dirname, 'src/options/index.html'),
          resolve(__dirname, 'dist/options/index.html')
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel:        resolve(__dirname, 'sidepanel.html'),
        newtab:           resolve(__dirname, 'newtab.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js'
          return '[name]/index.js'
        },
        chunkFileNames:  'chunks/[name]-[hash].js',
        assetFileNames:  'assets/[name][extname]',
      },
    },
  },
})