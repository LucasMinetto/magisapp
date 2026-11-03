// "Arranjar": organiza o quadro em camadas da esquerda para a direita, seguindo as ligações.
import ELK from 'elkjs/lib/elk.bundled.js'
import type { Edge } from '@xyflow/react'
import type { FlowNode } from './nodes'

const elk = new ELK()

export async function arrange(nodes: FlowNode[], edges: Edge[]): Promise<FlowNode[]> {
  const graph = await elk.layout({
    id: 'quadro',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.componentComponent': '60'
    },
    children: nodes.map((n) => ({ id: n.id, width: n.measured?.width ?? n.width ?? 220, height: n.measured?.height ?? n.height ?? 80 })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  })
  const pos = new Map(graph.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]))
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
}
