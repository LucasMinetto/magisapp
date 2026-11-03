// Acervo: trazer fichas de outra campanha (o NPC que volta, os agentes de sempre).
import { Library } from 'lucide-react'
import { useState } from 'react'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { KIND_LABEL } from '@/lib/actions'
import { useLoad } from '@/lib/data'
import { Button, Dialog, ErrorNote, Portrait, SelectField } from '@/ui'

export function BringEntities() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={<Library className="size-4" />} onClick={() => setOpen(true)}>
        Trazer de outra campanha…
      </Button>
      {open && <BringDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function BringDialog({ onClose }: { onClose: () => void }) {
  const campaign = useOpenCampaign()
  const { changed } = useCampaign()
  const recent = useLoad(() => window.api.campaign.recent(), [])
  const others = (recent.data ?? []).filter((r) => r.path !== campaign.path)
  const [path, setPath] = useState('')
  const list = useLoad(() => (path ? window.api.entities.peekOther(path) : Promise.resolve([])), [path])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const bring = async () => {
    try {
      const r = await window.api.entities.importFrom({ path, ids: [...picked] })
      changed()
      setPicked(new Set())
      setError(null)
      setNote(
        [r.imported > 0 && `${r.imported} ${r.imported === 1 ? 'ficha trazida' : 'fichas trazidas'}`, r.skipped.length > 0 && `já existiam aqui: ${r.skipped.join(', ')}`]
          .filter(Boolean)
          .join(' · ') || 'Nada trazido.'
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Trazer fichas de outra campanha"
      description="Uma cópia: mudar aqui não muda lá. Retrato, mapa, notas e atributos vêm junto."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="primary" disabled={picked.size === 0} onClick={() => void bring()}>
            Trazer {picked.size > 0 ? picked.size : ''} {picked.size === 1 ? 'ficha' : 'fichas'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {recent.data && others.length === 0 ? (
          <p className="text-sm text-muted">Não há outra campanha na lista. Abra a outra campanha uma vez para ela aparecer aqui.</p>
        ) : (
          <SelectField
            label="Campanha"
            empty="Escolha a campanha"
            options={others.map((r) => ({ value: r.path, label: r.name }))}
            value={path}
            onChange={(e) => {
              setPath(e.target.value)
              setPicked(new Set())
              setNote(null)
            }}
          />
        )}
        {list.error && <ErrorNote message={list.error} />}
        {path && list.data && (
          <ul className="flex max-h-72 flex-col gap-1 overflow-auto" aria-label="Fichas da outra campanha">
            {list.data.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface">
                  <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="accent-accent" />
                  <Portrait name={e.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{e.name || 'Sem nome'}</span>
                  <span className="text-xs text-subtle">
                    {KIND_LABEL[e.kind].one}
                    {e.isPlayer ? ' · PJ' : ''}
                  </span>
                </label>
              </li>
            ))}
            {list.data.length === 0 && <li className="px-2 text-sm text-muted">Nenhuma ficha nessa campanha.</li>}
          </ul>
        )}
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
