// A ficha completa e o bloco de ameaça em seções de texto, para o cofre do Obsidian (Markdown) e o exportar
// (Word, PDF, texto). Um formato só, para os dois saírem iguais. Funções puras.
import type { BlocoAmeaca, FichaAgente, Item, RitualDaFicha } from './esquemas'
import { ATRIBUTOS, bonusPericia, CUSTO_CIRCULO, derivados, patentePorPrestigio, temTabela, TREINOS } from './regras'

export interface SecaoFicha {
  titulo: string
  /** "Rótulo: valor" em linhas. */
  pares?: [string, string][]
  /** Lista de itens, cada um uma linha. */
  itens?: string[]
  /** Parágrafos de texto livre. */
  texto?: string[]
}

const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const par = (rotulo: string, valor: string | number | null | undefined): [string, string][] =>
  valor === undefined || valor === null || valor === '' || valor === 0 ? [] : [[rotulo, String(valor)]]
const junta = (...partes: (string | false | null | undefined | 0)[]) => partes.filter(Boolean).join(' · ')
const secao = (s: SecaoFicha): SecaoFicha[] => (s.pares?.length || s.itens?.length || s.texto?.length ? [s] : [])

/** PV/PE/SAN máximos: classes com tabela calculam; as outras usam os máximos digitados. */
export function maximosDaFicha(f: FichaAgente) {
  const d = derivados(f)
  const tabela = temTabela(f.classe)
  return { d, pv: tabela ? d.pv.total : f.pvMax, pe: tabela ? d.pe.total : f.peMax, san: tabela ? d.san.total : f.sanMax }
}

export const linhaDoRitual = (r: RitualDaFicha) =>
  junta(`${r.nome || 'Ritual'} (${r.elemento || 'sem elemento'}, ${r.circulo}º círculo, ${CUSTO_CIRCULO[r.circulo]} PE)`, r.execucao, r.alcance && `alcance ${r.alcance}`, r.danoNormal && `dano ${r.danoNormal}${r.tipoDano ? ` ${r.tipoDano}` : ''}`)

export const linhaDoItem = (i: Item) =>
  junta(
    `${i.nome || 'Item'}${i.quantidade > 1 ? ` ×${i.quantidade}` : ''}`,
    i.tipo,
    i.categoria > 0 && `categoria ${['', 'I', 'II', 'III', 'IV'][i.categoria]}`,
    i.dano && `dano ${i.dano}${i.tipoDano ? ` ${i.tipoDano}` : ''}`,
    i.critico && `crítico ${i.critico}`,
    i.defesa > 0 && `Defesa +${i.defesa}`,
    i.equipado && 'equipado'
  )

/** Detalhes de um ritual: o que o livro mostra no bloco. */
export function detalhesDoRitual(r: RitualDaFicha): SecaoFicha[] {
  return [
    ...secao({
      titulo: 'Ritual',
      pares: [
        ...par('Elemento', r.elemento),
        ['Círculo', `${r.circulo}º (${CUSTO_CIRCULO[r.circulo]} PE)`],
        ...par('Execução', r.execucao),
        ...par('Alcance', r.alcance),
        ...par('Alvo', r.alvo),
        ...par('Duração', r.duracao),
        ...par('Resistência', r.resistencia),
        ...par('Dano', r.danoNormal && `${r.danoNormal}${r.tipoDano ? ` ${r.tipoDano}` : ''}`)
      ]
    }),
    ...secao({ titulo: 'Efeito', texto: [r.efeito].filter(Boolean) }),
    ...secao({ titulo: 'Discente', texto: [r.discente, r.danoDiscente && `Dano: ${r.danoDiscente}`].filter(Boolean) as string[] }),
    ...secao({ titulo: 'Verdadeiro', texto: [r.verdadeiro, r.danoVerdadeiro && `Dano: ${r.danoVerdadeiro}`].filter(Boolean) as string[] })
  ]
}

export function detalhesDoItem(i: Item): SecaoFicha[] {
  return [
    ...secao({
      titulo: 'Item',
      pares: [
        ['Tipo', i.tipo],
        ...par('Categoria', i.categoria > 0 ? ['', 'I', 'II', 'III', 'IV'][i.categoria] : ''),
        ...par('Espaços', i.espacos),
        ...par('Defesa', i.defesa > 0 ? `+${i.defesa}` : ''),
        ...par('Dano', i.dano && `${i.dano}${i.tipoDano ? ` ${i.tipoDano}` : ''}`),
        ...par('Crítico', i.critico),
        ...par('Alcance', i.alcance),
        ...par('Proficiência', i.proficiencia),
        ...par('Empunhadura', i.empunhadura),
        ...par('Elemento', i.elemento)
      ]
    }),
    ...secao({ titulo: 'Descrição', texto: [i.descricao].filter(Boolean) })
  ]
}

/** Ficha completa do agente (ou NPC vilão), com os valores calculados pelas regras do livro. */
export function secoesDoAgente(f: FichaAgente): SecaoFicha[] {
  const { d, pv, pe, san } = maximosDaFicha(f)
  const treinadas = Object.entries(f.pericias)
    .filter(([, p]) => p.treino > 0 || p.extra !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, p]) => `${nome} ${sinal(bonusPericia(f, nome))}${p.treino > 0 ? ` (${TREINOS.find((t) => t.valor === p.treino)?.nome ?? 'treinado'})` : ''}`)
  const inv = f.investigacao
  return [
    ...secao({
      titulo: 'Agente',
      pares: [...par('Jogador', f.jogador), ...par('Origem', f.origem), ...par('Classe', f.classe), ...par('Trilha', f.trilha), f.classe === 'Sobrevivente' ? ['Estágio', String(f.estagio)] : ['NEX', `${f.nex}%`], ['Patente', patentePorPrestigio(f.prestigio).nome], ...par('Prestígio', f.prestigio)]
    }),
    { titulo: 'Atributos', pares: ATRIBUTOS.map((a) => [a.sigla, String(f.atributos[a.id])] as [string, string]) },
    {
      titulo: 'Combate',
      pares: [
        ...par('PV', pv > 0 ? `${f.pvAtual}/${pv}${f.pvTemp ? ` (+${f.pvTemp} temporários)` : ''}` : ''),
        ...par('PE', pe > 0 ? `${f.peAtual}/${pe} (limite ${d.limitePe} por turno)` : ''),
        ...par('SAN', san > 0 ? `${f.sanAtual}/${san}` : ''),
        ['Defesa', String(d.defesa.total)],
        ['Esquiva', String(d.esquiva)],
        ['Bloqueio', String(d.bloqueio)],
        ['Deslocamento', `${d.deslocamento} m`],
        ['DT de ritual', String(d.dtRitual)],
        ...par('Condições', f.condicoes.join(', '))
      ]
    },
    ...secao({ titulo: 'Perícias', itens: treinadas }),
    ...secao({
      titulo: 'Ataques',
      itens: f.ataques.map((a) =>
        junta(
          `${a.nome || 'Ataque'} (${a.pericia}${a.bonusAtaque ? ` ${sinal(a.bonusAtaque)}` : ''})`,
          a.dano && `dano ${a.dano}${a.tipoDano ? ` ${a.tipoDano}` : ''}${a.danosExtras.map((x) => ` + ${x.dano} ${x.tipoDano}`).join('')}`,
          `crítico ${a.margemCritico < 20 ? `${a.margemCritico}/` : ''}x${a.multCritico}`,
          a.alcance,
          a.notas
        )
      )
    }),
    ...secao({ titulo: 'Rituais', itens: f.rituais.map(linhaDoRitual) }),
    ...secao({ titulo: 'Habilidades', itens: f.habilidades.map((h) => `${h.nome || 'Habilidade'}${h.fonte ? ` (${h.fonte})` : ''}${h.custo ? `, ${h.custo}` : ''}${h.descricao ? `: ${h.descricao}` : ''}`) }),
    ...secao({ titulo: 'Inventário', itens: f.inventario.map(linhaDoItem) }),
    ...secao({
      titulo: 'Investigação',
      pares: [...par('Aparência', inv.aparencia), ...par('Personalidade', inv.personalidade), ...par('Histórico', inv.historico), ...par('Objetivo', inv.objetivo), ...par('Anotações', inv.anotacoes)]
    })
  ]
}

/** Bloco da ameaça no formato do livro. */
export function secoesDaAmeaca(b: BlocoAmeaca): SecaoFicha[] {
  const presenca = b.presencaDt ? junta(`DT ${b.presencaDt}`, b.presencaDano && `dano ${b.presencaDano}`, b.presencaNexImune && `imune com NEX ${b.presencaNexImune}`) : ''
  return [
    ...secao({
      titulo: 'Ameaça',
      pares: [...par('Elemento', b.elemento), ...par('Tipo', b.tipo), ...par('Tamanho', b.tamanho), ...par('VD', b.vd), ...par('Presença perturbadora', presenca)]
    }),
    ...secao({
      titulo: 'Combate',
      pares: [
        ...par('PV', b.pv ? `${b.pv}${b.pvMachucado ? ` (machucado ${b.pvMachucado})` : ''}` : ''),
        ...par('Defesa', b.defesa),
        ...par('Fortitude', b.fortitude),
        ...par('Reflexos', b.reflexos),
        ...par('Vontade', b.vontade),
        ...par('Percepção', b.percepcao),
        ...par('Iniciativa', b.iniciativa),
        ...par('Sentidos', b.sentidos),
        ...par('Deslocamento', b.deslocamento),
        ...par('Resistências', b.resistencias),
        ...par('Vulnerabilidades', b.vulnerabilidades),
        ...par('Imunidades', b.imunidades)
      ]
    }),
    { titulo: 'Atributos', pares: ATRIBUTOS.map((a) => [a.sigla, String(b[a.id])] as [string, string]) },
    ...secao({ titulo: 'Perícias', texto: [b.pericias].filter(Boolean) }),
    ...secao({ titulo: 'Habilidades', itens: b.habilidades.map((h) => `${h.nome}${h.tipo ? ` (${h.tipo})` : ''}: ${h.descricao}`) }),
    ...secao({ titulo: 'Ações', itens: b.acoes.map((a) => `${a.nome}${a.tipo ? ` (${a.tipo})` : ''}: ${a.descricao}`) }),
    ...secao({ titulo: 'Enigma de medo', texto: [b.enigma].filter(Boolean) }),
    ...secao({ titulo: 'Descrição', texto: [b.descricao].filter(Boolean) })
  ]
}

/** Markdown das seções (cabeçalhos no nível pedido). `link` troca nomes por [[links]] no texto livre. */
export function secoesEmMarkdown(secoes: SecaoFicha[], nivel = 2, link: (t: string) => string = (t) => t): string {
  const h = '#'.repeat(nivel)
  return secoes
    .map((s) =>
      [
        `${h} ${s.titulo}`,
        s.pares?.length ? s.pares.map(([r, v]) => `- **${r}:** ${link(v)}`).join('\n') : '',
        s.itens?.length ? s.itens.map((i) => `- ${link(i)}`).join('\n') : '',
        ...(s.texto ?? []).map(link)
      ]
        .filter(Boolean)
        .join('\n\n')
    )
    .join('\n\n')
}

/** Uma rolagem em uma linha: "Lia: Luta (ataque) 2d20+5 = 22, crítico". */
export const linhaDaRolagem = (r: { who: string; label: string; type: string; formula: string; dice: number[]; total: number; critical: boolean; detail: string }) =>
  `${r.who ? `${r.who}: ` : ''}${r.label || r.type}${r.formula ? ` (${r.formula}${r.dice.length ? `: ${r.dice.join(', ')}` : ''})` : ''} = ${r.total}${r.critical ? ', crítico' : ''}${r.detail ? `. ${r.detail}` : ''}`

/** Ordem de iniciativa salva na sessão, de cima para baixo, com o PV de cada ameaça. */
export const linhasDaIniciativa = (ini: { rodada: number; turno: number; ordem: { nome: string; valor: number; pv: { atual: number; max: number } | null; condicoes: string[] }[] }) =>
  ini.ordem.map(
    (c, i) =>
      `${c.valor} · ${c.nome}${c.pv ? ` (PV ${c.pv.atual}/${c.pv.max})` : ''}${c.condicoes.length ? `, ${c.condicoes.join(', ')}` : ''}${i === ini.turno ? ' ← na vez' : ''}`
  )
