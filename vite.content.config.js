import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/commandbar/main.jsx'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'commandbar/commandbar.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})