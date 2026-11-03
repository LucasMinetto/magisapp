// Barra flutuante de formatação: aparece sobre o texto selecionado.
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Strikethrough } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '@/ui'

function Tool({ label, keys, active, onClick, children }: { label: string; keys?: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={keys ? `${label} (${keys})` : label}
      // mousedown sem perder a seleção do texto
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        'grid size-8 place-items-center rounded-md transition-colors [&>svg]:size-4',
        active ? 'bg-accent text-on-accent' : 'text-muted hover:bg-surface hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}

export function FormatBar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote')
    })
  })
  const run = () => editor.chain().focus()

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      role="toolbar"
      aria-label="Formatação"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-1 shadow-pop"
    >
      <Tool label="Negrito" keys="Ctrl+B" active={s.bold} onClick={() => run().toggleBold().run()}>
        <Bold />
      </Tool>
      <Tool label="Itálico" keys="Ctrl+I" active={s.italic} onClick={() => run().toggleItalic().run()}>
        <Italic />
      </Tool>
      <Tool label="Riscado" active={s.strike} onClick={() => run().toggleStrike().run()}>
        <Strikethrough />
      </Tool>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
      <Tool label="Título" active={s.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Tool>
      <Tool label="Subtítulo" active={s.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Tool>
      <Tool label="Lista" active={s.bullet} onClick={() => run().toggleBulletList().run()}>
        <List />
      </Tool>
      <Tool label="Lista numerada" active={s.ordered} onClick={() => run().toggleOrderedList().run()}>
        <ListOrdered />
      </Tool>
      <Tool label="Citação" active={s.quote} onClick={() => run().toggleBlockquote().run()}>
        <Quote />
      </Tool>
    </BubbleMenu>
  )
}
