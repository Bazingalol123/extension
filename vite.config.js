import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // manifest.json
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'))

      // options/index.html
      const optionsDir = resolve(__dirname, 'dist/options')
      if (!existsSync(optionsDir)) mkdirSync(optionsDir, { recursive: true })
      copyFileSync(resolve(__dirname, 'src/options/index.html'), resolve(__dirname, 'dist/options/index.html'))
    },
  }
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel:        resolve(__dirname, 'sidepanel.html'),
        newtab:           resolve(__dirname, 'newtab.html'),
        tabswitcher:      resolve(__dirname, 'tabswitcher.html'),
        commandbar:       resolve(__dirname, 'src/commandbar/main.jsx'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js'
          if (chunkInfo.name === 'commandbar')     return 'commandbar/commandbar.js'
          return '[name]/index.js'
        },
        chunkFileNames:  'chunks/[name]-[hash].js',
        assetFileNames:  'assets/[name][extname]',
      },
    },
  },
})