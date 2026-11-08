// Tokens (retratos) das ameaças da biblioteca. Os dos livros vêm com o app (resources/livros-tokens, gerados por
// tools/livros/tokens.py); os que o mestre escolhe são copiados para biblioteca-tokens/, ao lado do banco.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

/** .jfif é JPEG com outro nome: guarda como .jpg para a campanha aceitar. */
const EXT: Record<string, string> = { '.png': '.png', '.jpg': '.jpg', '.jpeg': '.jpg', '.jfif': '.jpg', '.webp': '.webp', '.gif': '.gif', '.avif': '.avif' }
export const TOKEN_EXTENSIONS = Object.keys(EXT).map((e) => e.slice(1))

/** Copia a imagem para a pasta de tokens com um nome pelo conteúdo. Devolve o nome do arquivo guardado. */
export function guardarToken(dir: string, src: string): string {
  const ext = EXT[extname(src).toLowerCase()]
  if (!ext) throw new Error(`Formato não aceito. Use ${TOKEN_EXTENSIONS.join(', ')}.`)
  if (!existsSync(src) || !statSync(src).isFile()) throw new Error('Arquivo não encontrado.')
  if (statSync(src).size > 30 * 1024 * 1024) throw new Error('Imagem maior que 30 MB.')
  const nome = `${createHash('sha256').update(readFileSync(src)).digest('hex').slice(0, 16)}${ext}`
  mkdirSync(dir, { recursive: true })
  const destino = join(dir, nome)
  if (!existsSync(destino)) copyFileSync(src, destino)
  return nome
}

/** Caminho de um token guardado, ou null. Só aceita o nome do arquivo (nada de ../). */
export function arquivoDoToken(dir: string, nome: string): string | null {
  if (!/^[a-f0-9]{16}\.[a-z]{3,4}$/.test(nome)) return null
  const p = join(dir, nome)
  return existsSync(p) ? p : null
}
