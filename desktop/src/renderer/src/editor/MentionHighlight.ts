import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findMentions, type Matcher } from '@shared/mentions'

export const mentionKey = new PluginKey('mentionHighlight')

interface Options {
  getMatcher: () => Matcher | null
  getName: (id: string) => string
  onOpen: (id: string) => void
}

function decorate(doc: PMNode, opts: Options): DecorationSet {
  const matcher = opts.getMatcher()
  if (!matcher || matcher.terms.length === 0) return DecorationSet.empty
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Texto do bloco + posição no documento de cada caractere (marcas como negrito partem o texto em pedaços).
    let text = ''
    const at: number[] = []
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) at.push(start + i)
        text += child.text
      } else {
        at.push(start)
        text += '\n'
      }
    })
    for (const m of findMentions(text, matcher)) {
      decos.push(
        Decoration.inline(at[m.from], at[m.to - 1] + 1, {
          class: 'mention',
          'data-entity-id': m.id,
          title: `${opts.getName(m.id)} · Ctrl+clique abre a ficha`
        })
      )
    }
    return false
  })
  return DecorationSet.create(doc, decos)
}

/** Sublinha nomes e apelidos de fichas no texto. Nada é gravado no documento: é só decoração. */
export const MentionHighlight = Extension.create<Options>({
  name: 'mentionHighlight',
  addOptions() {
    return { getMatcher: () => null, getName: () => '', onOpen: () => {} }
  },
  addProseMirrorPlugins() {
    const opts = this.options
    return [
      new Plugin({
        key: mentionKey,
        state: {
          init: (_, state) => decorate(state.doc, opts),
          // Recalcula quando o texto muda ou quando as fichas mudam (meta 'refresh').
          apply: (tr, old) => (tr.docChanged || tr.getMeta(mentionKey) ? decorate(tr.doc, opts) : old)
        },
        props: {
          decorations: (state) => mentionKey.getState(state),
          handleClick: (_view, _pos, event) => {
            if (!(event.ctrlKey || event.metaKey)) return false
            const el = (event.target as HTMLElement).closest('[data-entity-id]')
            if (!el) return false
            opts.onOpen(el.getAttribute('data-entity-id')!)
            return true
          }
        }
      })
    ]
  }
})
