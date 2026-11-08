import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, type Editor, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCampaign } from '@/campaign'
import { FormatBar } from './FormatBar'
import { MentionHighlight, mentionKey } from './MentionHighlight'
import { findSlash, SlashMenu, type SlashMatch, type SlashMenuHandle } from './SlashMenu'

interface Props {
  /** JSON do documento, ou null para vazio. Só é lido na montagem: trocar de cena remonta o editor. */
  initial: string | null
  label: string
  onChange: (json: string) => void
  placeholder?: string
  /** Só leitura (tela de sessão): sem barra de formatação, menções continuam clicáveis. */
  readOnly?: boolean
}

/** Editor de texto com menções e barra de formatação. Usado nas cenas e nos Textos. */
const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length

export function SceneEditor({ initial, label, onChange, placeholder = 'Escreva o que acontece aqui. Nomes de fichas viram ligação sozinhos.', readOnly = false }: Props) {
  const { matcher, targets } = useCampaign()
  const navigate = useNavigate()
  // O plugin lê sempre o valor mais novo, sem recriar o editor.
  const matcherRef = useRef(matcher)
  matcherRef.current = matcher
  const namesRef = useRef(new Map(targets.map((t) => [t.id, t.name])))
  namesRef.current = new Map(targets.map((t) => [t.id, t.name]))
  const onChangeRef = useRef(onChange)
  const [words, setWords] = useState(0)
  const [slash, setSlash] = useState<SlashMatch | null>(null)
  const dismissedSlashRef = useRef<number | null>(null)
  const slashMenuRef = useRef<SlashMenuHandle>(null)
  onChangeRef.current = onChange

  const refreshSlash = (e: Editor) => {
    if (readOnly) return setSlash(null)
    // Se a barra que foi fechada foi apagada, uma nova barra no mesmo lugar abre de novo.
    const raw = findSlash(e, null)
    if (!raw) dismissedSlashRef.current = null
    const next = raw?.from === dismissedSlashRef.current ? null : raw
    setSlash((current) => (current?.from === next?.from && current?.to === next?.to && current?.query === next?.query ? current : next))
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder }),
      MentionHighlight.configure({
        getMatcher: () => matcherRef.current,
        getName: (id) => namesRef.current.get(id) ?? '',
        onOpen: (id) => navigate(`/ficha/${id}`)
      })
    ],
    content: initial ? JSON.parse(initial) : '',
    editable: !readOnly,
    editorProps: {
      attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true' },
      handleKeyDown: (_view, event) => slashMenuRef.current?.onKey(event) ?? false
    },
    onCreate: ({ editor: e }) => setWords(countWords(e.getText())),
    onUpdate: ({ editor: e }) => {
      setWords(countWords(e.getText()))
      onChangeRef.current(JSON.stringify(e.getJSON()))
      refreshSlash(e)
    },
    onSelectionUpdate: ({ editor: e }) => refreshSlash(e)
  })

  // Fichas mudaram (nome novo, apelido): redesenha os sublinhados.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(mentionKey, 'refresh'))
  }, [editor, matcher])

  return (
    <>
      {editor && !readOnly && <FormatBar editor={editor} />}
      <EditorContent editor={editor} className="scene-editor" />
      {editor && slash && !readOnly && (
        <SlashMenu
          ref={slashMenuRef}
          editor={editor}
          match={slash}
          onClose={(dismiss) => {
            if (dismiss) dismissedSlashRef.current = slash.from
            setSlash(null)
          }}
        />
      )}
      {!readOnly && words > 0 && (
        <p className="mt-2 text-right font-mono text-xs text-subtle" aria-live="off">
          {words} {words === 1 ? 'palavra' : 'palavras'}
        </p>
      )}
    </>
  )
}
