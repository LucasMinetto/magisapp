// Etiquetas (tipos de dano, condições) guardadas como texto no formato do livro: "Balístico 5, Sangue 10" ou "Morte, Fogo".
import { useState } from 'react'
import { cx } from '@/ui'
import { TIPOS_DANO } from '@shared/ordem/regras'

export type GrupoTags = { titulo: string; itens: string[] }

export const GRUPOS_TIPO_DANO: GrupoTags[] = [
  { titulo: 'Físico', itens: TIPOS_DANO.slice(0, 4) },
  { titulo: 'Outros', itens: TIPOS_DANO.slice(4, 9) },
  { titulo: 'Paranormal', itens: TIPOS_DANO.slice(9) }
]

// Resistências e imunidades também podem valer para qualquer dano ("Dano").
export const GRUPOS_DANO: GrupoTags[] = [{ titulo: 'Geral', itens: ['Dano'] }, ...GRUPOS_TIPO_DANO]

export const GRUPOS_IMUNIDADE: GrupoTags[] = [
  ...GRUPOS_DANO,
  {
    titulo: 'Condições',
    itens: ['Todas as condições', 'Condições de paralisia', 'Condições de medo', 'Condições mentais', 'Condições de sentidos', 'Condições de fadiga', 'Atordoado']
  }
]

function separar(texto: string, conhecidos: string[], comValor: boolean) {
  const marcados = new Map<string, number | null>()
  const extras: string[] = []
  for (const bruto of texto.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = comValor ? bruto.match(/^(.*?)\s+(\d+)$/) : null
    const nome = (m ? m[1] : bruto).trim()
    const certo = conhecidos.find((c) => c.toLowerCase() === nome.toLowerCase())
    if (certo) marcados.set(certo, m ? Number(m[2]) : null)
    else extras.push(bruto)
  }
  return { marcados, extras: extras.join(', ') }
}

export function SeletorTags({
  rotulo,
  valor,
  aoMudar,
  grupos,
  comValor
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  grupos: GrupoTags[]
  /** Pede um número para cada item (resistência a Corte 5). */
  comValor?: boolean
}) {
  const conhecidos = grupos.flatMap((g) => g.itens)
  const { marcados, extras } = separar(valor, conhecidos, !!comValor)
  // O texto livre fica em estado local para não perder espaços enquanto digita.
  const [extra, setExtra] = useState(extras)
  const [mostrarExtra, setMostrarExtra] = useState(extras !== '')

  const salvar = (novos: Map<string, number | null>, livre: string) => {
    const texto = conhecidos.filter((c) => novos.has(c)).map((c) => (comValor && novos.get(c) != null ? `${c} ${novos.get(c)}` : c))
    if (livre.trim()) texto.push(livre.trim())
    aoMudar(texto.join(', '))
  }
  const alternar = (item: string) => {
    const novos = new Map(marcados)
    if (novos.has(item)) novos.delete(item)
    else novos.set(item, comValor ? 5 : null)
    salvar(novos, extra)
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs text-muted">{rotulo}</legend>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-2.5">
        {grupos.map((g) => (
          <div key={g.titulo} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-xs text-subtle">{g.titulo}</span>
            {g.itens.map((item) => {
              const ativo = marcados.has(item)
              return (
                <span
                  key={item}
                  className={cx(
                    'inline-flex items-center overflow-hidden rounded-pill border text-xs',
                    ativo ? 'border-accent bg-accent text-on-accent' : 'border-border-input text-muted hover:text-fg'
                  )}
                >
                  <button type="button" aria-pressed={ativo} aria-label={`${rotulo}: ${item}`} onClick={() => alternar(item)} className="px-2.5 py-1">
                    {item}
                  </button>
                  {ativo && comValor && (
                    <input
                      type="number"
                      min={0}
                      aria-label={`${rotulo}: quanto de ${item}`}
                      title="Quanto de dano ignora"
                      value={marcados.get(item) ?? ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const novos = new Map(marcados)
                        novos.set(item, Number(e.target.value) || 0)
                        salvar(novos, extra)
                      }}
                      className="w-11 border-l border-on-accent/40 bg-bg py-1 text-center font-mono text-fg"
                    />
                  )}
                </span>
              )
            })}
          </div>
        ))}
        {mostrarExtra ? (
          <input
            value={extra}
            aria-label={`${rotulo}: outro`}
            onChange={(e) => {
              setExtra(e.target.value)
              salvar(marcados, e.target.value)
            }}
            placeholder="Outro (ex.: dano 10/Morte)"
            className="h-8 w-full rounded-md border border-border-input bg-surface px-2 text-xs text-fg focus:border-focus"
          />
        ) : (
          <button type="button" onClick={() => setMostrarExtra(true)} className="self-start text-xs text-subtle hover:text-fg">
            + Outro…
          </button>
        )}
      </div>
    </fieldset>
  )
}
