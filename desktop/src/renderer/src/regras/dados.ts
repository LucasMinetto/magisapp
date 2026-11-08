// Regras dos livros (tools/livros/regras.py): seções com texto num mini-Markdown e a página de origem.
// O JSON é grande; carrega só quando a tela Regras ou a busca pedem.

export interface SecaoRegra {
  id: string
  livro: string
  capitulo: string
  titulo: string
  pagina: number
  /** "## título", "### subtítulo", "@p 123" (página), ":: linha" (quadro ou tabela), parágrafos com **negrito** e *itálico*. */
  texto: string
}

export interface Bloco {
  tipo: 'h2' | 'h3' | 'p' | 'quadro' | 'pagina'
  texto: string
  linhas?: string[]
  pagina: number
  /** Âncora dos títulos, para o sumário e a busca. */
  ancora?: string
}

export interface Achado {
  secao: SecaoRegra
  rotulo: string
  ancora?: string
  trecho: string
  pagina: number
}

let cache: Promise<SecaoRegra[]> | null = null
export const carregarRegras = (): Promise<SecaoRegra[]> => (cache ??= import('./regras.json').then((m) => m.default as SecaoRegra[]))

export const dobrar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function blocos(s: SecaoRegra): Bloco[] {
  const out: Bloco[] = []
  let pagina = s.pagina
  let h = 0
  for (const raw of s.texto.split('\n\n')) {
    const b = raw.trim()
    if (!b) continue
    if (b.startsWith('@p ')) {
      pagina = Number(b.slice(3)) || pagina
      out.push({ tipo: 'pagina', texto: '', pagina })
    } else if (b.startsWith('## ') || b.startsWith('### ')) {
      const nivel = b.startsWith('## ') ? 'h2' : 'h3'
      out.push({ tipo: nivel, texto: b.replace(/^#+\s*/, ''), pagina, ancora: `t${++h}` })
    } else if (b.startsWith(':: ')) {
      out.push({ tipo: 'quadro', texto: '', linhas: b.split('\n').map((l) => l.replace(/^::\s?/, '')), pagina })
    } else {
      out.push({ tipo: 'p', texto: b, pagina })
    }
  }
  return out
}

const semMarcas = (t: string) => t.replace(/\*+/g, '')

/** Busca no título da seção, nos subtítulos e no texto. Devolve até `max` achados, os de título primeiro. */
export function buscar(secoes: SecaoRegra[], q: string, max = 40): Achado[] {
  const agulha = dobrar(q.trim())
  if (agulha.length < 2) return []
  const titulos: Achado[] = []
  const textos: Achado[] = []
  for (const s of secoes) {
    if (dobrar(s.titulo).includes(agulha)) titulos.push({ secao: s, rotulo: s.titulo, trecho: `${s.capitulo} · ${s.livro}`, pagina: s.pagina })
    let ultimoTitulo: Bloco | undefined
    for (const b of blocos(s)) {
      if (b.tipo === 'h2' || b.tipo === 'h3') {
        ultimoTitulo = b
        if (dobrar(b.texto).includes(agulha)) titulos.push({ secao: s, rotulo: `${s.titulo} › ${b.texto}`, ancora: b.ancora, trecho: s.livro, pagina: b.pagina })
        continue
      }
      const corpo = semMarcas(b.tipo === 'quadro' ? (b.linhas ?? []).join(' · ') : b.texto)
      const i = dobrar(corpo).indexOf(agulha)
      if (i < 0 || textos.length >= max) continue
      const ini = Math.max(0, i - 50)
      textos.push({
        secao: s,
        rotulo: ultimoTitulo ? `${s.titulo} › ${ultimoTitulo.texto}` : s.titulo,
        ancora: ultimoTitulo?.ancora,
        trecho: `${ini > 0 ? '…' : ''}${corpo.slice(ini, i)}[${corpo.slice(i, i + agulha.length)}]${corpo.slice(i + agulha.length, i + agulha.length + 70)}…`,
        pagina: b.pagina
      })
    }
  }
  return [...titulos, ...textos].slice(0, max)
}

/** Seções cujas entradas (rituais, itens, ameaças) estão na Biblioteca. */
export const NA_BIBLIOTECA: Record<string, { tipo: 'ritual' | 'item' | 'ameaca'; texto: string }> = {
  Rituais: { tipo: 'ritual', texto: 'Cada ritual está na Biblioteca.' },
  Armas: { tipo: 'item', texto: 'Cada arma e munição está na Biblioteca.' },
  Proteções: { tipo: 'item', texto: 'As proteções estão na Biblioteca.' },
  'Equipamento Geral': { tipo: 'item', texto: 'Cada item está na Biblioteca.' },
  Equipamentos: { tipo: 'item', texto: 'Cada arma e item está na Biblioteca.' },
  'Itens Amaldiçoados': { tipo: 'item', texto: 'Os itens amaldiçoados especiais estão na Biblioteca.' },
  'Fichas de Ameaças': { tipo: 'ameaca', texto: 'Cada ameaça está na Biblioteca.' },
  'Construindo Combates': { tipo: 'ameaca', texto: 'As ameaças estão na Biblioteca.' }
}
