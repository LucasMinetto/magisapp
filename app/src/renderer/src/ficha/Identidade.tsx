// Coluna 1 da ficha completa: identidade, hexágono de atributos, PV/SAN/PE e condições.
// O retrato e o nome ficam com a tela da ficha.
import { useState } from 'react'
import { ATRIBUTOS, CLASSES, CONDICOES, NEX_VALORES, NOMES_CLASSES, ORIGENS, TRILHAS, dadosDoTeste, type Classe, type Formula } from '@shared/ordem/regras'
import { cx } from '@/ui'
import { useFicha } from './contexto'
import { Escolha, Numero, Rastreador, Secao, Texto } from './partes'

export function Identidade() {
  const { a, alterar, dadosFisicos } = useFicha()
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Texto rotulo="Jogador" valor={a.jogador} placeholder="Nome de quem joga" aoMudar={(jogador) => alterar({ jogador })} className="col-span-2" />
        <label className="col-span-2 flex items-center gap-2 text-sm" title="Marcada: a janela de rolagem pede os valores dos dados da mesa. Desmarcada: o Magistrado rola.">
          <input type="checkbox" checked={dadosFisicos} onChange={(e) => alterar({ dadosFisicos: e.target.checked })} className="size-4 accent-(--color-accent)" />
          Rola dados físicos
        </label>
        <Escolha rotulo="Origem" livre valor={a.origem} opcoes={ORIGENS} aoMudar={(origem) => alterar({ origem })} />
        <Escolha rotulo="Classe" valor={a.classe} opcoes={['', ...NOMES_CLASSES, 'Sobrevivente']} aoMudar={(classe) => alterar({ classe, trilha: '' })} />
        <Escolha key={a.classe} rotulo="Trilha" livre valor={a.trilha} opcoes={TRILHAS[a.classe as Classe] ?? []} aoMudar={(trilha) => alterar({ trilha })} />
        <Escolha
          rotulo="NEX"
          valor={String(a.nex)}
          opcoes={NEX_VALORES.map((n) => ({ valor: String(n), texto: `${n}%` }))}
          aoMudar={(n) => alterar({ nex: Number(n) })}
        />
      </div>
      <Atributos />
      <Recursos />
      <Condicoes />
    </div>
  )
}

// Centro de cada hexágono num quadro de 300×280, com o círculo "Atributos" no meio.
const POSICOES: Record<string, [number, number]> = {
  agi: [150, 52],
  for: [62, 122],
  int: [238, 122],
  pre: [95, 226],
  vig: [205, 226]
}
const HEX = 'M42 2 82 25v46L42 94 2 71V25Z'

function Atributos() {
  const { a, alterar, rolar, mod } = useFicha()
  return (
    <div className="relative mx-auto h-[280px] w-[300px]" role="group" aria-label="Atributos">
      <svg aria-hidden viewBox="0 0 300 280" className="absolute inset-0 h-full w-full">
        <circle cx="150" cy="148" r="118" fill="none" className="stroke-border-input" strokeDasharray="2 6" strokeWidth="2" />
        <circle cx="150" cy="148" r="48" className="fill-accent" />
        <text x="150" y="153" textAnchor="middle" className="fill-on-accent font-serif text-[15px] font-bold">
          Atributos
        </text>
      </svg>
      <div className="absolute top-0 left-0 flex items-center gap-1.5" title="Nível de Exposição Paranormal">
        <span className="font-serif text-sm font-bold">NEX</span>
        <span className="grid size-10 place-items-center bg-accent font-mono text-xs font-bold text-on-accent [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
          {a.nex}%
        </span>
      </div>
      {ATRIBUTOS.map((at) => {
        const valor = a.atributos[at.id]
        const [x, y] = POSICOES[at.id]
        const t = dadosDoTeste(valor, mod.dados)
        return (
          <div key={at.id} className="group absolute flex h-24 w-[84px] flex-col items-center" style={{ left: x - 42, top: y - 48 }}>
            <svg aria-hidden viewBox="0 0 84 96" className="absolute inset-0 h-full w-full">
              <path d={HEX} className="fill-surface stroke-accent" strokeWidth="3" strokeLinejoin="round" />
            </svg>
            <input
              type="number"
              value={valor}
              aria-label={at.nome}
              onFocus={(e) => e.target.select()}
              onChange={(e) => alterar({ atributos: { ...a.atributos, [at.id]: Number(e.target.value) || 0 } })}
              className="relative mt-3 w-12 rounded bg-transparent text-center font-serif text-3xl font-bold text-fg hover:bg-surface-raised focus:bg-surface-raised focus:outline-none"
            />
            {rolar ? (
              <button
                type="button"
                title={`Teste de ${at.nome}`}
                aria-label={`Rolar teste de ${at.nome}`}
                onClick={() => rolar({ rotulo: at.nome, tipo: 'teste', teste: { ...t, bonus: mod.bonus } })}
                className="relative mt-1 rounded px-1 text-xs font-bold text-muted hover:text-fg"
              >
                {at.sigla}
              </button>
            ) : (
              <span className="relative mt-1 text-xs font-bold text-muted">{at.sigla}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Recursos() {
  const { a, alterar, d, max } = useFicha()
  const temTabela = a.classe in CLASSES
  const itens = [
    { id: 'pv', nome: 'Vida', f: d.pv },
    { id: 'san', nome: 'Sanidade', f: d.san },
    { id: 'pe', nome: 'Esforço', f: d.pe }
  ] as const
  return (
    <div className="flex flex-col gap-4">
      {itens.map((r) => {
        const atual = a[`${r.id}Atual`]
        const temp = a[`${r.id}Temp`]
        const alerta = r.id === 'pv' && max.pv > 0 && atual === 0 ? 'Morrendo' : r.id === 'san' && max.san > 0 && atual === 0 ? 'Enlouquecendo' : null
        return (
          <div key={r.id} className="flex flex-col gap-2">
            <Rastreador rotulo={r.nome} cor={r.id} atual={atual} max={max[r.id]} temp={temp} alerta={alerta} aoMudar={(v) => alterar({ [`${r.id}Atual`]: v })} />
            <p className="text-xs text-subtle">{temTabela ? <FormulaTexto f={r.f} /> : 'Classe sem tabela: o máximo é o digitado.'}</p>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              {!temTabela ? (
                <Numero rotulo="Máximo" valor={a[`${r.id}Max`]} aoMudar={(v) => alterar({ [`${r.id}Max`]: v })} />
              ) : (
                <span />
              )}
              <Numero rotulo="Outros" valor={a.bonus[r.id]} aoMudar={(v) => alterar({ bonus: { ...a.bonus, [r.id]: v } })} />
              <Numero rotulo="Temporário" min={0} valor={temp} aoMudar={(v) => alterar({ [`${r.id}Temp`]: Math.max(0, v) })} />
              <button type="button" className="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-raised hover:text-fg" onClick={() => alterar({ [`${r.id}Atual`]: max[r.id] })}>
                Encher
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FormulaTexto({ f }: { f: Formula }) {
  return (
    <span>
      {f.partes
        .filter((p) => p.valor !== 0 || p.rotulo === 'Base')
        .map((p, i) => (
          <span key={p.rotulo}>
            {i > 0 && ' + '}
            <b className="font-semibold text-muted">{p.valor}</b> {p.rotulo}
          </span>
        ))}
    </span>
  )
}

function Condicoes() {
  const { a, alterar } = useFicha()
  const [aberto, setAberto] = useState(false)
  const alternar = (c: string) => alterar({ condicoes: a.condicoes.includes(c) ? a.condicoes.filter((x) => x !== c) : [...a.condicoes, c] })
  return (
    <Secao
      titulo="Condições"
      acoes={
        <button type="button" aria-expanded={aberto} onClick={() => setAberto((x) => !x)} className="h-7 rounded-md px-2 text-xs text-muted hover:bg-surface-raised hover:text-fg">
          {aberto ? 'Fechar' : 'Escolher'}
        </button>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {(aberto ? CONDICOES : a.condicoes).map((c) => {
          const ativa = a.condicoes.includes(c)
          return (
            <button
              key={c}
              type="button"
              aria-pressed={ativa}
              onClick={() => alternar(c)}
              className={cx('h-6 rounded-pill border px-2.5 text-xs', ativa ? 'border-danger bg-danger/15 font-semibold text-danger' : 'border-border text-muted hover:text-fg')}
            >
              {c}
            </button>
          )
        })}
        {!aberto && a.condicoes.length === 0 && <span className="text-xs text-subtle">Nenhuma.</span>}
      </div>
    </Secao>
  )
}
