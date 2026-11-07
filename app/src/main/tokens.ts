// Tokens (retratos) das ameaças da biblioteca: imagens copiadas para biblioteca-tokens/, ao lado do banco.
// Importar uma pasta liga cada imagem à ameaça de nome parecido (pasta ou arquivo com o nome da criatura).
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join, relative, sep } from 'node:path'

/** .jfif é JPEG com outro nome: guarda como .jpg para a campanha aceitar. */
const EXT: Record<string, string> = { '.png': '.png', '.jpg': '.jpg', '.jpeg': '.jpg', '.jfif': '.jpg', '.webp': '.webp', '.gif': '.gif', '.avif': '.avif' }
export const TOKEN_EXTENSIONS = Object.keys(EXT).map((e) => e.slice(1))

export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const semArtigo = (s: string) => s.replace(/^(o|a|os|as) /, '')

function distancia(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let ant = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1))
      ant = t
    }
  }
  return d[b.length]
}

/** Quanto um nome de arquivo/pasta parece com o nome da ameaça (0 = nada). */
export function semelhanca(chave: string, nome: string): number {
  const k = semArtigo(fold(chave).replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim())
  const n = semArtigo(fold(nome))
  if (!k || !n) return 0
  if (k === n) return 4
  if (k.startsWith(n + ' ')) return 3
  if (k.includes(' ' + n + ' ') || k.endsWith(' ' + n)) return 2
  const maior = Math.max(k.length, n.length)
  if (maior >= 5 && distancia(k, n) / maior <= 0.15) return 1.5
  return 0
}

export interface Imagem {
  arquivo: string
  /** Nomes que podem identificar a ameaça: o do arquivo e o da pasta em que está. */
  chaves: string[]
}

/** Imagens de uma pasta e das subpastas (até 4 níveis). */
export function imagensDaPasta(raiz: string): Imagem[] {
  const out: Imagem[] = []
  const andar = (dir: string, nivel: number) => {
    if (nivel > 4) return
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) andar(p, nivel + 1)
      else if (EXT[extname(nome).toLowerCase()]) {
        const pastas = relative(raiz, dir).split(sep).filter(Boolean)
        const sem = basename(nome).replace(/(\.[a-z0-9]+)+$/i, '')
        out.push({ arquivo: p, chaves: [sem, ...(pastas.length ? [pastas[pastas.length - 1]] : [])] })
      }
    }
  }
  andar(raiz, 0)
  return out.sort((a, b) => a.arquivo.length - b.arquivo.length || a.arquivo.localeCompare(b.arquivo))
}

/**
 * Liga imagens a ameaças. Cada imagem vai para a ameaça mais parecida; cada ameaça fica com a imagem
 * mais parecida (empate: nome de arquivo mais curto, ex.: "anfitrião.png" antes de "anfitrião 2.png").
 */
export function parear<T extends { id: string; nome: string }>(ameacas: T[], imagens: Imagem[]): { ligados: Map<string, Imagem>; sobras: Imagem[] } {
  const melhorPorAmeaca = new Map<string, { img: Imagem; nota: number }>()
  const usadas = new Set<Imagem>()
  for (const img of imagens) {
    let alvo: T | null = null
    let nota = 0
    for (const a of ameacas) {
      const n = Math.max(...img.chaves.map((c) => semelhanca(c, a.nome)))
      if (n > nota || (n === nota && n > 0 && alvo && a.nome.length > alvo.nome.length)) {
        alvo = a
        nota = n
      }
    }
    if (!alvo || nota === 0) continue
    const atual = melhorPorAmeaca.get(alvo.id)
    if (!atual || nota > atual.nota) melhorPorAmeaca.set(alvo.id, { img, nota })
  }
  const ligados = new Map<string, Imagem>()
  for (const [id, { img }] of melhorPorAmeaca) {
    ligados.set(id, img)
    usadas.add(img)
  }
  return { ligados, sobras: imagens.filter((i) => !usadas.has(i)) }
}

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
