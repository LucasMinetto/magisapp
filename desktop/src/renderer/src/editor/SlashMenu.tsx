// Menu "/": digitar / no começo da linha (ou depois de um espaço) abre um preenchimento rápido.
// O texto depois da barra filtra. Escolher uma ficha escreve o nome dela, que vira ligação sozinho;
// "Criar" faz a ficha nova e já escreve o nome; "Formatar" troca o bloco (título, lista…).
import type { Editor } from '@tiptap/react'
import { Heading2, Heading3, List, ListOrdered, MapPin, Minus, Plus, Quote, SearchCheck, Skull, User, Users, type LucideIcon } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fold } from '@shared/mentions'
import type { EntityKind } from '@shared/types'
import { useCampaign } from '@/campaign'
import { createEntity, KIND_LABEL } from '@/lib/actions'
import { cx } from '@/ui'

export interface SlashMatch {
  /** Posição da "/" no documento. */
  from: number
  /** Posição do cursor (fim do que foi digitado). */
  to: number
  query: string
}

/** Procura uma "/" aberta antes do cursor, no mesmo parágrafo. "22/07" e "e/ou" não contam. */
export function findSlash(editor: Editor, dismissedAt: number | null): SlashMatch | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const $from = selection.$from
  if (!$from.parent.isTextblock) return null
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const i = before.lastIndexOf('/')
  if (i === -1 || (i > 0 && !/\s/.test(before[i - 1]))) return null
  const query = before.slice(i + 1)
  if (query.length > 40 || query.startsWith(' ') || query.includes('￼')) return null
  const from = $from.start() + i
  if (from === dismissedAt) return null
  return { from, to: selection.from, query }
}

const KIND_ICON: Record<EntityKind, LucideIcon> = { personagem: User, ameaca: Skull, local: MapPin, grupo: Users, lore: SearchCheck }
const CREATE_ORDER: EntityKind[] = ['personagem', 'ameaca', 'local', 'grupo', 'lore']

interface Item {
  key: string
  group: 'Fichas' | 'Criar' | 'Formatar'
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void | Promise<void>
}

export interface SlashMenuHandle {
  /** Teclas do editor enquanto o menu está aberto. true = o menu tratou. */
  onKey: (e: KeyboardEvent) => boolean
}

export const SlashMenu = forwardRef<SlashMenuHandle, { editor: Editor; match: SlashMatch; onClose: (dismiss: boolean) => void }>(function SlashMenu(
  { editor, match, onClose },
  ref
) {
  const { targets, changed } = useCampaign()
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const q = match.query.trim()
  const needle = fold(q)

  const items = useMemo<Item[]>(() => {
    const replace = (text: string) => editor.chain().focus().deleteRange({ from: match.from, to: match.to }).insertContent(text).run()
    const block = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus().deleteRange({ from: match.from, to: match.to })).run()

    const sheets = targets
      .map((t) => {
        const names = [t.name, ...t.aliases].map(fold)
        const score = !needle ? 1 : names.some((n) => n.startsWith(needle)) ? 2 : names.some((n) => n.includes(needle)) ? 1 : 0
        return { t, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name, 'pt-BR'))
      .slice(0, needle ? 8 : 6)
      .map(
        ({ t }): Item => ({
          key: `ficha:${t.id}`,
          group: 'Fichas',
          label: t.name,
          hint: KIND_LABEL[t.kind].one,
          icon: KIND_ICON[t.kind],
          run: () => void replace(`${t.name} `)
        })
      )

    const exact = targets.some((t) => fold(t.name) === needle)
    const create: Item[] =
      q && !exact
        ? CREATE_ORDER.map((kind) => ({
            key: `criar:${kind}`,
            group: 'Criar' as const,
            label: `${KIND_LABEL[kind].one} «${q}»`,
            hint: 'ficha nova',
            icon: Plus,
            run: async () => {
              await createEntity(kind, q)
              changed() // a lista de nomes recarrega e o nome escrito vira ligação
              replace(`${q} `)
            }
          }))
        : []

    const formats: Item[] = (
      [
        ['titulo', 'Título', Heading2, () => block((c) => c.setHeading({ level: 2 }))],
        ['subtitulo', 'Subtítulo', Heading3, () => block((c) => c.setHeading({ level: 3 }))],
        ['lista', 'Lista', List, () => block((c) => c.toggleBulletList())],
        ['numerada', 'Lista numerada', ListOrdered, () => block((c) => c.toggleOrderedList())],
        ['citacao', 'Citação', Quote, () => block((c) => c.toggleBlockquote())],
        ['divisor', 'Divisor', Minus, () => block((c) => c.setHorizontalRule())]
      ] as [string, string, LucideIcon, () => void][]
    )
      .filter(([, label]) => !needle || fold(label).includes(needle))
      .map(([key, label, icon, run]) => ({ key: `formatar:${key}`, group: 'Formatar' as const, label, icon, run }))

    return [...sheets, ...create, ...formats]
  }, [targets, needle, q, editor, match.from, match.to, changed])

  useEffect(() => setActive(0), [needle])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (item: Item | undefined) => {
    if (!item) return
    onClose(false)
    void item.run()
  }

  useImperativeHandle(ref, () => ({
    onKey: (e) => {
      if (e.key === 'ArrowDown') setActive((a) => (items.length ? (a + 1) % items.length : 0))
      else if (e.key === 'ArrowUp') setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
      else if (e.key === 'Enter' || e.key === 'Tab') {
        if (!items.length) return false
        choose(items[active])
      } else if (e.key === 'Escape') onClose(true)
      else return false
      return true
    }
  }))

  // Logo abaixo da "/"; se não couber, acima.
  const coords = editor.view.coordsAtPos(match.from)
  const below = window.innerHeight - coords.bottom > 300
  const style = { left: Math.min(coords.left, window.innerWidth - 336), ...(below ? { top: coords.bottom + 6 } : { bottom: window.innerHeight - coords.top + 6 }) }

  return createPortal(
    <div
      className="fixed z-50 w-80 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-pop"
      style={style}
      onMouseDown={(e) => e.preventDefault() /* não tira o foco do texto */}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">Nada com «{q}». Esc fecha.</p>
      ) : (
        <ul ref={listRef} role="listbox" aria-label="Inserir" className="max-h-72 overflow-auto p-1">
          {items.map((item, i) => {
            const Icon = item.icon
            const first = i === 0 || items[i - 1].group !== item.group
            return (
              <li key={item.key} role="presentation">
                {first && <div className="type-label px-2 pt-1.5 pb-1 text-subtle">{item.group}</div>}
                <div
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                  className={cx('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm', i === active ? 'bg-accent/10 text-fg' : 'text-fg')}
                >
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-xs text-subtle">{item.hint}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="border-t border-border px-3 py-1 text-xs text-subtle">↑↓ escolher · Enter inserir · Esc fechar</div>
    </div>,
    document.body
  )
})
