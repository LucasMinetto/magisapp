import '@xyflow/react/dist/base.css'
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Viewport
} from '@xyflow/react'
import { Clapperboard, FileSearch, ImagePlus, LayoutGrid, Network, Plus, Redo2, StickyNote, Trash2, Type, Undo2, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import { fold } from '@shared/mentions'
import type { Board, BoardNode, BoardNodeInput, BoardNodeRef, BoardNodeType, BoardSave } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { arrange } from '@/canvas/arrange'
import { activeTheme } from '@/lib/theme'
import { BoardActionsContext, NODE_TYPES, nodeLabel, type FlowNode, type NodeData } from '@/canvas/nodes'
import { KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, cx, Dialog, EmptyState, ErrorNote, SaveIndicator } from '@/ui'

// ------------------------------------------------------------ conversões

const toFlow = (n: BoardNode): FlowNode => {
  const { id, x, y, ...data } = n
  return {
    id,
    type: n.type,
    position: { x, y },
    data,
    width: n.w ?? undefined,
    height: n.h ?? undefined
  }
}

const fromFlow = (n: FlowNode): BoardNodeInput => ({
  id: n.id,
  type: n.data.type,
  entityId: n.data.entityId,
  clueId: n.data.clueId,
  sceneId: n.data.sceneId,
  attachmentId: n.data.attachmentId,
  content: n.data.content,
  color: n.data.color,
  x: Math.round(n.position.x),
  y: Math.round(n.position.y),
  w: n.width ?? null,
  h: n.height ?? null
})

const EDGE_DEFAULTS = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }
}
const toEdge = (e: Board['edges'][number]): Edge => ({
  id: e.id,
  source: e.from,
  target: e.to,
  label: e.label || undefined,
  ...EDGE_DEFAULTS
})
const fromEdge = (e: Edge) => ({
  id: e.id,
  from: e.source,
  to: e.target,
  label: typeof e.label === 'string' ? e.label : ''
})

const isTyping = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')

// ------------------------------------------------------------ escolher ficha, pista ou cena

type PickKind = 'entity' | 'clue' | 'scene'
interface PickOption {
  id: string
  title: string
  hint: string
  ref: BoardNodeRef
}

const PICK_TITLE: Record<PickKind, string> = {
  entity: 'Pôr uma ficha no quadro',
  clue: 'Pôr uma pista no quadro',
  scene: 'Pôr uma cena no quadro'
}

function Picker({
  kind,
  onPick,
  onClose,
  onBoard
}: {
  kind: PickKind | null
  onPick: (kind: PickKind, o: PickOption) => void
  onClose: () => void
  onBoard: Set<string>
}) {
  const campaign = useOpenCampaign()
  const [q, setQ] = useState('')
  const options = useLoad<PickOption[]>(async () => {
    if (kind === 'entity')
      return (await window.api.entities.list({})).map((e) => ({
        id: e.id,
        title: e.name || 'Sem nome',
        hint: `${KIND_LABEL[e.kind].one}${e.isPlayer ? ' · PJ' : ''}${e.role ? ` · ${e.role}` : ''}`,
        ref: {
          title: e.name || 'Sem nome',
          subtitle: e.role,
          kind: e.kind,
          isPlayer: e.isPlayer,
          imageUrl: e.portraitUrl,
          missing: false
        }
      }))
    if (kind === 'clue')
      return (await window.api.clues.list()).map((c) => ({
        id: c.id,
        title: c.title || 'Sem título',
        hint: `Pista · ${c.status}${c.locationName ? ` · ${c.locationName}` : ''}`,
        ref: {
          title: c.title || 'Sem título',
          subtitle: '',
          clueStatus: c.status,
          imageUrl: c.image?.url ?? null,
          missing: false
        }
      }))
    if (kind === 'scene')
      return (await window.api.scenes.list()).map((s) => ({
        id: s.id,
        title: s.title || 'Sem título',
        hint: s.gameMinuteStart === null ? 'Cena sem hora' : `Cena · ${formatGameTime(campaign.epochDate, s.gameMinuteStart)}`,
        ref: {
          title: s.title || 'Sem título',
          subtitle: s.locationName ?? '',
          gameMinute: s.gameMinuteStart,
          missing: false
        }
      }))
    return []
  }, [kind])

  useEffect(() => setQ(''), [kind])
  const needle = fold(q.trim())
  const shown = (options.data ?? []).filter((o) => !needle || fold(`${o.title} ${o.hint}`).includes(needle))

  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()} title={kind ? PICK_TITLE[kind] : ''}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown[0] && kind) onPick(kind, shown[0])
        }}
        aria-label="Filtrar"
        placeholder="Filtrar pelo nome…"
        className="h-9 w-full rounded-md border border-border-input bg-bg px-3 text-sm text-fg focus:border-focus"
      />
      {options.error && <ErrorNote message={options.error} />}
      <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-auto" aria-label="Opções">
        {shown.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => kind && onPick(kind, o)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{o.title}</span>
                <span className="block truncate text-xs text-subtle">{o.hint}</span>
              </span>
              {onBoard.has(o.id) && <span className="text-xs text-subtle">já está no quadro</span>}
            </button>
          </li>
        ))}
        {options.data && shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nada com esse nome.</li>}
      </ul>
    </Dialog>
  )
}

// ------------------------------------------------------------ quadro

interface Snapshot {
  nodes: FlowNode[]
  edges: Edge[]
}

function Flow({ board, onRenamed }: { board: Board; onRenamed: () => void }) {
  const navigate = useNavigate()
  const rf = useReactFlow<FlowNode, Edge>()
  const wrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(board.nodes.map(toFlow))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(board.edges.map(toEdge))
  const [name, setName] = useState(board.name)
  const [viewport, setViewport] = useState<Viewport>(board.viewport)
  const [pick, setPick] = useState<PickKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const undo = useRef<Snapshot[]>([])
  const redo = useRef<Snapshot[]>([])
  const [, setHistoryTick] = useState(0)
  const latest = useRef<Snapshot>({ nodes, edges })
  latest.current = { nodes, edges }

  // ---- salvar: só quando muda algo que vai para o banco (medir o tamanho do nó não conta)
  const payload: BoardSave = useMemo(
    () => ({
      id: board.id,
      name: name.trim() || 'Quadro',
      viewport,
      nodes: nodes.map(fromFlow),
      edges: edges.map(fromEdge)
    }),
    [board.id, name, viewport, nodes, edges]
  )
  const key = JSON.stringify(payload)
  const savedKey = useRef(key)
  const autosave = useAutosave(async (value: BoardSave) => {
    await window.api.boards.save(value)
  })
  useEffect(() => {
    if (key === savedKey.current) return
    savedKey.current = key
    autosave.schedule(payload)
  }, [key, payload, autosave])

  // ---- desfazer / refazer
  const remember = useCallback(() => {
    undo.current.push(structuredClone(latest.current))
    if (undo.current.length > 100) undo.current.shift()
    redo.current = []
    setHistoryTick((t) => t + 1)
  }, [])
  const travel = useCallback(
    (from: RefObject<Snapshot[]>, to: RefObject<Snapshot[]>) => {
      const snap = from.current.pop()
      if (!snap) return
      to.current.push(structuredClone(latest.current))
      setNodes(snap.nodes)
      setEdges(snap.edges)
      setHistoryTick((t) => t + 1)
    },
    [setNodes, setEdges]
  )
  const doUndo = useCallback(() => travel(undo, redo), [travel])
  const doRedo = useCallback(() => travel(redo, undo), [travel])

  // Na janela toda: clicar no fundo do quadro não dá foco a nada, e o atalho tem de valer mesmo assim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || !(e.ctrlKey || e.metaKey) || document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        doUndo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        doRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  // ---- adicionar
  const center = () => {
    const r = wrapper.current?.getBoundingClientRect()
    const p = rf.screenToFlowPosition({
      x: (r?.left ?? 0) + (r?.width ?? 800) / 2,
      y: (r?.top ?? 0) + (r?.height ?? 600) / 2
    })
    const jitter = (latest.current.nodes.length % 5) * 24
    return { x: p.x - 110 + jitter, y: p.y - 40 + jitter }
  }
  const add = (type: BoardNodeType, extra: Partial<BoardNode> = {}, at = center()) => {
    remember()
    const node: BoardNode = {
      id: crypto.randomUUID(),
      type,
      entityId: null,
      clueId: null,
      sceneId: null,
      attachmentId: null,
      content: '',
      color: null,
      ...at,
      w: null,
      h: null,
      ref: null,
      ...extra
    }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...toFlow(node), selected: true }])
  }
  const picked = (kind: PickKind, o: PickOption) => {
    setPick(null)
    add(kind, { [`${kind}Id`]: o.id, ref: o.ref })
  }
  const addImage = async (at?: { x: number; y: number }, path?: string) => {
    try {
      const a = path ? await window.api.attachments.importPath(path) : await window.api.attachments.pickImage()
      if (a)
        add(
          'image',
          {
            attachmentId: a.id,
            w: 240,
            ref: {
              title: a.fileName,
              subtitle: '',
              imageUrl: a.url,
              missing: false
            }
          },
          at
        )
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const onDrop = (e: DragEvent) => {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    e.preventDefault()
    void addImage(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), window.api.pathForFile(file))
  }

  const tidy = async () => {
    if (!latest.current.nodes.length) return
    remember()
    setNodes(await arrange(latest.current.nodes, latest.current.edges))
    requestAnimationFrame(() => void rf.fitView({ padding: 0.15, duration: 250 }))
  }

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return
      remember()
      setEdges((es) => addEdge({ ...c, id: crypto.randomUUID(), ...EDGE_DEFAULTS }, es))
    },
    [remember, setEdges]
  )

  const actions = useMemo(
    () => ({
      remember,
      setContent: (id: string, content: string) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, content } } : n))),
      open: (d: NodeData) => {
        if (d.type === 'entity' && d.entityId) navigate(`/ficha/${d.entityId}`)
        if (d.type === 'clue' && d.clueId) navigate(`/pistas?pista=${d.clueId}`)
        if (d.type === 'scene' && d.sceneId) navigate(`/cenas/${d.sceneId}`)
      }
    }),
    [remember, setNodes, navigate]
  )

  const selectedEdges = edges.filter((e) => e.selected)
  const editEdge = selectedEdges.length === 1 ? selectedEdges[0] : null
  const onBoard = useMemo(() => new Set(nodes.flatMap((n) => [n.data.entityId, n.data.clueId, n.data.sceneId].filter((x): x is string => !!x))), [nodes])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const fresh = board.viewport.x === 0 && board.viewport.y === 0 && board.viewport.zoom === 1

  return (
    <BoardActionsContext.Provider value={actions}>
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5">
          <label className="sr-only" htmlFor="board-name">
            Nome do quadro
          </label>
          <input
            id="board-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void autosave.flush().then(onRenamed)}
            className="h-8 w-48 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold hover:border-border focus:border-focus"
          />
          <SaveIndicator state={autosave.state} error={autosave.error} />
          <div role="toolbar" aria-label="Pôr no quadro" className="ml-auto flex flex-wrap items-center gap-0.5">
            <Button size="sm" variant="ghost" icon={<StickyNote className="size-4" />} onClick={() => add('card')}>
              Card
            </Button>
            <Button size="sm" variant="ghost" icon={<Type className="size-4" />} onClick={() => add('text')}>
              Texto
            </Button>
            <Button size="sm" variant="ghost" icon={<User className="size-4" />} onClick={() => setPick('entity')}>
              Ficha
            </Button>
            <Button size="sm" variant="ghost" icon={<FileSearch className="size-4" />} onClick={() => setPick('clue')}>
              Pista
            </Button>
            <Button size="sm" variant="ghost" icon={<Clapperboard className="size-4" />} onClick={() => setPick('scene')}>
              Cena
            </Button>
            <Button size="sm" variant="ghost" icon={<ImagePlus className="size-4" />} onClick={() => void addImage()}>
              Imagem
            </Button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <Button size="sm" variant="ghost" icon={<LayoutGrid className="size-4" />} onClick={() => void tidy()} title="Organiza seguindo as ligações">
              Arranjar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Undo2 className="size-4" />}
              onClick={doUndo}
              disabled={!undo.current.length}
              aria-label="Desfazer"
              title="Desfazer (Ctrl+Z)"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Redo2 className="size-4" />}
              onClick={doRedo}
              disabled={!redo.current.length}
              aria-label="Refazer"
              title="Refazer (Ctrl+Y)"
            />
          </div>
        </header>
        <div ref={wrapper} className="relative min-h-0 flex-1" onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={onDrop}>
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={remember}
            onBeforeDelete={async () => (remember(), true)}
            onMoveEnd={(_, v) =>
              setViewport({
                x: Math.round(v.x),
                y: Math.round(v.y),
                zoom: Math.round(v.zoom * 1000) / 1000
              })
            }
            onNodeDoubleClick={(_, n) => actions.open(n.data)}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={['Delete', 'Backspace']}
            defaultViewport={board.viewport}
            fitView={fresh && board.nodes.length > 0}
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2.5}
            colorMode={activeTheme()}
            proOptions={{ hideAttribution: true }}
            aria-label={`Quadro ${name}`}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls showInteractive={false} position="bottom-left" aria-label="Zoom" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              ariaLabel="Mini-mapa do quadro"
              nodeColor="var(--color-border)"
              nodeStrokeColor="var(--color-border-input)"
            />

            {editEdge && (
              <Panel position="bottom-center" className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-pop">
                <label htmlFor="edge-label" className="type-label text-muted">
                  Rótulo da ligação
                </label>
                <input
                  id="edge-label"
                  value={typeof editEdge.label === 'string' ? editEdge.label : ''}
                  maxLength={200}
                  placeholder="ex.: suspeito, mentiu sobre"
                  onFocus={remember}
                  onChange={(e) => setEdges((es) => es.map((x) => (x.id === editEdge.id ? { ...x, label: e.target.value || undefined } : x)))}
                  className="h-7 w-56 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
                />
              </Panel>
            )}

            {nodes.length === 0 && (
              <Panel position="top-center" className="pointer-events-none mt-24">
                <Card className="pointer-events-auto max-w-sm">
                  <EmptyState
                    icon={<Network />}
                    title="Quadro vazio"
                    text="Ponha fichas, pistas e cenas, ligue arrastando de uma bolinha para outra, ou solte imagens aqui."
                    action={
                      <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => add('card')}>
                        Primeiro card
                      </Button>
                    }
                  />
                </Card>
              </Panel>
            )}
          </ReactFlow>

          {error && (
            <div className="absolute top-16 left-3 max-w-md">
              <ErrorNote message={error} />
            </div>
          )}

          <section className="sr-only" aria-label="Conteúdo do quadro em lista">
            <h2>Itens</h2>
            <ul>
              {nodes.map((n) => (
                <li key={n.id}>{nodeLabel(n.data)}</li>
              ))}
            </ul>
            <h2>Ligações</h2>
            <ul>
              {edges.map((e) => {
                const a = byId.get(e.source)
                const b = byId.get(e.target)
                return (
                  <li key={e.id}>
                    {a ? nodeLabel(a.data) : '?'} → {b ? nodeLabel(b.data) : '?'}
                    {typeof e.label === 'string' && e.label ? ` (${e.label})` : ''}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
      <Picker kind={pick} onPick={picked} onClose={() => setPick(null)} onBoard={onBoard} />
    </BoardActionsContext.Provider>
  )
}

function BoardEditor({ id, onRenamed }: { id: string; onRenamed: () => void }) {
  const board = useLoad(() => window.api.boards.get(id), [id])
  if (board.error)
    return (
      <div className="p-6">
        <ErrorNote message={board.error} onRetry={board.reload} />
      </div>
    )
  if (!board.data) return null
  return (
    <ReactFlowProvider>
      <Flow board={board.data} onRenamed={onRenamed} />
    </ReactFlowProvider>
  )
}

// ------------------------------------------------------------ tela

export function Boards() {
  const { id } = useParams()
  const { version, changed } = useCampaign()
  const navigate = useNavigate()
  const list = useLoad(() => window.api.boards.list(), [version])
  const [confirm, setConfirm] = useState(false)

  const create = async () => {
    const b = await window.api.boards.create(`Quadro ${(list.data?.length ?? 0) + 1}`)
    changed()
    navigate(`/quadros/${b.id}`)
  }
  const trash = async () => {
    if (!id) return
    await window.api.boards.trash(id)
    setConfirm(false)
    changed()
    navigate('/quadros')
  }

  if (!id && list.data?.[0]) return <Navigate to={`/quadros/${list.data[0].id}`} replace />
  const current = list.data?.find((b) => b.id === id)

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label="Quadros" className="flex w-(--layout-list-panel) shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="type-label text-muted">Quadros</h1>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={create} aria-label="Novo quadro">
            Novo
          </Button>
        </div>
        {list.error && (
          <div className="px-3">
            <ErrorNote message={list.error} onRetry={list.reload} />
          </div>
        )}
        <ul className="flex-1 overflow-auto px-2 pb-3">
          {list.data?.map((b) => (
            <li key={b.id}>
              <Link
                to={`/quadros/${b.id}`}
                aria-current={b.id === id ? 'page' : undefined}
                className={cx('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', b.id === id ? 'bg-surface-raised' : 'hover:bg-surface')}
              >
                <Network className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="font-mono text-xs text-subtle" title="Itens no quadro">
                  {b.nodeCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {current && (
          <div className="border-t border-border p-2">
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)} className="w-full justify-start">
              Mover para a lixeira
            </Button>
          </div>
        )}
      </aside>

      {id ? (
        <BoardEditor key={id} id={id} onRenamed={changed} />
      ) : (
        list.data && (
          <section className="flex-1 px-6 py-5">
            <Card>
              <EmptyState
                icon={<Network />}
                title="Nenhum quadro ainda"
                text="Um quadro é o mapa mental da aventura: quem sabe o quê, onde está cada pista, o que leva a quê."
                action={
                  <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
                    Criar o primeiro quadro
                  </Button>
                }
              />
            </Card>
          </section>
        )
      )}

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Mover o quadro para a lixeira?"
        description="As fichas, pistas e cenas continuam na campanha; só o quadro sai."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={trash}>
              Mover para a lixeira
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{current?.name}</p>
      </Dialog>
    </div>
  )
}
