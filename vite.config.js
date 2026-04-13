import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

/**
 * Custom plugin to copy static extension files (manifest.json, options page)
 * into the dist output after Vite finishes building.
 */
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // Copy manifest.json to dist root
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      )

      // Copy options/index.html to dist/options/
      const optionsDir = resolve(__dirname, 'dist/options')
      if (!existsSync(optionsDir)) {
        mkdirSync(optionsDir, { recursive: true })
      }
      copyFileSync(
        resolve(__dirname, 'src/options/index.html'),
        resolve(__dirname, 'dist/options/index.html')
      )
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
  // Chrome extensions need relative paths (not absolute like /assets/...)
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        newtab: resolve(__dirname, 'newtab.html'),
        commandbar: resolve(__dirname, 'src/commandbar/main.jsx'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js'
          if (chunkInfo.name === 'commandbar') return 'commandbar/commandbar.js'
          return '[name]/index.js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
