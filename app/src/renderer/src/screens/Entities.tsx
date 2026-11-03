import { Plus, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCampaign } from '@/campaign'
import { createEntity, KIND_LABEL } from '@/lib/actions'
import { useLoad } from '@/lib/data'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, Portrait } from '@/ui'
import { ENTITY_KINDS, type EntityKind } from '@shared/types'
import { BringEntities } from './BringEntities'

export function Entities() {
  const params = useParams()
  const kind = (ENTITY_KINDS as readonly string[]).includes(params.kind ?? '') ? (params.kind as EntityKind) : 'personagem'
  const navigate = useNavigate()
  const { version, changed } = useCampaign()
  const [q, setQ] = useState('')
  const list = useLoad(() => window.api.entities.list({ kind, q }), [kind, q, version])

  const create = async () => {
    const id = await createEntity(kind)
    changed()
    navigate(`/ficha/${id}`)
  }

  return (
    <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5 px-6 py-6">
      <div className="flex items-center gap-2">
        <h1 className="type-xl mr-auto">Fichas</h1>
        <BringEntities />
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
          {kind === 'personagem' || kind === 'local' || kind === 'grupo' ? 'Novo' : 'Nova'} {KIND_LABEL[kind].one.toLowerCase()}
        </Button>
      </div>

      <div role="tablist" aria-label="Tipo de ficha" className="flex gap-6 border-b border-border">
        {ENTITY_KINDS.map((k) => (
          <Link
            key={k}
            role="tab"
            aria-selected={k === kind}
            to={`/fichas/${k}`}
            className={cx(
              '-mb-px border-b-2 py-2.5 text-sm font-medium transition-colors',
              k === kind ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            )}
          >
            {KIND_LABEL[k].many}
          </Link>
        ))}
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Buscar nas fichas</span>
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, apelido ou papel"
          className="h-9 w-full rounded-md border border-border-input bg-bg pr-3 pl-8.5 text-sm text-fg focus:border-focus"
        />
      </label>

      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}

      {list.data && list.data.length === 0 && (
        <Card>
          <EmptyState
            icon={<Users />}
            title={q ? `Nada com «${q}»` : `Nenhuma ficha em ${KIND_LABEL[kind].many.toLowerCase()}`}
            text={q ? 'Tente outra parte do nome, ou crie a ficha.' : 'Fichas guardam quem e o que existe na campanha. O nome delas é achado sozinho nos textos.'}
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
                Criar ficha
              </Button>
            }
          />
        </Card>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {list.data?.map((e) => (
          <li key={e.id}>
            <Link
              to={`/ficha/${e.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-input"
            >
              <Portrait name={e.name} src={e.portraitUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.name || <span className="font-normal text-subtle italic">Sem nome</span>}</span>
                <span className="block truncate text-xs text-muted">{e.role || KIND_LABEL[e.kind].one}</span>
              </span>
              {e.isPlayer && <Chip tone="success">PJ</Chip>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
