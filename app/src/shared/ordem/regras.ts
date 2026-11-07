// Regras de Ordem Paranormal usadas pela ficha (conferidas no livro de regras).
// Funções puras. Rodam na tela e no processo principal.

export type Atributo = 'agi' | 'for' | 'int' | 'pre' | 'vig'
export type Atributos = Record<Atributo, number>

export const ATRIBUTOS: { id: Atributo; sigla: string; nome: string }[] = [
  { id: 'agi', sigla: 'AGI', nome: 'Agilidade' },
  { id: 'for', sigla: 'FOR', nome: 'Força' },
  { id: 'int', sigla: 'INT', nome: 'Intelecto' },
  { id: 'pre', sigla: 'PRE', nome: 'Presença' },
  { id: 'vig', sigla: 'VIG', nome: 'Vigor' },
]

// Tabelas 1.3 a 1.5: características das classes.
export const CLASSES = {
  Combatente: { pv: 20, pvNivel: 4, pe: 2, peNivel: 2, san: 12, sanNivel: 3 },
  Especialista: { pv: 16, pvNivel: 3, pe: 3, peNivel: 3, san: 16, sanNivel: 4 },
  Ocultista: { pv: 12, pvNivel: 2, pe: 4, peNivel: 4, san: 20, sanNivel: 5 },
} as const
export type Classe = keyof typeof CLASSES
export const NOMES_CLASSES = Object.keys(CLASSES) as Classe[]

// Sobrevivendo ao Horror, p. 30 (Tabela 1.2): o sobrevivente fica em NEX 0% e sobe por estágio (1 a 5), com limite de PE 1.
export const SOBREVIVENTE = { pv: 8, pvEstagio: 2, pe: 2, peEstagio: 1, san: 8, sanEstagio: 2, limitePe: 1 } as const
export const ESTAGIOS = [1, 2, 3, 4, 5]

/** Classes cujo PV, PE e SAN saem da tabela do livro (as outras usam os máximos digitados). */
export const temTabela = (classe: string) => classe in CLASSES || classe === 'Sobrevivente'

export const TRILHAS: Record<Classe, string[]> = {
  // Livro básico, depois as do Sobrevivendo ao Horror (p. 54 em diante).
  Combatente: ['Aniquilador', 'Comandante de Campo', 'Guerreiro', 'Operações Especiais', 'Tropa de Choque', 'Agente Secreto', 'Caçador', 'Monstruoso'],
  Especialista: ['Atirador de Elite', 'Infiltrador', 'Médico de Campo', 'Negociador', 'Técnico', 'Bibliotecário', 'Perseverante', 'Muambeiro'],
  Ocultista: ['Conduíte', 'Flagelador', 'Graduado', 'Intuitivo', 'Lâmina Paranormal', 'Exorcista', 'Possuído', 'Parapsicólogo'],
}

export const ORIGENS = [
  'Acadêmico', 'Agente de Saúde', 'Amnésico', 'Artista', 'Atleta', 'Chef', 'Criminoso', 'Cultista Arrependido',
  'Desgarrado', 'Engenheiro', 'Executivo', 'Investigador', 'Lutador', 'Magnata', 'Mercenário', 'Militar', 'Operário',
  'Policial', 'Religioso', 'Servidor Público', 'Teórico da Conspiração', 'T.I.', 'Trabalhador Rural', 'Trambiqueiro',
  'Universitário', 'Vítima',
  // Sobrevivendo ao Horror, Tabela 1.1.
  'Amigo dos Animais', 'Astronauta', 'Chef do Outro Lado', 'Colegial', 'Cosplayer', 'Diplomata', 'Explorador', 'Experimento',
  'Fanático por Criaturas', 'Fotógrafo', 'Inventor Paranormal', 'Jovem Místico', 'Legista do Turno da Noite', 'Mateiro',
  'Mergulhador', 'Motorista', 'Nerd Entusiasta', 'Profetizado', 'Psicólogo', 'Repórter Investigativo',
]

// Apêndice de condições do livro de regras.
export const CONDICOES = [
  'Abalado', 'Agarrado', 'Alquebrado', 'Apavorado', 'Asfixiado', 'Atordoado', 'Caído', 'Cego', 'Confuso',
  'Debilitado', 'Desprevenido', 'Doente', 'Em Chamas', 'Enjoado', 'Enlouquecendo', 'Enredado', 'Envenenado',
  'Esmorecido', 'Exausto', 'Fascinado', 'Fatigado', 'Fraco', 'Frustrado', 'Imóvel', 'Inconsciente', 'Indefeso',
  'Lento', 'Machucado', 'Morrendo', 'Ofuscado', 'Paralisado', 'Pasmo', 'Perturbado', 'Petrificado', 'Sangrando',
  'Surdo', 'Surpreendido', 'Vulnerável',
]

export const NEX_VALORES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99]

// Graus de treinamento (Capítulo 2: Perícias).
export const TREINOS = [
  { valor: 0, nome: 'Destreinado' },
  { valor: 5, nome: 'Treinado' },
  { valor: 10, nome: 'Veterano' },
  { valor: 15, nome: 'Expert' },
]

export const PERICIAS: { nome: string; atributo: Atributo }[] = [
  { nome: 'Acrobacia', atributo: 'agi' },
  { nome: 'Adestramento', atributo: 'pre' },
  { nome: 'Artes', atributo: 'pre' },
  { nome: 'Atletismo', atributo: 'for' },
  { nome: 'Atualidades', atributo: 'int' },
  { nome: 'Ciências', atributo: 'int' },
  { nome: 'Crime', atributo: 'agi' },
  { nome: 'Diplomacia', atributo: 'pre' },
  { nome: 'Enganação', atributo: 'pre' },
  { nome: 'Fortitude', atributo: 'vig' },
  { nome: 'Furtividade', atributo: 'agi' },
  { nome: 'Iniciativa', atributo: 'agi' },
  { nome: 'Intimidação', atributo: 'pre' },
  { nome: 'Intuição', atributo: 'pre' },
  { nome: 'Investigação', atributo: 'int' },
  { nome: 'Luta', atributo: 'for' },
  { nome: 'Medicina', atributo: 'int' },
  { nome: 'Ocultismo', atributo: 'int' },
  { nome: 'Percepção', atributo: 'pre' },
  { nome: 'Pilotagem', atributo: 'agi' },
  { nome: 'Pontaria', atributo: 'agi' },
  { nome: 'Profissão', atributo: 'int' },
  { nome: 'Reflexos', atributo: 'agi' },
  { nome: 'Religião', atributo: 'pre' },
  { nome: 'Sobrevivência', atributo: 'int' },
  { nome: 'Tática', atributo: 'int' },
  { nome: 'Tecnologia', atributo: 'int' },
  { nome: 'Vontade', atributo: 'pre' },
]

// Tabela 3.1: patentes, prestígio mínimo e limite de itens por categoria (I, II, III, IV).
export const PATENTES = [
  { nome: 'Recruta', prestigio: 0, limite: [2, 0, 0, 0] },
  { nome: 'Operador', prestigio: 20, limite: [3, 1, 0, 0] },
  { nome: 'Agente especial', prestigio: 50, limite: [3, 2, 1, 0] },
  { nome: 'Oficial de operações', prestigio: 100, limite: [3, 3, 2, 1] },
  { nome: 'Agente de elite', prestigio: 200, limite: [3, 3, 3, 2] },
]

// Tipos de dano do livro de regras (Combate → Tipos de Dano): físicos, outros e paranormais.
export const TIPOS_DANO = [
  'Balístico', 'Corte', 'Impacto', 'Perfuração',
  'Eletricidade', 'Fogo', 'Frio', 'Químico', 'Mental',
  'Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo',
]

// Tabela 5.2: custo em PE por círculo de ritual.
export const CUSTO_CIRCULO = [0, 1, 3, 6, 10]

export function nivelNex(nex: number) {
  // NEX 99% é o último nível (20).
  return Math.max(1, Math.min(20, Math.ceil(nex / 5)))
}

export function patentePorPrestigio(prestigio: number) {
  return [...PATENTES].reverse().find((p) => prestigio >= p.prestigio) ?? PATENTES[0]
}

export interface DadosFicha {
  classe: string
  nex: number
  atributos: Atributos
  pericias: Record<string, { treino: number; extra: number }>
  bonus: { pv: number; pe: number; san: number; defesaEquip: number; defesaOutros: number; deslocamento: number }
  prestigio: number
  inventario: { categoria: number; espacos: number; quantidade: number; defesa: number; equipado: boolean }[]
  /** Só do sobrevivente (1 a 5). */
  estagio?: number
}

export interface Formula {
  total: number
  partes: { rotulo: string; valor: number }[]
}

function formula(partes: { rotulo: string; valor: number }[]): Formula {
  return { total: partes.reduce((s, p) => s + p.valor, 0), partes }
}

export function bonusPericia(f: DadosFicha, nome: string) {
  const p = f.pericias[nome] ?? { treino: 0, extra: 0 }
  return (p.treino || 0) + (p.extra || 0)
}

// Quantos d20 rolar num teste e se fica com o maior ou o menor.
// Livro, p. 9 e p. 12: atributo 0 rola 2d20 e fica com o pior. Penalidade que deixaria menos de 1 dado: rola os dados
// que rolaria se a penalidade fosse bônus e fica com o pior (Força 2 com –OO: 4d20, o pior).
export function dadosDoTeste(valorAtributo: number, dadosExtras = 0) {
  const n = valorAtributo + dadosExtras
  if (n >= 1) return { quantidade: n, regra: 'maior' as const }
  // Atributo 0 (ou negativo) já rola 2 e fica com o pior; cada dado de penalidade soma mais um dado ao pior.
  if (valorAtributo <= 0) return { quantidade: 2 - n, regra: 'menor' as const }
  return { quantidade: valorAtributo - dadosExtras, regra: 'menor' as const }
}

export function derivados(f: DadosFicha) {
  const nivel = nivelNex(f.nex)
  const aumentos = nivel - 1
  const c = CLASSES[f.classe as Classe]
  const { vig, pre } = f.atributos

  if (f.classe === 'Sobrevivente') return derivadosComuns(f, sobrevivente(f), SOBREVIVENTE.limitePe)
  const pv = c
    ? formula([
        { rotulo: 'Base', valor: c.pv },
        { rotulo: 'VIG', valor: vig },
        { rotulo: 'Por NEX', valor: aumentos * (c.pvNivel + vig) },
        { rotulo: 'Outros', valor: f.bonus.pv },
      ])
    : formula([{ rotulo: 'Outros', valor: f.bonus.pv }])
  const pe = c
    ? formula([
        { rotulo: 'Base', valor: c.pe },
        { rotulo: 'PRE', valor: pre },
        { rotulo: 'Por NEX', valor: aumentos * (c.peNivel + pre) },
        { rotulo: 'Outros', valor: f.bonus.pe },
      ])
    : formula([{ rotulo: 'Outros', valor: f.bonus.pe }])
  const san = c
    ? formula([
        { rotulo: 'Base', valor: c.san },
        { rotulo: 'Por NEX', valor: aumentos * c.sanNivel },
        { rotulo: 'Outros', valor: f.bonus.san },
      ])
    : formula([{ rotulo: 'Outros', valor: f.bonus.san }])
  return derivadosComuns(f, { pv, pe, san }, nivel)
}

/** PV, PE e SAN do sobrevivente: base do livro mais o ganho por estágio. */
function sobrevivente(f: DadosFicha) {
  const s = SOBREVIVENTE
  const subidas = Math.max(0, Math.min(5, f.estagio ?? 1) - 1)
  return {
    pv: formula([{ rotulo: 'Base', valor: s.pv }, { rotulo: 'VIG', valor: f.atributos.vig }, { rotulo: 'Por estágio', valor: subidas * s.pvEstagio }, { rotulo: 'Outros', valor: f.bonus.pv }]),
    pe: formula([{ rotulo: 'Base', valor: s.pe }, { rotulo: 'PRE', valor: f.atributos.pre }, { rotulo: 'Por estágio', valor: subidas * s.peEstagio }, { rotulo: 'Outros', valor: f.bonus.pe }]),
    san: formula([{ rotulo: 'Base', valor: s.san }, { rotulo: 'Por estágio', valor: subidas * s.sanEstagio }, { rotulo: 'Outros', valor: f.bonus.san }])
  }
}

function derivadosComuns(f: DadosFicha, { pv, pe, san }: { pv: Formula; pe: Formula; san: Formula }, limitePe: number) {
  const nivel = nivelNex(f.nex)
  const { agi, pre } = f.atributos
  const equipDefesa = f.inventario.filter((i) => i.equipado).reduce((s, i) => s + (i.defesa || 0), 0)
  const defesa = formula([
    { rotulo: 'Base', valor: 10 },
    { rotulo: 'AGI', valor: agi },
    { rotulo: 'Equip.', valor: equipDefesa + f.bonus.defesaEquip },
    { rotulo: 'Outros', valor: f.bonus.defesaOutros },
  ])

  const patente = patentePorPrestigio(f.prestigio)
  const usados = [1, 2, 3, 4].map((cat) =>
    f.inventario.filter((i) => i.categoria === cat).reduce((s, i) => s + (i.quantidade || 1), 0))
  const cargaMax = f.atributos.for > 0 ? f.atributos.for * 5 : 2
  const carga = f.inventario.reduce((s, i) => s + (i.espacos || 0) * (i.quantidade || 1), 0)

  return {
    nivel,
    pv,
    pe,
    san,
    defesa,
    esquiva: defesa.total + bonusPericia(f, 'Reflexos'),
    bloqueio: bonusPericia(f, 'Fortitude'),
    limitePe,
    dtRitual: 10 + limitePe + pre,
    deslocamento: 9 + (f.bonus.deslocamento || 0),
    patente,
    itensPorCategoria: usados.map((u, i) => ({ usados: u, limite: patente.limite[i] })),
    carga,
    cargaMax,
    sobrecarregado: carga > cargaMax,
  }
}

// --- Rolagens com dados físicos: o jogador digita os valores e o sistema calcula. ---

export interface ResultadoTeste {
  escolhido: number
  total: number
  critico: boolean
  natural20: boolean
}

// Teste de d20: fica com o maior (ou o menor, se o atributo for 0 ou negativo).
export function resolverTeste(valores: number[], regra: 'maior' | 'menor', bonus: number, margemCritico = 20): ResultadoTeste {
  const validos = valores.filter((v) => v >= 1 && v <= 20)
  const escolhido = validos.length ? (regra === 'maior' ? Math.max(...validos) : Math.min(...validos)) : 0
  return {
    escolhido,
    total: escolhido + bonus,
    critico: escolhido > 0 && escolhido >= margemCritico,
    natural20: escolhido === 20,
  }
}

export interface ExpressaoDano {
  dados: { quantidade: number; faces: number }[]
  fixo: number
}

// Lê expressões como "1d8+2", "2d6 + 1d4 + 3" ou "4".
export function lerExpressao(texto: string): ExpressaoDano {
  const expr: ExpressaoDano = { dados: [], fixo: 0 }
  const limpo = texto.replace(/\s+/g, '').toLowerCase()
  for (const m of limpo.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g)) {
    if (m[3]) {
      const q = Number(m[2] || 1) * (m[1] === '-' ? -1 : 1)
      expr.dados.push({ quantidade: q, faces: Number(m[3]) })
    } else if (m[5]) {
      expr.fixo += Number(m[5]) * (m[4] === '-' ? -1 : 1)
    }
  }
  return expr
}

// Dados que o jogador precisa rolar (no crítico, os dados são multiplicados; o bônus fixo não).
export function dadosDoDano(expr: ExpressaoDano, multiplicador = 1) {
  return expr.dados.map((d) => ({ faces: d.faces, quantidade: Math.abs(d.quantidade) * multiplicador, sinal: Math.sign(d.quantidade) || 1 }))
}

export function resolverDano(expr: ExpressaoDano, valores: number[][], multiplicador = 1, bonusExtra = 0) {
  const grupos = dadosDoDano(expr, multiplicador)
  let total = expr.fixo + bonusExtra
  grupos.forEach((g, i) => {
    const vs = (valores[i] ?? []).filter((v) => v >= 1 && v <= g.faces)
    total += g.sinal * vs.reduce((s, v) => s + v, 0)
  })
  return Math.max(0, total)
}

export function descreverExpressao(expr: ExpressaoDano, multiplicador = 1) {
  const partes = dadosDoDano(expr, multiplicador).map((g) => `${g.sinal < 0 ? '-' : ''}${g.quantidade}d${g.faces}`)
  if (expr.fixo) partes.push(String(expr.fixo))
  return partes.join(' + ').replace(/\+ -/g, '- ') || '0'
}

// --- T7: digitar só o que conta (o d20 que ficou, a soma de cada tipo de dano) ou deixar o app rolar. ---

// Menor e maior soma possíveis dos dados de uma expressão (sem o fixo).
export function faixaSoma(expr: ExpressaoDano, multiplicador = 1) {
  let min = 0
  let max = 0
  for (const g of dadosDoDano(expr, multiplicador)) {
    if (g.sinal > 0) {
      min += g.quantidade
      max += g.quantidade * g.faces
    } else {
      min -= g.quantidade * g.faces
      max -= g.quantidade
    }
  }
  return { min, max }
}

/** Um dado de `faces` lados, uniforme. `sorte` recebe o número de faces e devolve de 0 a faces-1 (para os testes). */
export function rolarDado(faces: number, sorte: (n: number) => number = sorteio) {
  return sorte(faces) + 1
}

export function rolarDados(quantidade: number, faces: number, sorte?: (n: number) => number) {
  return Array.from({ length: quantidade }, () => rolarDado(faces, sorte))
}

// Rola os dados de uma expressão: um grupo de valores por termo, no formato de resolverDano.
export function rolarExpressao(expr: ExpressaoDano, multiplicador = 1, sorte?: (n: number) => number) {
  return dadosDoDano(expr, multiplicador).map((g) => rolarDados(g.quantidade, g.faces, sorte))
}

function sorteio(n: number) {
  // Rejeita o resto para não favorecer as faces baixas.
  const limite = Math.floor(0x1_0000_0000 / n) * n
  const v = new Uint32Array(1)
  do crypto.getRandomValues(v)
  while (v[0] >= limite)
  return v[0] % n
}
