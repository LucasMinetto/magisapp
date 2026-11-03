import { Clapperboard, FileDown, ImagePlus, MapPin, Plus } from 'lucide-react'
import { useExportDialog } from './ExportDialog'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatDuration, formatGameTime, toParts, weekdayName } from '@shared/gameTime'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { createScene } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, EmptyState, ErrorNote, SaveIndicator } from '@/ui'
import type { CampaignUpdate } from '@shared/types'

function Stat({ n, label }: { n: number | undefined; label: string }) {
  return (
    <Card>
      <div className={`type-xl font-mono! ${n ? '' : 'text-muted'}`}>{n ?? '–'}</div>
      <div className="type-label mt-1 text-muted">{label}</div>
    </Card>
  )
}

/** Capa, nome e frase da campanha. Aparecem também na biblioteca. */
function CampaignCard() {
  const campaign = useOpenCampaign()
  const { setCampaign } = useCampaign()
  const openExport = useExportDialog()
  const [draft, setDraft] = useState<CampaignUpdate>({ name: campaign.name, tagline: campaign.tagline ?? '', coverId: campaign.coverId })
  const [cover, setCover] = useState(campaign.coverUrl)
  const [error, setError] = useState<string | null>(null)
  const autosave = useAutosave(async (value: CampaignUpdate) => {
    if (!value.name.trim()) return
    setCampaign(await window.api.campaign.update(value))
  })
  const update = (patch: Partial<CampaignUpdate>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    autosave.schedule(next)
  }
  const pick = async () => {
    try {
      const a = await window.api.attachments.pickImage()
      if (!a) return
      setCover(a.url)
      setError(null)
      update({ coverId: a.id })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const p = toParts(campaign.epochDate, 0)

  return (
    <Card className="flex flex-wrap items-stretch gap-5 p-0">
      <div className="group relative aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-l-lg border-r border-border bg-bg">
        {cover ? (
          <img src={cover} alt={`Capa de ${draft.name}`} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <ImagePlus className="size-6" aria-hidden />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-black/60 p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button size="sm" onClick={() => void pick()}>
            {cover ? 'Trocar capa' : 'Escolher capa'}
          </Button>
          {cover && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCover(null)
                update({ coverId: null })
              }}
            >
              Tirar
            </Button>
          )}
        </div>
      </div>
      <div className="flex min-w-60 flex-1 flex-col gap-2 py-4 pr-5">
        <label className="sr-only" htmlFor="campaign-name">
          Nome da campanha
        </label>
        <input
          id="campaign-name"
          value={draft.name}
          maxLength={120}
          onChange={(e) => update({ name: e.target.value })}
          aria-invalid={!draft.name.trim() || undefined}
          className="type-xl w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus aria-invalid:border-danger"
        />
        <label className="sr-only" htmlFor="campaign-tagline">
          Frase da campanha
        </label>
        <input
          id="campaign-tagline"
          value={draft.tagline}
          maxLength={300}
          placeholder="Uma frase sobre o caso (aparece na biblioteca)"
          onChange={(e) => update({ tagline: e.target.value })}
          className="w-full rounded-md border border-transparent bg-transparent px-1 font-serif text-muted italic hover:border-border focus:border-focus"
        />
        <p className="mt-auto px-1 text-sm text-muted">
          O caso começa {weekdayName(p.weekday, true)}, {formatGameTime(campaign.epochDate, 0, 'long').split(', ')[1].split(' ·')[0]}.
        </p>
        <div className="flex items-center gap-3 px-1">
          <SaveIndicator state={autosave.state} error={autosave.error} />
          <Button size="sm" variant="ghost" icon={<FileDown className="size-4" />} onClick={openExport} className="ml-auto">
            Exportar…
          </Button>
          {!draft.name.trim() && <span className="text-xs text-danger">A campanha precisa de um nome.</span>}
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      </div>
    </Card>
  )
}

export function Home() {
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const navigate = useNavigate()
  const counts = useLoad(() => window.api.campaign.counts(), [version])
  const scenes = useLoad(() => window.api.scenes.list(), [version])

  const now = campaign.currentGameMinute
  const upcoming = (scenes.data ?? []).filter((s) => s.status === 'planejada')

  return (
    <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-8 px-6 py-8">
      <CampaignCard />
      <section aria-label="Resumo" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat n={counts.data?.entities} label="Fichas" />
        <Stat n={counts.data?.scenes} label="Cenas" />
        <Stat n={counts.data?.clues} label="Pistas" />
        <Stat n={counts.data?.sessions} label="Sessões jogadas" />
      </section>

      <section aria-labelledby="next-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="next-h" className="type-label text-muted">
            Próximas cenas
          </h2>
          <Button
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={async () => {
              const id = await createScene()
              changed()
              navigate(`/cenas/${id}`)
            }}
          >
            Nova cena
          </Button>
        </div>
        {scenes.error && <ErrorNote message={scenes.error} onRetry={scenes.reload} />}
        {scenes.data && upcoming.length === 0 && (
          <Card>
            <EmptyState icon={<Clapperboard />} title="Nenhuma cena planejada" text="Crie as cenas da aventura e dê uma hora a cada uma." />
          </Card>
        )}
        <ul className="flex flex-col gap-2">
          {upcoming.map((s) => {
            const until = s.gameMinuteStart === null ? null : s.gameMinuteStart - now
            return (
              <li key={s.id}>
                <Link
                  to={`/cenas/${s.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-input"
                >
                  <span className="w-36 shrink-0 font-mono text-xs text-muted">
                    {s.gameMinuteStart === null ? 'sem hora' : formatGameTime(campaign.epochDate, s.gameMinuteStart)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.title || 'Sem título'}</span>
                    {s.locationName && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <MapPin className="size-3" aria-hidden /> {s.locationName}
                      </span>
                    )}
                  </span>
                  {until !== null && until >= 0 && <Chip tone={until < 60 ? 'warning' : 'neutral'}>em {formatDuration(until)}</Chip>}
                  {until !== null && until < 0 && <Chip tone="danger">hora já passou</Chip>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
