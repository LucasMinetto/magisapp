// Aba Combate: Defesa, Esquiva, Bloqueio, PE por turno, deslocamento e ataques.
// Portado do taberna (web/src/ficha/Combate.tsx).
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { Ataque } from '@shared/ordem/esquemas'
import { PERICIAS, TIPOS_DANO, bonusPericia, dadosDoTeste, descreverExpressao, lerExpressao } from '@shared/ordem/regras'
import { Button, cx } from '@/ui'
import { novoId, sinal, useFicha } from './contexto'
import { FormulaTexto } from './Identidade'
import { Escolha, Numero, Secao, Texto, Vazio } from './partes'

export function Combate() {
  const { a, alterar, d } = useFicha()
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        <Valor rotulo="Defesa" valor={d.defesa.total} destaque />
        <Valor rotulo="Esquiva" valor={d.esquiva} dica="Defesa + Reflexos" />
        <Valor rotulo="Bloqueio" valor={d.bloqueio} dica="RD igual a Fortitude" />
        <Valor rotulo="PE por turno" valor={d.limitePe} />
        <Valor rotulo="Deslocamento" valor={`${d.deslocamento}m`} dica={`${Math.floor(d.deslocamento / 1.5)} quadrados`} />
        <Valor rotulo="DT de ritual" valor={d.dtRitual} />
      </div>
      <p className="text-xs text-subtle">
        Defesa: <FormulaTexto f={d.defesa} />
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Numero rotulo="Defesa do equip." valor={a.bonus.defesaEquip} aoMudar={(v) => alterar({ bonus: { ...a.bonus, defesaEquip: v } })} />
        <Numero rotulo="Defesa, outros" valor={a.bonus.defesaOutros} aoMudar={(v) => alterar({ bonus: { ...a.bonus, defesaOutros: v } })} />
        <Numero rotulo="Desloc. extra (m)" valor={a.bonus.deslocamento} aoMudar={(v) => alterar({ bonus: { ...a.bonus, deslocamento: v } })} />
      </div>
      <Ataques />
    </div>
  )
}

function Valor({ rotulo, valor, destaque, dica }: { rotulo: string; valor: number | string; destaque?: boolean; dica?: string }) {
  return (
    <div title={dica} className={cx('rounded-md border px-2 py-2 text-center', destaque ? 'border-accent bg-surface-raised' : 'border-border bg-surface')}>
      <div className="font-serif text-2xl font-semibold">{valor}</div>
      <div className="text-[10px] font-semibold tracking-wider text-muted uppercase">{rotulo}</div>
    </div>
  )
}

const NOVO_ATAQUE = (): Ataque => ({
  id: novoId(),
  nome: 'Novo ataque',
  pericia: 'Luta',
  bonusAtaque: 0,
  dano: '1d6',
  tipoDano: 'Impacto',
  danosExtras: [],
  margemCritico: 20,
  multCritico: 2,
  alcance: 'Corpo a corpo',
  notas: ''
})

function Ataques() {
  const { a, alterar, rolar, mod } = useFicha()
  const [editando, setEditando] = useState<string | null>(null)
  const mudar = (id: string, patch: Partial<Ataque>) => alterar({ ataques: a.ataques.map((x) => (x.id === id ? { ...x, ...patch } : x)) })

  return (
    <Secao
      titulo="Ataques"
      acoes={
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus className="size-4" />}
          onClick={() => {
            const n = NOVO_ATAQUE()
            alterar({ ataques: [...a.ataques, n] })
            setEditando(n.id)
          }}
        >
          Ataque
        </Button>
      }
    >
      {a.ataques.length === 0 && <Vazio>Nenhum ataque. Adicione as armas.</Vazio>}
      <ul className="flex flex-col gap-2">
        {a.ataques.map((at) => {
          const atributo = PERICIAS.find((p) => p.nome === at.pericia)?.atributo ?? 'for'
          const t = dadosDoTeste(a.atributos[atributo], mod.dados)
          const bonus = bonusPericia(a, at.pericia) + at.bonusAtaque + mod.bonus
          // Ataque corpo a corpo (Luta) soma FOR ao dano.
          const somaFor = at.pericia === 'Luta' ? a.atributos.for : 0
          const expr = lerExpressao(at.dano)
          const extras = at.danosExtras.filter((x) => x.dano.trim())
          const textoDano = [descreverExpressao({ ...expr, fixo: expr.fixo + somaFor }), ...extras.map((x) => descreverExpressao(lerExpressao(x.dano)))].join(' + ')
          const danoFinal = `${at.dano}${somaFor ? sinal(somaFor) : ''}`
          const critico = `${at.margemCritico < 20 ? `${at.margemCritico}/` : ''}x${at.multCritico}`
          const partes = [{ expressao: danoFinal, tipo: at.tipoDano }, ...extras.map((x) => ({ expressao: x.dano, tipo: x.tipoDano }))]
          const dano = { opcoes: [{ nome: 'Dano', partes }], mult: at.multCritico }
          const tipos = [at.tipoDano, ...extras.map((x) => x.tipoDano)].filter(Boolean).join(' + ')

          if (editando === at.id)
            return (
              <li key={at.id} className="flex flex-col gap-3 rounded-md border border-border-input bg-surface p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Texto rotulo="Nome" valor={at.nome} aoMudar={(nome) => mudar(at.id, { nome })} />
                  <Escolha
                    rotulo="Perícia"
                    valor={at.pericia}
                    opcoes={['Luta', 'Pontaria', ...PERICIAS.map((p) => p.nome).filter((n) => n !== 'Luta' && n !== 'Pontaria')]}
                    aoMudar={(pericia) => mudar(at.id, { pericia })}
                  />
                  <Texto rotulo="Dano" valor={at.dano} placeholder="1d8+2" aoMudar={(v) => mudar(at.id, { dano: v })} />
                  <Escolha rotulo="Tipo de dano" valor={at.tipoDano} opcoes={['', ...TIPOS_DANO]} aoMudar={(tipoDano) => mudar(at.id, { tipoDano })} />
                  <Numero rotulo="Bônus no ataque" valor={at.bonusAtaque} aoMudar={(bonusAtaque) => mudar(at.id, { bonusAtaque })} />
                  <Texto rotulo="Alcance" valor={at.alcance} aoMudar={(alcance) => mudar(at.id, { alcance })} />
                  <Numero rotulo="Crítico (margem)" valor={at.margemCritico} aoMudar={(v) => mudar(at.id, { margemCritico: Math.min(20, Math.max(2, v || 20)) })} />
                  <Numero rotulo="Multiplicador" valor={at.multCritico} aoMudar={(v) => mudar(at.id, { multCritico: Math.min(5, Math.max(2, v || 2)) })} />
                </div>
                {at.danosExtras.map((x, i) => {
                  const mudarExtra = (p: Partial<typeof x>) => mudar(at.id, { danosExtras: at.danosExtras.map((y, j) => (j === i ? { ...y, ...p } : y)) })
                  return (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <Texto rotulo="Dano extra" valor={x.dano} placeholder="2d6" aoMudar={(dano) => mudarExtra({ dano })} />
                      <Escolha rotulo="Tipo do extra" valor={x.tipoDano} opcoes={['', ...TIPOS_DANO]} aoMudar={(tipoDano) => mudarExtra({ tipoDano })} />
                      <Button size="sm" variant="ghost" onClick={() => mudar(at.id, { danosExtras: at.danosExtras.filter((_, j) => j !== i) })}>
                        Tirar
                      </Button>
                    </div>
                  )
                })}
                {at.danosExtras.length < 6 && (
                  <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} className="self-start" onClick={() => mudar(at.id, { danosExtras: [...at.danosExtras, { dano: '', tipoDano: '' }] })}>
                    Outro tipo de dano
                  </Button>
                )}
                <Texto rotulo="Notas" valor={at.notas} aoMudar={(notas) => mudar(at.id, { notas })} />
                <div className="flex justify-between">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Remover ${at.nome}?`)) alterar({ ataques: a.ataques.filter((x) => x.id !== at.id) })
                    }}
                  >
                    Remover
                  </Button>
                  <Button size="sm" onClick={() => setEditando(null)}>
                    Pronto
                  </Button>
                </div>
              </li>
            )

          const caixa = 'rounded-md bg-surface-raised px-1 py-1.5 text-center'
          return (
            <li key={at.id} className="rounded-md border border-border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{at.nome}</div>
                  <div className="truncate text-xs text-subtle">{[at.pericia, at.alcance, tipos].filter(Boolean).join(' · ')}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditando(at.id)}>
                  Editar
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { texto: `${t.quantidade}d20${bonus ? sinal(bonus) : ''}`, nome: 'Ataque', pedido: { rotulo: at.nome, tipo: 'ataque' as const, teste: { ...t, bonus, margem: at.margemCritico }, dano } },
                  { texto: textoDano, nome: 'Dano', pedido: { rotulo: at.nome, tipo: 'dano' as const, dano } }
                ].map((b) =>
                  rolar ? (
                    <button key={b.nome} type="button" onClick={() => rolar(b.pedido)} aria-label={`Rolar ${b.nome.toLowerCase()} de ${at.nome}`} className={cx(caixa, 'hover:bg-border')}>
                      <div className="font-mono text-sm font-semibold">{b.texto}</div>
                      <div className="text-[10px] tracking-wider text-muted uppercase">{b.nome}</div>
                    </button>
                  ) : (
                    <div key={b.nome} className={caixa}>
                      <div className="font-mono text-sm font-semibold">{b.texto}</div>
                      <div className="text-[10px] tracking-wider text-muted uppercase">{b.nome}</div>
                    </div>
                  )
                )}
                <div className={caixa}>
                  <div className="font-mono text-sm font-semibold">{critico}</div>
                  <div className="text-[10px] tracking-wider text-muted uppercase">Crítico</div>
                </div>
              </div>
              {at.notas && <p className="mt-2 text-xs text-muted">{at.notas}</p>}
            </li>
          )
        })}
      </ul>
    </Secao>
  )
}
