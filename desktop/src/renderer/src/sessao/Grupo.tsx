// Faixa do grupo (T10b): os agentes dos jogadores com PV/PE/SAN sempre à vista no modo cena.
// Sanidade e PE mudam fora do combate também.
import { Link } from 'react-router'
import type { EntitySummary } from '@shared/types'
import { SaveIndicator } from '@/ui'
import { Contador, recursos, useFichaViva } from './NaCena'

export function FaixaGrupo({ jogadores }: { jogadores: EntitySummary[] }) {
  if (!jogadores.length) return null
  return (
    <section aria-label="Grupo" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2">
      <h2 className="type-label text-muted">Grupo</h2>
      {jogadores.map((j) => (
        <Agente key={j.id} id={j.id} />
      ))}
    </section>
  )
}

function Agente({ id }: { id: string }) {
  const { entity, salvar, autosave } = useFichaViva(id)
  if (!entity) return null
  const { barras, somar } = recursos(entity, salvar)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link to={`/ficha/${entity.id}`} className="text-sm font-semibold hover:underline">
        {entity.name}
      </Link>
      {barras.length === 0 && <span className="text-xs text-subtle">sem PV na ficha</span>}
      {barras.map((b) => (
        <Contador key={b.chave} b={b} nome={entity.name} aoSomar={(d) => somar(b.chave, d)} />
      ))}
      <SaveIndicator state={autosave.state} error={autosave.error} />
    </div>
  )
}
