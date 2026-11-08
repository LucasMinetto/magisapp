import { Archive, BookOpen, FolderOpen, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCampaign } from '@/campaign'
import { useLoad } from '@/lib/data'
import { Button, Card, Dialog, EmptyState, ErrorNote, IconButton, TextField } from '@/ui'
import type { RecentCampaign } from '@shared/types'
import { fromParts, toParts, weekdayName } from '@shared/gameTime'

const today = () => new Date().toISOString().slice(0, 10)

/** "Editar" de uma campanha fechada: renomear, abrir a pasta, backup, excluir. */
function CampaignActions({ campaign, onClose, onChanged }: { campaign: RecentCampaign | null; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shownFor, setShownFor] = useState<string | null>(null)
  if (campaign && shownFor !== campaign.path) {
    setShownFor(campaign.path)
    setName(campaign.name)
    setConfirmDelete(false)
    setNote(null)
    setError(null)
  }
  const act = async (job: () => Promise<string | void>, close = false) => {
    setBusy(true)
    setError(null)
    try {
      const msg = await job()
      setNote(msg || null)
      onChanged()
      if (close) onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!campaign) return null
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Editar campanha"
      description={campaign.path}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act(async () => {
              await window.api.campaign.renameRecent({ path: campaign.path, name: name.trim() })
              return 'Nome salvo.'
            })
          }}
        >
          <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="flex-1" />
          <Button type="submit" disabled={busy || !name.trim() || name.trim() === campaign.name}>
            Renomear
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FolderOpen className="size-4" />} disabled={busy} onClick={() => void act(() => window.api.campaign.revealRecent(campaign.path))}>
            Abrir a pasta
          </Button>
          <Button
            icon={<Archive className="size-4" />}
            loading={busy}
            onClick={() =>
              void act(async () => {
                const file = await window.api.campaign.backupRecent(campaign.path)
                return `Backup feito: ${file.split(/[\\/]/).pop()}`
              })
            }
          >
            Fazer backup
          </Button>
        </div>
        {note && (
          <p role="status" className="text-sm text-success">
            {note}
          </p>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {confirmDelete ? (
            <>
              <p className="text-sm">
                A pasta da campanha vai para a <strong>Lixeira do Windows</strong>. Dá para recuperar por lá enquanto ela não for esvaziada. Os backups continuam onde estão.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" icon={<Trash2 className="size-4" />} loading={busy} onClick={() => void act(() => window.api.campaign.trashRecent(campaign.path), true)}>
                  Excluir {campaign.name}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)} className="self-start">
              Excluir campanha…
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

/** Tela sem campanha aberta: recentes, criar, abrir, exemplo. */
export function Library() {
  const { setCampaign } = useCampaign()
  const recent = useLoad(() => window.api.campaign.recent(), [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guarda só o caminho: depois de renomear, o diálogo mostra o nome novo que veio da lista.
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const editing: RecentCampaign | null = recent.data?.find((r) => r.path === editingPath) ?? null

  const run = async (job: () => Promise<Awaited<ReturnType<typeof window.api.campaign.current>>>) => {
    setBusy(true)
    setError(null)
    try {
      const c = await job()
      if (c) setCampaign(c)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dateOk = fromParts(date, date, '00:00') !== null
  const dayIndex = dateOk ? toParts(date, 0).weekday : null
  // "num sábado", "numa quarta"
  const weekday = dayIndex === null ? null : `${dayIndex === 0 || dayIndex === 6 ? 'num' : 'numa'} ${weekdayName(dayIndex, true)}`

  return (
    <div className="mx-auto flex min-h-full max-w-(--layout-content-max) flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-display">Campanhas</h1>
          <p className="mt-1 text-muted">Cada campanha é uma pasta no seu computador. Nada sai daqui.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FolderOpen className="size-4" />} onClick={() => run(() => window.api.campaign.pickAndOpen())} disabled={busy}>
            Abrir pasta…
          </Button>
          <Button icon={<RotateCcw className="size-4" />} onClick={() => run(() => window.api.backup.pickAndRestore())} disabled={busy}>
            Restaurar backup…
          </Button>
          <Button
            icon={<Sparkles className="size-4" />}
            onClick={() => run(() => window.api.campaign.create({ name: 'Caso do Hospital (exemplo)', epochDate: '2026-07-22', example: true }))}
            disabled={busy}
          >
            Campanha de exemplo
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} disabled={busy}>
            Nova campanha
          </Button>
        </div>
      </header>

      {error && <ErrorNote message={error} />}
      {recent.error && <ErrorNote message={recent.error} onRetry={recent.reload} />}

      {recent.data && recent.data.length === 0 && (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title="Nenhuma campanha ainda"
            text="Crie uma campanha com a data em que o caso começa, ou abra a de exemplo para ver como fica."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Nova campanha
              </Button>
            }
          />
        </Card>
      )}

      {recent.data && recent.data.length > 0 && (
        <section aria-labelledby="recent-h">
          <h2 id="recent-h" className="type-label mb-3 text-muted">
            Recentes
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(calc(var(--layout-card-min)*1.6),1fr))] gap-4">
            {recent.data.map((r) => (
              <li key={r.path} className="relative">
                <IconButton label={`Editar ${r.name}`} onClick={() => setEditingPath(r.path)} className="absolute top-2 right-2 z-10 bg-surface/80">
                  <Pencil className="size-4" />
                </IconButton>
                <button
                  type="button"
                  onClick={() => run(() => window.api.campaign.open(r.path))}
                  disabled={busy}
                  className="flex w-full overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors hover:border-border-input"
                >
                  <span className="grid aspect-[3/4] w-24 shrink-0 place-items-center border-r border-border bg-bg">
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <BookOpen className="size-6 text-subtle" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col p-4">
                    <span className="type-lg block truncate">{r.name}</span>
                    {r.tagline && <span className="mt-0.5 line-clamp-2 font-serif text-sm text-muted italic">{r.tagline}</span>}
                    {r.epochDate && (
                      <span className="mt-2 block font-mono text-xs text-muted">
                        caso: {weekdayName(toParts(r.epochDate, 0).weekday)} {r.epochDate.slice(8)}/{r.epochDate.slice(5, 7)}/{r.epochDate.slice(0, 4)}
                      </span>
                    )}
                    {r.counts && (
                      <span className="mt-1 block text-xs text-muted">
                        {r.counts.entities} fichas · {r.counts.scenes} cenas · {r.counts.clues} pistas
                      </span>
                    )}
                    <span className="mt-auto block truncate pt-2 text-xs text-subtle" title={r.path}>
                      Aberta em {new Date(r.openedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CampaignActions campaign={editing} onClose={() => setEditingPath(null)} onChanged={recent.reload} />

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nova campanha"
        description="A data do caso é o dia em que os agentes são chamados. Tudo na linha do tempo conta a partir dela."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!name.trim() || !dateOk}
              onClick={() =>
                run(async () => {
                  const c = await window.api.campaign.create({ name: name.trim(), epochDate: date })
                  setCreating(false)
                  return c
                })
              }
            >
              Criar
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Caso do Hospital" autoFocus maxLength={120} />
          <TextField
            label="Data do caso"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint={weekday ? `Cai ${weekday}.` : undefined}
            error={dateOk ? null : 'Data inválida.'}
          />
        </form>
      </Dialog>
    </div>
  )
}
