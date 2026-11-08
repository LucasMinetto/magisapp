// "Modelos…" nas Cenas: aplicar um esqueleto de investigação, salvar o seu, apagar o seu.
import { LayoutTemplate, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { StructureTemplate } from '@shared/types'
import { useCampaign } from '@/campaign'
import { useLoad } from '@/lib/data'
import { Button, Chip, Dialog, ErrorNote, IconButton, TextField } from '@/ui'

export function StructureMenu() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={<LayoutTemplate className="size-4" />} onClick={() => setOpen(true)}>
        Modelos…
      </Button>
      {open && <StructureDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function StructureDialog({ onClose }: { onClose: () => void }) {
  const { changed } = useCampaign()
  const list = useLoad(() => window.api.structures.list(), [])
  const [confirm, setConfirm] = useState<StructureTemplate | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const act = async (job: () => Promise<string>) => {
    try {
      setNote(await job())
      setError(null)
      list.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Modelos de estrutura"
      description="Um esqueleto de cenas para começar. As cenas entram no fim da lista; nada é apagado."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {list.error && <ErrorNote message={list.error} />}
        <ul className="flex max-h-80 flex-col gap-2 overflow-auto" aria-label="Modelos">
          {list.data?.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {t.name}
                  {!t.builtin && <Chip>seu</Chip>}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{t.description}</span>
                <span className="mt-1 block truncate text-xs text-subtle">{t.scenes.map((s) => s.title).join(' → ')}</span>
              </span>
              {confirm?.id === t.id ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs">Criar {t.scenes.length} cenas?</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Não
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        void act(async () => {
                          const n = await window.api.structures.apply(t.id)
                          setConfirm(null)
                          changed()
                          return `${n} cenas criadas com o modelo "${t.name}".`
                        })
                      }
                    >
                      Criar
                    </Button>
                  </span>
                </span>
              ) : (
                <span className="flex shrink-0 gap-1">
                  <Button size="sm" onClick={() => setConfirm(t)} aria-label={`Aplicar o modelo ${t.name}`}>
                    Aplicar
                  </Button>
                  {!t.builtin && (
                    <IconButton
                      label={`Apagar o modelo ${t.name}`}
                      onClick={() =>
                        void act(async () => {
                          await window.api.structures.remove(t.id)
                          return `Modelo "${t.name}" apagado.`
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex items-end gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void act(async () => {
              const t = await window.api.structures.save(name.trim())
              setName('')
              return `Modelo "${t.name}" salvo com ${t.scenes.length} cenas. Ele aparece em todas as campanhas.`
            })
          }}
        >
          <TextField label="Salvar as cenas desta campanha como modelo" placeholder="Nome do modelo" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="flex-1" />
          <Button type="submit" icon={<Save className="size-4" />} disabled={!name.trim()}>
            Salvar
          </Button>
        </form>
        {note && (
          <p role="status" className="text-sm text-success">
            {note}
          </p>
        )}
        {error && <ErrorNote message={error} />}
      </div>
    </Dialog>
  )
}
