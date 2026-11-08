// Os nós do quadro. Cada um é um componente do React Flow; o que muda o quadro vem do BoardActions.
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { Clapperboard, ExternalLink, FileQuestion, MapPin } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'
import { formatGameTime } from '@shared/gameTime'
import type { BoardNode } from '@shared/types'
import { useOpenCampaign } from '@/campaign'
import { KIND_LABEL } from '@/lib/actions'
import { Chip, cx, Portrait } from '@/ui'

export type NodeData = Omit<BoardNode, 'id' | 'x' | 'y'> & Record<string, unknown>
export type FlowNode = Node<NodeData>

interface BoardActions {
  /** Antes de mudar algo: guarda o estado para o Desfazer. */
  remember: () => void
  setContent: (id: string, content: string) => void
  open: (node: NodeData) => void
}

export const BoardActionsContext = createContext<BoardActions | null>(null)
const useActions = () => {
  const ctx = useContext(BoardActionsContext)
  if (!ctx) throw new Error('nó fora do quadro')
  return ctx
}

const CLUE_STATUS = { oculta: ['Oculta', 'hidden'], achada: ['Achada', 'found'], entendida: ['Entendida', 'understood'] } as const

/** Duas alças: sai pela direita, entra pela esquerda. Com ConnectionMode.Loose qualquer uma liga. */
function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}

function Frame({ selected, missing, className, children }: { selected: boolean; missing?: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-lg border bg-surface-raised shadow-pop transition-colors',
        selected ? 'border-accent' : missing ? 'border-dashed border-border-input' : 'border-border',
        missing && 'opacity-70',
        className
      )}
    >
      {children}
    </div>
  )
}

function OpenButton({ data, label }: { data: NodeData; label: string }) {
  const { open } = useActions()
  if (data.ref?.missing) return <span className="text-xs text-subtle">na lixeira</span>
  return (
    <button
      type="button"
      onClick={() => open(data)}
      aria-label={label}
      title={label}
      className="nodrag grid size-6 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface hover:text-fg"
    >
      <ExternalLink className="size-3.5" aria-hidden />
    </button>
  )
}

function EntityNode({ data, selected }: NodeProps<FlowNode>) {
  const ref = data.ref!
  return (
    <Frame selected={selected} missing={ref.missing} className="flex w-56 items-center gap-3 p-3">
      <Handles />
      <Portrait name={ref.title} src={ref.missing ? null : ref.imageUrl} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{ref.title}</div>
        <div className="truncate text-xs text-muted">
          {ref.kind ? KIND_LABEL[ref.kind].one : 'Ficha'}
          {ref.isPlayer && ' · PJ'}
          {ref.subtitle && ` · ${ref.subtitle}`}
        </div>
      </div>
      <OpenButton data={data} label={`Abrir a ficha ${ref.title}`} />
    </Frame>
  )
}

function ClueNode({ data, selected }: NodeProps<FlowNode>) {
  const ref = data.ref!
  const [label, tone] = CLUE_STATUS[ref.clueStatus ?? 'oculta']
  return (
    <Frame selected={selected} missing={ref.missing} className="w-52 overflow-hidden">
      <Handles />
      <div className="grid aspect-video place-items-center border-b border-border bg-bg">
        {ref.imageUrl ? (
          <img src={ref.imageUrl} alt={ref.title} className="size-full object-cover" draggable={false} />
        ) : (
          <FileQuestion className="size-6 text-subtle" aria-hidden />
        )}
      </div>
      <div className="flex items-center gap-2 p-2.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ref.title}</span>
        <Chip tone={tone}>{label}</Chip>
        <OpenButton data={data} label={`Abrir a pista ${ref.title}`} />
      </div>
    </Frame>
  )
}

function SceneNode({ data, selected }: NodeProps<FlowNode>) {
  const campaign = useOpenCampaign()
  const ref = data.ref!
  return (
    <Frame selected={selected} missing={ref.missing} className="w-56 p-3">
      <Handles />
      <div className="flex items-center gap-2">
        <Clapperboard className="size-4 shrink-0 text-muted" aria-label="Cena" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ref.title}</span>
        <OpenButton data={data} label={`Abrir a cena ${ref.title}`} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        <span className="font-mono">{ref.gameMinute == null ? 'sem hora' : formatGameTime(campaign.epochDate, ref.gameMinute)}</span>
        {ref.subtitle && (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {ref.subtitle}
          </span>
        )}
      </div>
    </Frame>
  )
}

function TextBox({ id, data, placeholder, className }: { id: string; data: NodeData; placeholder: string; className: string }) {
  const { remember, setContent } = useActions()
  return (
    <textarea
      aria-label={placeholder}
      value={data.content}
      placeholder={placeholder}
      onFocus={remember}
      onChange={(e) => setContent(id, e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
      maxLength={20_000}
      className={cx('nodrag nowheel field-sizing-content w-full resize-none bg-transparent outline-none placeholder:text-subtle', className)}
    />
  )
}

function CardNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <Frame selected={selected} className="h-full min-h-16 w-full min-w-48 p-3">
      <NodeResizer isVisible={selected} minWidth={160} minHeight={60} lineClassName="border-accent!" handleClassName="bg-accent! border-0!" />
      <Handles />
      <TextBox id={id} data={data} placeholder="Escreva no card" className="min-h-10 text-sm leading-relaxed" />
    </Frame>
  )
}

function TextNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <div className={cx('min-w-40 rounded-md px-1', selected && 'outline-1 outline-accent')}>
      <Handles />
      <TextBox id={id} data={data} placeholder="Texto solto" className="type-lg font-serif" />
    </div>
  )
}

function ImageNode({ data, selected }: NodeProps<FlowNode>) {
  const ref = data.ref!
  return (
    <div className={cx('h-full w-full min-w-24 overflow-hidden rounded-md border', selected ? 'border-accent' : 'border-border')}>
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={80} minHeight={60} lineClassName="border-accent!" handleClassName="bg-accent! border-0!" />
      <Handles />
      {ref.imageUrl && !ref.missing ? (
        <img src={ref.imageUrl} alt={ref.title} className="block size-full object-contain" draggable={false} />
      ) : (
        <div className="grid size-full min-h-24 place-items-center bg-bg text-xs text-subtle">imagem na lixeira</div>
      )}
    </div>
  )
}

export const NODE_TYPES = {
  entity: EntityNode,
  clue: ClueNode,
  scene: SceneNode,
  card: CardNode,
  text: TextNode,
  image: ImageNode
}

/** Nome de um nó para a lista acessível e para o rótulo das ligações. */
export function nodeLabel(data: NodeData): string {
  if (data.type === 'card') return `Card: ${data.content.split('\n')[0] || 'vazio'}`
  if (data.type === 'text') return `Texto: ${data.content.split('\n')[0] || 'vazio'}`
  const kind = { entity: 'Ficha', clue: 'Pista', scene: 'Cena', image: 'Imagem' }[data.type]
  return `${kind}: ${data.ref?.title ?? ''}${data.ref?.missing ? ' (na lixeira)' : ''}`
}
