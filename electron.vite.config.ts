import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // koffi loads a native .node addon at runtime - it must stay a real
    // require() in the built output, never bundled/rewritten by Rollup,
    // or the addon can't be resolved. externalizeDepsPlugin() keeps all
    // of main's node_modules deps (koffi included) as plain requires.
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
