import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error JS plugin has no type declarations
import sweetHandBraidsApi from './api-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sweetHandBraidsApi()],
})
