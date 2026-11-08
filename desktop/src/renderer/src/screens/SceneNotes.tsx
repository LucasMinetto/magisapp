// Blocos de notas do mestre dentro da cena: "Se forem ao porão…", "Lembrar de…". Cada bloco salva sozinho.
import { Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { SceneNote } from '@shared/types'
import { useCampaign } from '@/campaign'
import { useAutosave } from '@/lib/data'
import { Button, ErrorNote, IconButton, SaveIndicator } from '@/ui'

function NoteBlock({ sceneId, note, onDeleted }: { sceneId: string; note: SceneNote; onDeleted: () => void }) {
  const { changed } = useCampaign()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const autosave = useAutosave(async (v: { title: string; body: string }) => {
    await window.api.scenes.saveNote({ id: note.id, sceneId, ...v })
    changed()
  })
  const update = (patch: Partial<{ title: string; body: string }>) => {
    const next = { title, body, ...patch }
    setTitle(next.title)
    setBody(next.body)
    autosave.schedule(next)
  }
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Título do bloco"
          aria-label="Título do bloco"
          maxLength={200}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-focus"
        />
        <SaveIndicator state={autosave.state} error={autosave.error} />
        <IconButton label={`Apagar o bloco ${title || 'sem título'}`} onClick={onDeleted} className="size-7">
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
      <textarea
        value={body}
        onChange={(e) => update({ body: e.target.value })}
        placeholder="O que fazer se…, o que lembrar, o que dizer."
        aria-label={`Texto do bloco ${title || 'sem título'}`}
        maxLength={20_000}
        rows={2}
        className="field-sizing-content min-h-14 w-full resize-none rounded-md border border-border-input bg-bg px-2 py-1.5 text-sm leading-relaxed text-fg focus:border-focus"
      />
    </li>
  )
}

export function SceneNotes({ sceneId, notes, onChange, readOnly = false }: { sceneId: string; notes: SceneNote[]; onChange: () => void; readOnly?: boolean }) {
  const { changed } = useCampaign()
  const [error, setError] = useState<string | null>(null)
  const act = async (job: Promise<unknown>) => {
    try {
      await job
      setError(null)
      changed()
      onChange()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (readOnly && notes.length === 0) return null
  return (
    <section aria-labelledby={`notes-${sceneId}`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 id={`notes-${sceneId}`} className="type-label text-muted">
          Notas do mestre
        </h2>
        {!readOnly && (
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => void act(window.api.scenes.saveNote({ sceneId, title: '', body: '' }))} className="ml-auto">
            Novo bloco
          </Button>
        )}
      </div>
      {!readOnly && notes.length === 0 && <p className="text-sm text-subtle">Blocos curtos para a mesa: o que fazer se os jogadores forem por outro caminho, o que não esquecer.</p>}
      {error && <ErrorNote message={error} />}
      {readOnly ? (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="size-3.5 text-muted" aria-hidden />
                {n.title || 'Nota'}
              </div>
              {n.body && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{n.body}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <NoteBlock key={n.id} sceneId={sceneId} note={n} onDeleted={() => void act(window.api.scenes.deleteNote(n.id))} />
          ))}
        </ul>
      )}
    </section>
  )
}
