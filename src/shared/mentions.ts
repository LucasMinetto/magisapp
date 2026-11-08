// Acha nomes e apelidos de fichas num texto, sem sintaxe de link.
// Ignora acento e caixa ("joao" acha "João"), respeita limite de palavra ("Ana" não casa em "Banana")
// e prefere o termo mais longo ("João Silva" antes de "João").

export interface MentionTarget {
  id: string
  name: string
  aliases: string[]
}

export interface MentionMatch {
  id: string
  from: number // índice no texto original
  to: number // exclusivo
}

interface Term {
  id: string
  folded: string
}

export interface Matcher {
  terms: Term[]
}

const WORD_CHAR = /[\p{L}\p{N}]/u

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function buildMatcher(targets: MentionTarget[]): Matcher {
  const terms: Term[] = []
  const seen = new Set<string>()
  for (const t of targets) {
    for (const raw of [t.name, ...t.aliases]) {
      const folded = fold(raw.trim())
      if (folded.length < 2 || seen.has(folded)) continue
      seen.add(folded)
      terms.push({ id: t.id, folded })
    }
  }
  terms.sort((a, b) => b.folded.length - a.folded.length)
  return { terms }
}

export function findMentions(text: string, matcher: Matcher): MentionMatch[] {
  if (!text || matcher.terms.length === 0) return []
  // Texto dobrado + mapa de volta para o índice original (um caractere pode virar 0 ou mais).
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    for (const c of fold(text[i])) {
      folded += c
      map.push(i)
    }
  }
  const taken = new Uint8Array(folded.length)
  const out: MentionMatch[] = []
  for (const term of matcher.terms) {
    const len = term.folded.length
    let at = folded.indexOf(term.folded)
    while (at !== -1) {
      const end = at + len
      const startsWord = at === 0 || !WORD_CHAR.test(folded[at - 1])
      const endsWord = end === folded.length || !WORD_CHAR.test(folded[end])
      let free = true
      for (let k = at; k < end; k++) if (taken[k]) { free = false; break }
      if (startsWord && endsWord && free) {
        taken.fill(1, at, end)
        out.push({ id: term.id, from: map[at], to: map[end - 1] + 1 })
      }
      at = folded.indexOf(term.folded, at + 1)
    }
  }
  return out.sort((a, b) => a.from - b.from)
}

/** Texto puro de um documento TipTap/ProseMirror em JSON (para busca e menções no processo principal). */
export function docText(json: string | null | undefined): string {
  if (!json) return ''
  let doc: unknown
  try {
    doc = JSON.parse(json)
  } catch {
    return ''
  }
  const parts: string[] = []
  const walk = (node: { type?: string; text?: string; content?: unknown[] }) => {
    if (typeof node.text === 'string') parts.push(node.text)
    if (node.type === 'hardBreak') parts.push('\n')
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child as typeof node))
      if (node.type !== 'doc' && node.type !== 'text') parts.push('\n')
    }
  }
  walk(doc as { content?: unknown[] })
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim()
}
