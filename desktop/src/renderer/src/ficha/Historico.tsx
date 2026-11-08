// Aba Histórico: rolagens desta ficha, com desfazer.
import { useCampaign } from '@/campaign'
import { useLoad } from '@/lib/data'
import { Undo2 } from 'lucide-react'
import { cx, ErrorNote, IconButton } from '@/ui'
import { Vazio } from './partes'

export function Historico({ entityId }: { entityId: string }) {
  const { version, changed } = useCampaign()
  const rolls = useLoad(() => window.api.rolls.list({ entityId, limit: 100 }), [entityId, version])
  if (rolls.error) return <ErrorNote message={rolls.error} onRetry={rolls.reload} />
  if (!rolls.data) return null
  if (rolls.data.length === 0) return <Vazio>Nenhuma rolagem registrada ainda.</Vazio>
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Rolagens">
      {rolls.data.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{r.label || r.formula || 'Rolagem'}</div>
            <div className="truncate text-xs text-subtle">
              {new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {r.formula && ` · ${r.formula}`}
              {r.detail && ` · ${r.detail}`}
            </div>
          </div>
          <div className={cx('font-serif text-2xl font-semibold', r.critical && 'text-success')} title={r.critical ? 'Crítico' : undefined}>
            {r.total}
          </div>
          <IconButton
            label={`Desfazer ${r.label || 'rolagem'}`}
            onClick={() =>
              void window.api.rolls
                .remove(r.id)
                .then(changed)
                .catch((e: Error) => window.alert(e.message))
            }
          >
            <Undo2 className="size-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  )
}
