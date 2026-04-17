import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/newtabmodal/main.js'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'newtabmodal/newtabmodal.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})