import { CalendarClock, Clapperboard, FileSearch, FileText, Network, RotateCcw, Trash2, User } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { EntityKind, TrashItem, TrashType } from '@shared/types'
import { useCampaign } from '@/campaign'
import { KIND_LABEL } from '@/lib/actions'
import { useLoad } from '@/lib/data'
import { Button, Card, Dialog, EmptyState, ErrorNote } from '@/ui'

const ICON: Record<TrashType, ReactNode> = {
  entity: <User />,
  scene: <Clapperboard />,
  event: <CalendarClock />,
  clue: <FileSearch />,
  board: <Network />,
  document: <FileText />
}

const KEEP_DAYS = 60
const DAY = 86_400_000

/** "Ficha · Personagem" para fichas (o detalhe vem como o tipo), o rótulo pronto para o resto. */
const detail = (i: TrashItem) => (i.type === 'entity' ? `Ficha · ${KIND_LABEL[i.detail as EntityKind]?.one ?? i.detail}` : i.detail)

export function Trash() {
  const { version, changed } = useCampaign()
  const list = useLoad(() => window.api.trash.list(), [version])
  const [purging, setPurging] = useState<TrashItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (job: Promise<void>) => {
    try {
      await job
      setError(null)
      changed()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5 px-6 py-6">
      <header>
        <h1 className="type-xl">Lixeira</h1>
        <p className="mt-1 text-sm text-muted">O que vem para cá fica {KEEP_DAYS} dias e depois some sozinho. Restaurar devolve tudo como estava, com as ligações.</p>
      </header>
      {error && <ErrorNote message={error} />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}

      {list.data?.length === 0 && (
        <Card>
          <EmptyState icon={<Trash2 />} title="Lixeira vazia" text="Fichas, cenas, eventos, pistas, quadros e textos que você tirar aparecem aqui." />
        </Card>
      )}

      <ul className="flex flex-col gap-2" aria-label="Itens na lixeira">
        {list.data?.map((i) => {
          const left = Math.max(0, KEEP_DAYS - Math.floor((Date.now() - Date.parse(i.deletedAt)) / DAY))
          return (
            <li key={`${i.type}:${i.id}`} className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
              <span className="text-muted [&>svg]:size-4">{ICON[i.type]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{i.title}</span>
                <span className="block text-xs text-muted">
                  {detail(i)} · tirado em {new Date(i.deletedAt).toLocaleDateString('pt-BR')} · {left === 1 ? 'some em 1 dia' : `some em ${left} dias`}
                </span>
              </span>
              <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={() => act(window.api.trash.restore({ type: i.type, id: i.id }))} aria-label={`Restaurar ${i.title}`}>
                Restaurar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPurging(i)} aria-label={`Apagar ${i.title} de vez`}>
                Apagar de vez
              </Button>
            </li>
          )
        })}
      </ul>

      <Dialog
        open={purging !== null}
        onOpenChange={(o) => !o && setPurging(null)}
        title="Apagar de vez?"
        description="Não dá para desfazer. Os itens de quadro e as ligações deste item vão junto."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurging(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (purging) void act(window.api.trash.purge({ type: purging.type, id: purging.id }))
                setPurging(null)
              }}
            >
              Apagar de vez
            </Button>
          </>
        }
      >
        <p className="text-sm">{purging?.title}</p>
      </Dialog>
    </div>
  )
}
