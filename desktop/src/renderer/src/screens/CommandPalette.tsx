import * as RadixDialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { BookMarked, CalendarClock, Clapperboard, FileDown, FileSearch, FileText, Home, MapPin, Package, Plus, Scale, Search, SearchCheck, Skull, Sparkles, User, Users } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useCampaign } from '@/campaign'
import { createEntity, createScene, KIND_LABEL } from '@/lib/actions'
import { useExportDialog } from './ExportDialog'
import { buscar, carregarRegras, type Achado } from '@/regras/dados'
import type { EntityKind, LibraryEntry, LibraryKind, SearchResult } from '@shared/types'

const LIB_ICON: Record<LibraryKind, ReactNode> = { ameaca: <Skull />, ritual: <Sparkles />, item: <Package /> }
const LIB_LABEL: Record<LibraryKind, string> = { ameaca: 'Ameaça', ritual: 'Ritual', item: 'Item' }

const KIND_ICON: Record<EntityKind, ReactNode> = {
  personagem: <User />,
  ameaca: <Skull />,
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
  const [regras, setRegras] = useState<Achado[]>([])
  const [biblioteca, setBiblioteca] = useState<LibraryEntry[]>([])

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

  // Regras dos livros e Biblioteca: também respondem ao Ctrl+K.
  useEffect(() => {
    if (q.trim().length < 2) {
      setRegras([])
      setBiblioteca([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      carregarRegras()
        .then((ss) => alive && setRegras(buscar(ss, q, 6)))
        .catch(() => alive && setRegras([]))
      Promise.all((['ameaca', 'ritual', 'item'] as const).map((kind) => window.api.library.list({ kind, q })))
        .then((ls) => alive && setBiblioteca(ls.flatMap((l) => (l as LibraryEntry[]).slice(0, 4))))
        .catch(() => alive && setBiblioteca([]))
    }, 120)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

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
              {q.trim() && results.length === 0 && regras.length === 0 && biblioteca.length === 0 && !error && (
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
              {biblioteca.length > 0 && (
                <Command.Group heading="Biblioteca" className="[&_[cmdk-group-heading]]:type-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-subtle">
                  {biblioteca.map((e) => (
                    <Command.Item key={`lib:${e.kind}:${e.id}`} value={`lib:${e.kind}:${e.id}`} onSelect={() => go(`/biblioteca/${e.kind}/${e.id}`)} className={itemClass}>
                      {LIB_ICON[e.kind]}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{e.name}</div>
                        <div className="truncate text-xs text-subtle">
                          {LIB_LABEL[e.kind]} · {e.sourceName}
                          {e.data.pagina > 0 && `, p. ${e.data.pagina}`}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {regras.length > 0 && (
                <Command.Group heading="Regras" className="[&_[cmdk-group-heading]]:type-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-subtle">
                  {regras.map((a, i) => (
                    <Command.Item
                      key={`regra:${i}`}
                      value={`regra:${i}`}
                      onSelect={() => go(`/regras/${a.secao.id}?q=${encodeURIComponent(q.trim())}${a.ancora ? `#${a.ancora}` : ''}`)}
                      className={itemClass}
                    >
                      <Scale />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{a.rotulo}</div>
                        <div className="truncate text-xs text-subtle">
                          p. {a.pagina} · <Snippet text={a.trecho} />
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
                    <Command.Item value="go:biblioteca" onSelect={() => go('/biblioteca')} className={itemClass}>
                      <BookMarked /> Biblioteca
                    </Command.Item>
                    <Command.Item value="go:regras" onSelect={() => go('/regras')} className={itemClass}>
                      <Scale /> Regras
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
                <Command.Item value="new:ameaca" onSelect={() => newEntity('ameaca')} className={itemClass}>
                  <Plus /> {q.trim() ? `Ameaça «${q.trim()}»` : 'Nova ameaça'}
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
