// Corkboard: as cenas como cartões, na ordem de planejamento. Arrastar reordena; os botões ← → fazem o mesmo pelo teclado.
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import type { SceneSummary } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { Chip, cx, ErrorNote, IconButton } from '@/ui'

const STATUS = { planejada: null, jogada: ['Jogada', 'success'], pulada: ['Pulada', 'neutral'] } as const

export function Corkboard({ scenes }: { scenes: SceneSummary[] }) {
  const campaign = useOpenCampaign()
  const { changed } = useCampaign()
  const navigate = useNavigate()
  const [order, setOrder] = useState<SceneSummary[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setOrder([...scenes].sort((a, b) => a.sort - b.sort)), [scenes])

  const save = async (next: SceneSummary[]) => {
    setOrder(next)
    try {
      await window.api.scenes.reorder(next.map((s) => s.id))
      setError(null)
      changed()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void save(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Ordem de planejamento: arraste os cartões. A lista por hora no jogo continua na outra aba.</p>
      {error && <ErrorNote message={error} />}
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-4" aria-label="Corkboard de cenas">
        {order.map((s, i) => {
          const status = STATUS[s.status]
          return (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => {
                setDragging(s.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', s.id)
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => {
                if (dragging) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = order.findIndex((x) => x.id === dragging)
                if (from !== -1) move(from, i)
                setDragging(null)
              }}
              className={cx(
                'group flex min-h-40 cursor-grab flex-col rounded-md border border-border bg-surface-raised shadow-pop transition-opacity active:cursor-grabbing',
                dragging === s.id && 'opacity-40'
              )}
            >
              <button type="button" onClick={() => navigate(`/cenas/${s.id}`)} className="flex flex-1 flex-col gap-1.5 p-3 text-left">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                    {s.gameMinuteStart === null ? 'sem hora' : formatGameTime(campaign.epochDate, s.gameMinuteStart)}
                  </span>
                  {status && <Chip tone={status[1]}>{status[0]}</Chip>}
                </span>
                <span className="font-serif text-base leading-snug font-semibold">{s.title || 'Sem título'}</span>
                {s.summaryText && <span className="line-clamp-4 text-sm text-muted">{s.summaryText}</span>}
                {s.locationName && (
                  <span className="mt-auto flex items-center gap-1 pt-1 text-xs text-subtle">
                    <MapPin className="size-3" aria-hidden />
                    {s.locationName}
                  </span>
                )}
              </button>
              <span className="flex justify-end gap-1 border-t border-border px-2 py-1 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton label={`Mover ${s.title || 'cena'} para antes`} disabled={i === 0} onClick={() => move(i, i - 1)} className="size-7 disabled:opacity-30">
                  <ArrowLeft className="size-3.5" />
                </IconButton>
                <IconButton label={`Mover ${s.title || 'cena'} para depois`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} className="size-7 disabled:opacity-30">
                  <ArrowRight className="size-3.5" />
                </IconButton>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
