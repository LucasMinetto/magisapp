/// <reference types="vite/client" />
import type { Api } from './shared/types'

declare module '*.sql?raw' {
  const sql: string
  export default sql
}

declare global {
  interface Window {
    api: Api
  }
}
