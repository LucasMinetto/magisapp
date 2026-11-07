// Esquemas da ficha completa, da ameaça, de itens, rituais e rolagens, em zod 4. O nome e o retrato ficam na ficha do app
// (entities.name, portrait_id); aqui só o que é de Ordem Paranormal.
import { z } from 'zod'
import { PATENTES } from './regras'

export const ELEMENTOS = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'] as const
export const TIPOS_ACAO = ['Padrão', 'Movimento', 'Reação', 'Livre', 'Completa'] as const
export const TIPOS_ITEM = ['Arma', 'Proteção', 'Equipamento', 'Munição', 'Amaldiçoado'] as const
export const TIPOS_ROLAGEM = ['teste', 'ataque', 'dano', 'ritual', 'livre'] as const

const texto = z.string().max(20_000).default('')
const numero = z.coerce.number().default(0)
const idLocal = z.string().min(1).max(64)
const lista = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(300).default([])

/** De onde veio uma cópia da biblioteca. A campanha guarda isto e não depende mais da biblioteca. */
export const origemSchema = z.object({
  libraryId: z.string().max(64),
  sourceId: z.string().max(64),
  sourceName: z.string().max(200)
})

export const ataqueSchema = z.object({
  id: idLocal,
  nome: texto,
  pericia: z.string().max(60).default('Luta'),
  bonusAtaque: numero,
  dano: texto, // "1d8+2"
  tipoDano: texto,
  // Outros tipos de dano do mesmo golpe (ex.: arma amaldiçoada: +2d6 de Energia). Não multiplicam no crítico.
  danosExtras: z.array(z.object({ dano: texto, tipoDano: texto })).max(6).default([]),
  // Arma de arremesso: ataca com Pontaria, mas soma a Força no dano como as corpo a corpo (livro, p. 82).
  arremesso: z.boolean().default(false),
  margemCritico: z.coerce.number().int().min(2).max(20).default(20),
  multCritico: z.coerce.number().int().min(2).max(5).default(2),
  alcance: texto,
  notas: texto
})

const camposRitual = {
  nome: texto,
  elemento: texto,
  circulo: z.coerce.number().int().min(1).max(4).default(1),
  execucao: texto,
  alcance: texto,
  alvo: texto,
  duracao: texto,
  resistencia: texto,
  efeito: texto,
  discente: texto,
  verdadeiro: texto,
  danoNormal: texto,
  danoDiscente: texto,
  danoVerdadeiro: texto,
  tipoDano: texto
}

export const ritualDaFichaSchema = z.object({ id: idLocal, ...camposRitual, origem: origemSchema.optional() })

export const habilidadeSchema = z.object({
  id: idLocal,
  nome: texto,
  fonte: texto, // classe, trilha, origem, poder paranormal…
  custo: texto,
  descricao: texto
})

const camposItem = {
  nome: texto,
  tipo: z.string().max(60).default('Equipamento'),
  categoria: z.coerce.number().int().min(0).max(4).default(0),
  espacos: z.coerce.number().default(1),
  defesa: numero,
  // Armas: dano "1d8", crítico "19/x3", alcance "curto", tipo de dano, proficiência e empunhadura.
  dano: texto,
  tipoDano: texto,
  critico: texto,
  alcance: texto,
  proficiencia: texto,
  empunhadura: texto,
  // Itens amaldiçoados.
  elemento: texto,
  descricao: texto
}

export const itemSchema = z.object({
  id: idLocal,
  ...camposItem,
  quantidade: z.coerce.number().int().min(0).default(1),
  equipado: z.boolean().default(false),
  origem: origemSchema.optional()
})

const atributosSchema = z.object({ agi: numero, for: numero, int: numero, pre: numero, vig: numero })

/** Ficha completa: agentes (personagens dos jogadores) e NPCs vilões. */
export const fichaAgenteSchema = z.object({
  jogador: texto,
  origem: texto,
  classe: texto,
  trilha: texto,
  nex: z.coerce.number().min(0).max(100).default(5),
  // Só do sobrevivente (Sobrevivendo ao Horror): sobe um estágio por missão, de 1 a 5.
  estagio: z.coerce.number().int().min(1).max(5).default(1),
  prestigio: numero,
  atributos: atributosSchema.default({ agi: 1, for: 1, int: 1, pre: 1, vig: 1 }),
  pericias: z.record(z.string().max(60), z.object({ treino: numero, extra: numero })).default({}),
  bonus: z
    .object({ pv: numero, pe: numero, san: numero, defesaEquip: numero, defesaOutros: numero, deslocamento: numero })
    .default({ pv: 0, pe: 0, san: 0, defesaEquip: 0, defesaOutros: 0, deslocamento: 0 }),
  // Máximos manuais: só usados quando a classe não tem tabela (ex.: Sobrevivente).
  pvMax: numero,
  peMax: numero,
  sanMax: numero,
  defesa: numero,
  pvAtual: numero,
  peAtual: numero,
  sanAtual: numero,
  pvTemp: numero,
  peTemp: numero,
  sanTemp: numero,
  condicoes: z.array(z.string().max(60)).max(60).default([]),
  // Como a janela de rolagem abre: digitar os dados físicos ou o app rolar. Sem o campo, vale "é jogador".
  dadosFisicos: z.boolean().optional(),
  ataques: lista(ataqueSchema),
  rituais: lista(ritualDaFichaSchema),
  habilidades: lista(habilidadeSchema),
  inventario: lista(itemSchema),
  investigacao: z
    .object({ aparencia: texto, personalidade: texto, historico: texto, objetivo: texto, anotacoes: texto })
    .default({ aparencia: '', personalidade: '', historico: '', objetivo: '', anotacoes: '' })
})

export const acaoSchema = z.object({ tipo: texto, nome: texto, descricao: texto })

/** Bloco de estatísticas de uma ameaça, como no livro de regras. */
export const blocoAmeacaSchema = z.object({
  elemento: texto,
  tipo: texto, // Criatura, Pessoa...
  tamanho: texto,
  vd: numero,
  presencaDt: numero,
  presencaDano: texto,
  presencaNexImune: texto,
  percepcao: texto,
  iniciativa: texto,
  sentidos: texto,
  defesa: numero,
  fortitude: texto,
  reflexos: texto,
  vontade: texto,
  pv: numero,
  pvMachucado: numero,
  resistencias: texto,
  vulnerabilidades: texto,
  imunidades: texto,
  agi: numero,
  for: numero,
  int: numero,
  pre: numero,
  vig: numero,
  pericias: texto,
  deslocamento: texto,
  habilidades: lista(acaoSchema),
  acoes: lista(acaoSchema),
  enigma: texto,
  descricao: texto
})

// Registros da biblioteca: o nome é obrigatório (é o que aparece na lista).
const nomeObrigatorio = z.string().trim().min(1).max(200)
// Página do livro de origem (0 = sem página). Fica só na biblioteca: não vai para a cópia da campanha.
const pagina = z.coerce.number().int().min(0).max(2000).default(0)
// token: a imagem principal (vira o retrato da ficha quando a ameaça vem para a campanha); tokensExtras: variantes
// (ex.: os estágios do Anfitrião). Os dos livros vêm com o app (resources/livros-tokens); os do mestre ficam em biblioteca-tokens/.
const nomeToken = z.string().max(40)
export const ameacaBibliotecaSchema = blocoAmeacaSchema.extend({
  nome: nomeObrigatorio,
  pagina,
  token: nomeToken.default(''),
  tokensExtras: z.array(nomeToken).max(30).default([])
})
export const itemBibliotecaSchema = z.object({ ...camposItem, nome: nomeObrigatorio, pagina })
// No livro cada ritual tem um destes: Alvo (seres/objetos), Área (cone, esfera…) ou Efeito (cria algo).
export const ritualBibliotecaSchema = z.object({ ...camposRitual, nome: nomeObrigatorio, alvoTipo: z.enum(['Alvo', 'Área', 'Efeito']).default('Alvo'), pagina })

/** Rolagem com dados físicos: o mestre digitou os valores, o app calculou. */
export const rolagemSchema = z.object({
  entityId: z.string().uuid().nullable().default(null),
  sessionId: z.string().uuid().nullable().default(null),
  quem: z.string().max(200).default(''),
  rotulo: z.string().max(200).default(''),
  tipo: z.enum(TIPOS_ROLAGEM).default('livre'),
  formula: z.string().max(200).default(''), // "3d20+10" ou "2d8+2"
  dados: z.array(z.number().int().min(1).max(1000)).max(200).default([]),
  total: z.number().int().min(-10_000).max(100_000),
  critico: z.boolean().default(false),
  detalhe: z.string().max(2_000).default('')
})

/** Ordem de iniciativa da sessão de jogo (tela de Sessão). */
export const iniciativaSchema = z.object({
  rodada: z.coerce.number().int().min(1).default(1),
  turno: z.coerce.number().int().min(0).default(0),
  ordem: z
    .array(
      z.object({
        id: idLocal,
        entityId: z.string().uuid().nullable().default(null),
        nome: z.string().max(200),
        valor: numero,
        // PV de cada ameaça no combate (dois zumbis da mesma ficha têm PV separados). Agentes usam o PV da ficha: null.
        pv: z.object({ atual: z.coerce.number().int().min(-1000).max(100_000), max: z.coerce.number().int().min(0).max(100_000) }).nullable().default(null),
        // Condições do combate (agarrado, desprevenido…). Agente com ficha completa usa as da ficha.
        condicoes: z.array(z.string().max(60)).max(40).default([])
      })
    )
    .max(100)
    .default([]),
  // Fichas tiradas da área fixa do combate (#18), pela chave do grupo (a ficha, ou o combatente sem ficha).
  // Guardar as desafixadas faz toda ameaça nova (e combate salvo antes) nascer fixa.
  desafixadas: z.array(z.string().max(60)).max(100).default([])
})

export type FichaAgente = z.infer<typeof fichaAgenteSchema>
export type BlocoAmeaca = z.infer<typeof blocoAmeacaSchema>
export type Ataque = z.infer<typeof ataqueSchema>
export type RitualDaFicha = z.infer<typeof ritualDaFichaSchema>
export type Habilidade = z.infer<typeof habilidadeSchema>
export type Item = z.infer<typeof itemSchema>
export type Acao = z.infer<typeof acaoSchema>
export type Origem = z.infer<typeof origemSchema>
export type AmeacaBiblioteca = z.infer<typeof ameacaBibliotecaSchema>
export type ItemBiblioteca = z.infer<typeof itemBibliotecaSchema>
export type RitualBiblioteca = z.infer<typeof ritualBibliotecaSchema>
export type RolagemInput = z.input<typeof rolagemSchema>
export type Iniciativa = z.infer<typeof iniciativaSchema>

// --- Da ficha compacta (campos do modelo Ordem em `stats`) para a completa, sem perder nada. ---

type Stat = number | string | string[] | { current: number; max: number } | undefined

const num = (v: Stat): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
const str = (v: Stat): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : Array.isArray(v) ? v.join(', ') : '')
const recurso = (v: Stat) => (v && typeof v === 'object' && !Array.isArray(v) ? v : { current: num(v), max: num(v) })

/**
 * Monta a ficha completa a partir da compacta. Listas viram habilidades, rituais e itens com o texto que já havia.
 * Sempre dá o mesmo resultado para os mesmos campos (ids fixos): o app reconhece quando a tela só devolveu o que recebeu.
 */
export function fichaDeStats(stats: Record<string, Stat>): FichaAgente {
  const pv = recurso(stats.pv)
  const pe = recurso(stats.pe)
  const san = recurso(stats.san)
  const patente = PATENTES.find((p) => p.nome === stats.patente)
  const nomes = (v: Stat) => (Array.isArray(v) ? v : str(v) ? [str(v)] : []).filter((s) => s.trim())
  return fichaAgenteSchema.parse({
    origem: str(stats.origem),
    classe: str(stats.classe),
    trilha: str(stats.trilha),
    nex: stats.nex === undefined ? undefined : Math.min(100, Math.max(0, num(stats.nex))),
    prestigio: patente?.prestigio ?? 0,
    // Sem nenhum atributo preenchido, fica o padrão do livro (1 em cada).
    atributos: ['agi', 'for', 'int', 'pre', 'vig'].some((k) => stats[k] !== undefined && stats[k] !== '')
      ? { agi: num(stats.agi), for: num(stats.for), int: num(stats.int), pre: num(stats.pre), vig: num(stats.vig) }
      : undefined,
    // A classe com tabela recalcula os máximos; os manuais ficam para Sobrevivente e Mundano.
    pvMax: pv.max,
    peMax: pe.max,
    sanMax: san.max,
    pvAtual: pv.current,
    peAtual: pe.current,
    sanAtual: san.current,
    defesa: num(stats.defesa),
    habilidades: nomes(stats.pericias).map((nome, i) => ({ id: `compacta-pericia-${i}`, nome, fonte: 'Perícias da ficha compacta' })),
    rituais: nomes(stats.rituais).map((nome, i) => ({ id: `compacta-ritual-${i}`, nome })),
    inventario: nomes(stats.inventario).map((nome, i) => ({ id: `compacta-item-${i}`, nome }))
  })
}

/** Bloco de ameaça a partir dos campos do modelo de criatura que a ficha antiga já tinha. */
export function ameacaDeStats(stats: Record<string, Stat>): BlocoAmeaca {
  const acoes = Array.isArray(stats.acoes) ? stats.acoes : []
  return blocoAmeacaSchema.parse({
    elemento: str(stats.elemento),
    tamanho: str(stats.tamanho),
    vd: num(stats.vd),
    presencaDano: str(stats.presenca),
    percepcao: str(stats.percepcao),
    iniciativa: str(stats.iniciativa),
    defesa: num(stats.defesa),
    fortitude: str(stats.fortitude),
    reflexos: str(stats.reflexos),
    vontade: str(stats.vontade),
    pv: recurso(stats.pv).max,
    resistencias: str(stats.resistencias),
    vulnerabilidades: str(stats.vulnerabilidades),
    imunidades: str(stats.imunidades),
    agi: num(stats.agi),
    for: num(stats.for),
    int: num(stats.int),
    pre: num(stats.pre),
    vig: num(stats.vig),
    deslocamento: str(stats.deslocamento),
    acoes: acoes.map((nome) => ({ nome }))
  })
}
