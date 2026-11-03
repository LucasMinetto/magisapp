// Coluna 2 da ficha completa: modificador de testes e as 28 perícias do livro, com treino e bônus.
// Portado do taberna (web/src/ficha/Pericias.tsx).
import { Dices, Minus, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { ATRIBUTOS, PERICIAS, TREINOS, dadosDoTeste } from '@shared/ordem/regras'
import { cx } from '@/ui'
import { sinal, useFicha } from './contexto'
import { Secao } from './partes'

const SIGLA = Object.fromEntries(ATRIBUTOS.map((a) => [a.id, a.sigla]))
const COLUNAS = 'grid grid-cols-[minmax(0,1fr)_32px_108px_44px_36px] items-center gap-2'

export function Pericias() {
  const { a, alterar, rolar, mod } = useFicha()
  const [soTreinadas, setSoTreinadas] = useState(false)
  const [busca, setBusca] = useState('')

  const lista = PERICIAS.filter((p) => {
    if (soTreinadas && !((a.pericias[p.nome]?.treino ?? 0) > 0)) return false
    return !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
  })

  const mudar = (nome: string, patch: Partial<{ treino: number; extra: number }>) =>
    alterar({ pericias: { ...a.pericias, [nome]: { ...(a.pericias[nome] ?? { treino: 0, extra: 0 }), ...patch } } })

  return (
    <div className="flex flex-col gap-5">
      <ModificadorTestes />
      <Secao titulo="Perícias">
        <div role="tablist" aria-label="Filtro de perícias" className="grid grid-cols-2 gap-1">
          {[false, true].map((so) => (
            <button
              key={String(so)}
              type="button"
              role="tab"
              aria-selected={soTreinadas === so}
              onClick={() => setSoTreinadas(so)}
              className="h-7 rounded-md text-sm font-semibold text-muted hover:bg-surface-raised hover:text-fg aria-selected:bg-accent aria-selected:text-on-accent"
            >
              {so ? 'Só treinadas' : 'Todas'}
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Buscar perícias</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar perícias"
            className="h-8 w-full rounded-md border border-border-input bg-bg pr-8 pl-2.5 text-sm focus:border-focus"
          />
          <Search className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        </label>
        <div className={cx(COLUNAS, 'px-2 text-[10px] font-semibold tracking-wider text-subtle uppercase')} aria-hidden>
          <span>Perícia</span>
          <span className="text-center">Atrib.</span>
          <span className="text-center">Treino</span>
          <span className="text-center">Extra</span>
          <span className="text-right">Total</span>
        </div>
        <ul className="flex flex-col gap-1" aria-label="Lista de perícias">
          {lista.map((p) => {
            const reg = a.pericias[p.nome] ?? { treino: 0, extra: 0 }
            const t = dadosDoTeste(a.atributos[p.atributo], mod.dados)
            const bonus = reg.treino + reg.extra + mod.bonus
            const treinada = reg.treino > 0
            const dados = `${t.quantidade}d20${t.regra === 'menor' ? ' (menor)' : ''}`
            return (
              <li key={p.nome} className={cx(COLUNAS, 'rounded-md border border-border bg-surface px-2 py-1.5')}>
                <span className="flex min-w-0 items-center gap-1">
                  {rolar && (
                    <button
                      type="button"
                      aria-label={`Testar ${p.nome}: ${dados}${bonus ? sinal(bonus) : ''}`}
                      title="Rolar teste"
                      onClick={() => rolar({ rotulo: p.nome, tipo: 'teste', teste: { ...t, bonus } })}
                      className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-surface-raised hover:text-fg"
                    >
                      <Dices className="size-3.5" aria-hidden />
                    </button>
                  )}
                  <span className="min-w-0">
                    <span className={cx('block truncate text-sm', treinada ? 'font-semibold text-fg' : 'text-muted')} title={p.nome}>
                      {p.nome}
                    </span>
                    <span className="block text-[11px] text-subtle">{dados}</span>
                  </span>
                </span>
                <span className="text-center text-xs font-semibold text-muted">{SIGLA[p.atributo]}</span>
                <select
                  value={reg.treino}
                  aria-label={`Treino em ${p.nome}`}
                  onChange={(e) => mudar(p.nome, { treino: Number(e.target.value) })}
                  className="h-7 w-full rounded-md border border-border-input bg-bg px-1 text-xs text-fg"
                >
                  {TREINOS.map((tr) => (
                    <option key={tr.valor} value={tr.valor}>
                      {tr.nome}
                      {tr.valor ? ` +${tr.valor}` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={reg.extra}
                  aria-label={`Bônus extra em ${p.nome}`}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => mudar(p.nome, { extra: Number(e.target.value) || 0 })}
                  className="h-7 w-full rounded-md border border-border-input bg-bg px-1 text-center font-mono text-xs text-fg"
                />
                <span className="text-right font-mono text-base font-semibold" aria-label={`Total de ${p.nome}`}>
                  {bonus ? sinal(bonus) : '0'}
                </span>
              </li>
            )
          })}
        </ul>
        {lista.length === 0 && <p className="py-4 text-center text-xs text-subtle">Nenhuma perícia encontrada.</p>}
        <p className="text-[11px] text-subtle">Com o atributo 0 ou menos, rola 2d20 (ou mais) e fica com o menor.</p>
      </Secao>
    </div>
  )
}

function ModificadorTestes() {
  const { mod, setMod } = useFicha()
  const ativo = mod.dados !== 0 || mod.bonus !== 0
  const botao = 'grid size-8 place-items-center text-muted hover:bg-surface-raised hover:text-fg'
  return (
    <Secao
      titulo="Modificador de testes"
      acoes={
        ativo && (
          <button type="button" className="h-7 rounded-md px-2 text-xs text-muted hover:bg-surface-raised hover:text-fg" onClick={() => setMod({ dados: 0, bonus: 0 })}>
            Zerar
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(['dados', 'bonus'] as const).map((k) => {
          const nome = k === 'dados' ? 'Dados bônus' : 'Valor bônus'
          return (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-center text-xs text-muted">{nome}</span>
              <div className={cx('flex overflow-hidden rounded-md border', mod[k] ? 'border-warning' : 'border-border-input')}>
                <button type="button" aria-label={`Diminuir ${nome.toLowerCase()}`} className={botao} onClick={() => setMod({ ...mod, [k]: mod[k] - 1 })}>
                  <Minus className="size-4" aria-hidden />
                </button>
                <span aria-live="polite" aria-label={nome} className={cx('flex flex-1 items-center justify-center bg-bg font-mono', mod[k] ? 'text-warning' : 'text-fg')}>
                  {sinal(mod[k])}
                </span>
                <button type="button" aria-label={`Aumentar ${nome.toLowerCase()}`} className={botao} onClick={() => setMod({ ...mod, [k]: mod[k] + 1 })}>
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-subtle">Vale para todos os testes desta ficha até zerar. Não fica salvo.</p>
    </Secao>
  )
}
