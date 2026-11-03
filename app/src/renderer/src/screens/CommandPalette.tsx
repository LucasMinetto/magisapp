import * as RadixDialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { CalendarClock, Clapperboard, FileDown, FileSearch, FileText, Home, MapPin, Plus, Search, SearchCheck, Skull, User, Users } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useCampaign } from '@/campaign'
import { createEntity, createScene, KIND_LABEL } from '@/lib/actions'
import { useExportDialog } from './ExportDialog'
import type { EntityKind, SearchResult } from '@shared/types'

const KIND_ICON: Record<EntityKind, ReactNode> = {
  personagem: <User />,
  criatura: <Skull />,
  local: <MapPin />,
  grupo: <Users />,
  lore: <SearchCheck />
}

/** Trecho da busca vem com o termo entre [ ]; vira destaque sem usar HTML cru. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']') ? (
          <mark key={i} className="bg-transparent font-semibold text-fg underline underline-offset-2">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  )
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg data-[selected=true]:bg-accent/10 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted'

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const openExport = useExportDialog()
  const { version, changed } = useCampaign()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  // Enter sempre pega o primeiro resultado da busca; sem resultado, o primeiro comando.
  useEffect(() => {
    setSelected(results[0] ? `${results[0].refType}:${results[0].refId}` : q.trim() ? 'new:npc' : 'go:home')
  }, [results, q])

  useEffect(() => {
    if (!q.trim()) return setResults([])
    let alive = true
    const t = setTimeout(() => {
      window.api.search
        .query({ q, limit: 20 })
        .then((r) => alive && (setResults(r), setError(null)))
        .catch((e: Error) => alive && setError(e.message))
    }, 80)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, version])

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }
  const openResult = (r: SearchResult) =>
    go(
      r.refType === 'entity'
        ? `/ficha/${r.refId}`
        : r.refType === 'event'
          ? `/linha-do-tempo?evento=${r.refId}`
          : r.refType === 'clue'
            ? `/pistas?pista=${r.refId}`
            : r.refType === 'document'
              ? `/textos/${r.refId}`
              : r.refType === 'session'
                ? `/sessao?s=${r.refId}`
                : `/cenas/${r.refId}`
    )
  const newEntity = async (kind: EntityKind) => {
    const id = await createEntity(kind, q.trim())
    changed()
    go(`/ficha/${id}`)
  }
  const newScene = async () => {
    const id = await createScene(q.trim())
    changed()
    go(`/cenas/${id}`)
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/50" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-[15%] left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-pop"
        >
          <RadixDialog.Title className="sr-only">Buscar</RadixDialog.Title>
          <Command shouldFilter={false} label="Buscar na campanha" loop value={selected} onValueChange={setSelected}>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-muted" aria-hidden />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Buscar fichas, cenas, pistas… ou um comando"
                className="h-12 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-sm border border-border-input px-1.5 font-mono text-xs text-subtle">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-auto p-2">
              {error && <div className="px-3 py-2 text-sm text-danger">{error}</div>}
              {q.trim() && results.length === 0 && !error && (
                <div className="px-3 py-2 text-sm text-muted">Nada com «{q.trim()}». Criar algo com esse nome?</div>
              )}
              {results.length > 0 && (
                <Command.Group heading="Resultados" className="[&_[cmdk-group-heading]]:type-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-subtle">
                  {results.map((r) => (
                    <Command.Item key={`${r.refType}:${r.refId}`} value={`${r.refType}:${r.refId}`} onSelect={() => openResult(r)} className={itemClass}>
                      {r.refType === 'entity' && r.kind ? (
                        KIND_ICON[r.kind]
                      ) : r.refType === 'event' ? (
                        <CalendarClock />
                      ) : r.refType === 'clue' ? (
                        <FileSearch />
                      ) : r.refType === 'document' ? (
                        <FileText />
                      ) : (
                        <Clapperboard />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.title}</div>
                        <div className="truncate text-xs text-subtle">
                          {r.refType === 'entity' && r.kind
                            ? KIND_LABEL[r.kind].one
                            : { scene: 'Cena', event: 'Evento', clue: 'Pista', document: 'Texto', session: 'Sessão', entity: 'Ficha' }[r.refType]}
                          {r.snippet && (
                            <>
                              {' · '}
                              <Snippet text={r.snippet} />
                            </>
                          )}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading={q.trim() ? 'Criar' : 'Ir para'} className="[&_[cmdk-group-heading]]:type-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-subtle">
                {!q.trim() && (
                  <>
                    <Command.Item value="go:home" onSelect={() => go('/')} className={itemClass}>
                      <Home /> Início
                    </Command.Item>
                    <Command.Item value="go:fichas" onSelect={() => go('/fichas')} className={itemClass}>
                      <Users /> Fichas
                    </Command.Item>
                    <Command.Item value="go:cenas" onSelect={() => go('/cenas')} className={itemClass}>
                      <Clapperboard /> Cenas
                    </Command.Item>
                    <Command.Item value="go:tempo" onSelect={() => go('/linha-do-tempo')} className={itemClass}>
                      <CalendarClock /> Linha do tempo
                    </Command.Item>
                    <Command.Item
                      value="do:exportar"
                      onSelect={() => {
                        onOpenChange(false)
                        openExport()
                      }}
                      className={itemClass}
                    >
                      <FileDown /> Exportar campanha…
                    </Command.Item>
                  </>
                )}
                <Command.Item value="new:npc" onSelect={() => newEntity('personagem')} className={itemClass}>
                  <Plus /> {q.trim() ? `Personagem «${q.trim()}»` : 'Novo personagem'}
                </Command.Item>
                <Command.Item value="new:criatura" onSelect={() => newEntity('criatura')} className={itemClass}>
                  <Plus /> {q.trim() ? `Criatura «${q.trim()}»` : 'Nova criatura'}
                </Command.Item>
                <Command.Item value="new:local" onSelect={() => newEntity('local')} className={itemClass}>
                  <Plus /> {q.trim() ? `Local «${q.trim()}»` : 'Novo local'}
                </Command.Item>
                <Command.Item value="new:cena" onSelect={newScene} className={itemClass}>
                  <Plus /> {q.trim() ? `Cena «${q.trim()}»` : 'Nova cena'}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
