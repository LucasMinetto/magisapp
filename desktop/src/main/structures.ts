// Modelos de estrutura de investigação: um esqueleto de cenas para começar a aventura.
// Os embutidos são texto original, escrito para este app. Os do usuário ficam no settings.json (valem para todas as campanhas).
import type { StructureScene, StructureTemplate } from '../shared/types'
import type { CampaignStore } from './store'

const h = (hours: number) => hours * 60

export const BUILTIN_STRUCTURES: StructureTemplate[] = [
  {
    id: 'investigacao-classica',
    name: 'Investigação clássica',
    description: 'Do chamado ao confronto, com uma virada no meio. Bom para a primeira aventura.',
    builtin: true,
    scenes: [
      { title: 'O chamado', summary: 'Quem chama os agentes, o que já se sabe e o que ninguém quer dizer.', offset: 0 },
      { title: 'A cena do crime', summary: 'O primeiro lugar a examinar. Deixe ao menos três pistas que apontem para a próxima cena.', offset: h(1) },
      { title: 'Testemunhas', summary: 'Quem viu algo, quem mente e quem tem medo. Cada um aponta para um lugar.', offset: h(3) },
      { title: 'A virada', summary: 'Algo piora enquanto investigam: outra vítima, um prazo, a criatura se mostra.', offset: h(6) },
      { title: 'O covil', summary: 'Onde a ameaça está. Como os agentes podem chegar preparados (ou não).', offset: h(9) },
      { title: 'Confronto', summary: 'O que acontece se fugirem, se negociarem, se lutarem.', offset: h(10) },
      { title: 'Rescaldo', summary: 'O relatório para a Ordem, o que ficou em aberto, as marcas na sanidade.', offset: h(12) }
    ]
  },
  {
    id: 'tres-pistas',
    name: 'Três pistas por conclusão',
    description: 'Cada conclusão importante tem três caminhos. Se os jogadores perderem uma pista, ainda têm duas.',
    builtin: true,
    scenes: [
      { title: 'Gancho', summary: 'Aponta para os lugares A, B e C. Não precisa visitar todos.', offset: 0 },
      { title: 'Lugar A', summary: 'Três pistas que levam à conclusão "quem está por trás".', offset: null },
      { title: 'Lugar B', summary: 'Três pistas que levam à conclusão "onde está a ameaça".', offset: null },
      { title: 'Lugar C', summary: 'Três pistas que levam à conclusão "como enfrentar".', offset: null },
      { title: 'Revelação', summary: 'Quando os jogadores juntam as conclusões. Liste aqui as que eles precisam ter.', offset: null },
      { title: 'Confronto final', summary: 'Só faz sentido depois da revelação. O que muda se chegarem sem uma das conclusões.', offset: null }
    ]
  },
  {
    id: 'misterio-em-nos',
    name: 'Mistério em nós',
    description: 'Lugares que apontam uns para os outros, sem ordem fixa. Os jogadores escolhem o caminho.',
    builtin: true,
    scenes: [
      { title: 'Entrada', summary: 'Aponta para pelo menos dois nós.', offset: 0 },
      { title: 'Nó: o lugar público', summary: 'Onde todo mundo pode ir. Aponta para o arquivo e para a casa.', offset: null },
      { title: 'Nó: o arquivo', summary: 'Registros, jornais, fichas antigas. Aponta para a casa e para o subterrâneo.', offset: null },
      { title: 'Nó: a casa', summary: 'Onde alguém esconde algo. Aponta para o lugar público e para o subterrâneo.', offset: null },
      { title: 'Nó: o subterrâneo', summary: 'Só se chega com pistas de dois nós. É onde a verdade está.', offset: null },
      { title: 'Desfecho', summary: 'O que acontece no subterrâneo, e o que acontece se os jogadores demorarem.', offset: null }
    ]
  },
  {
    id: 'contagem-regressiva',
    name: 'Contagem regressiva',
    description: 'Um ritual ou ataque acontece numa hora marcada, chegue quem chegar. Use com a linha do tempo.',
    builtin: true,
    scenes: [
      { title: 'O aviso', summary: 'Os agentes descobrem que há um prazo, mas não qual.', offset: 0 },
      { title: 'Primeiro sinal', summary: 'Algo estranho que só faz sentido depois. Crie um evento na linha do tempo para ele.', offset: h(4) },
      { title: 'O prazo aparece', summary: 'Descobrem a hora. A partir daqui, cada cena custa tempo.', offset: h(10) },
      { title: 'Corrida', summary: 'Três frentes possíveis; não dá para cobrir todas.', offset: h(14) },
      { title: 'A hora marcada', summary: 'O que acontece se chegarem a tempo, e o que acontece se não chegarem.', offset: h(20) }
    ]
  },
  {
    id: 'one-shot-terror',
    name: 'One-shot de terror',
    description: 'Uma noite só, em escalada. Para sessões avulsas ou com Sobreviventes.',
    builtin: true,
    scenes: [
      { title: 'Normalidade', summary: 'Mostre o lugar e as pessoas antes de dar errado.', offset: 0 },
      { title: 'Primeiro sinal', summary: 'Algo que ainda dá para explicar.', offset: h(1) },
      { title: 'Isolamento', summary: 'Sem sinal, sem saída, sem ajuda.', offset: h(2) },
      { title: 'Escalada', summary: 'Alguém some ou morre. A criatura deixa de se esconder.', offset: h(3) },
      { title: 'Revelação', summary: 'O que está acontecendo de verdade.', offset: h(4) },
      { title: 'Fuga ou confronto', summary: 'O amanhecer, se chegarem até ele.', offset: h(5) }
    ]
  }
]

/** Cria as cenas do modelo no fim da lista. Com horas no modelo, contam a partir do relógio do jogo. */
export function applyStructure(store: CampaignStore, template: StructureTemplate): number {
  const now = store.campaign().currentGameMinute
  store.db.transaction(() => {
    for (const s of template.scenes)
      store.saveScene({
        title: s.title,
        summary: s.summary,
        body: null,
        status: 'planejada',
        locationId: null,
        gameMinuteStart: s.offset === null ? null : now + s.offset,
        gameMinuteEnd: null
      })
  })()
  return template.scenes.length
}

/** As cenas atuais viram um modelo: título, resumo e a distância de hora entre elas (não leva o texto). */
export function structureFromCampaign(store: CampaignStore, name: string): StructureTemplate {
  const scenes = store.listScenes()
  const first = scenes.find((s) => s.gameMinuteStart !== null)?.gameMinuteStart ?? null
  const out: StructureScene[] = [...scenes]
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({ title: s.title, summary: s.summaryText, offset: s.gameMinuteStart === null || first === null ? null : s.gameMinuteStart - first }))
  if (!out.length) throw new Error('A campanha não tem cenas para virar modelo.')
  return { id: crypto.randomUUID(), name, description: `${out.length} cenas, salvo de ${store.campaign().name}.`, builtin: false, scenes: out }
}
