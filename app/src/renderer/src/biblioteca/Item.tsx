// Item da biblioteca (T9): leitura e formulário. Arma mostra dano, crítico e alcance; proteção, a Defesa.
import { ELEMENTOS, TIPOS_ITEM, type ItemBiblioteca } from '@shared/ordem/esquemas'
import { TIPOS_DANO } from '@shared/ordem/regras'
import { AreaTexto, Escolha, Numero, Texto } from '@/ficha/partes'

export const CATEGORIAS = ['0', 'I', 'II', 'III', 'IV']
export const PROFICIENCIAS = ['', 'Simples', 'Táticas', 'Pesadas']
export const EMPUNHADURAS = ['', 'Leve', 'Uma mão', 'Duas mãos']

export function resumoItem(i: ItemBiblioteca): string {
  const partes = [i.tipo, `Cat. ${CATEGORIAS[i.categoria]}`, `${i.espacos} espaço${i.espacos === 1 ? '' : 's'}`]
  if (i.dano) partes.push(`${i.dano}${i.critico ? ` ${i.critico}` : ''}`)
  if (i.tipo === 'Proteção' && i.defesa) partes.push(`Defesa +${i.defesa}`)
  if (i.elemento) partes.push(i.elemento)
  return partes.join(' · ')
}

export function BlocoItem({ i, fonte }: { i: ItemBiblioteca; fonte?: string }) {
  const arma = [
    ['Proficiência', i.proficiencia],
    ['Empunhadura', i.empunhadura],
    ['Dano', i.dano],
    ['Crítico', i.critico],
    ['Alcance', i.alcance],
    ['Tipo', i.tipoDano]
  ].filter(([, v]) => v)
  return (
    <article className="flex flex-col gap-3 text-sm" aria-label={`Item ${i.nome}`}>
      <header className="flex items-start justify-between gap-3">
        <h2 className="type-lg">{i.nome}</h2>
        <span className="shrink-0 text-xs font-semibold tracking-wider text-muted uppercase">
          {i.tipo}
          {i.elemento && ` · ${i.elemento}`}
        </span>
      </header>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['Categoria', CATEGORIAS[i.categoria]],
          ['Espaços', String(i.espacos)],
          ...(i.tipo === 'Proteção' ? [['Defesa', `+${i.defesa}`]] : [])
        ].map(([r, v]) => (
          <div key={r} className="rounded-md bg-surface-raised px-1 py-1 text-center">
            <div className="font-mono text-sm font-semibold">{v}</div>
            <div className="text-[10px] tracking-wider text-subtle uppercase">{r}</div>
          </div>
        ))}
      </div>
      {arma.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted">
          {arma.map(([r, v]) => (
            <div key={r}>
              <dt className="inline font-semibold text-fg">{r}:</dt> <dd className="inline">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {i.descricao && <p className="whitespace-pre-line">{i.descricao}</p>}
      {fonte && (
        <p className="text-xs text-subtle">
          {fonte}
          {i.pagina > 0 && `, p. ${i.pagina}`}
        </p>
      )}
    </article>
  )
}

export function EditorItem({ i, aoMudar }: { i: ItemBiblioteca; aoMudar: (p: Partial<ItemBiblioteca>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Escolha rotulo="Tipo" valor={i.tipo} opcoes={[...TIPOS_ITEM]} aoMudar={(tipo) => aoMudar({ tipo })} />
        <Escolha rotulo="Categoria" valor={String(i.categoria)} opcoes={CATEGORIAS.map((c, n) => ({ valor: String(n), texto: c }))} aoMudar={(c) => aoMudar({ categoria: Number(c) })} />
        <Numero rotulo="Espaços" valor={i.espacos} min={0} aoMudar={(espacos) => aoMudar({ espacos: Math.max(0, espacos) })} />
        <Numero rotulo="Página" valor={i.pagina} min={0} aoMudar={(pagina) => aoMudar({ pagina: Math.max(0, pagina) })} />
        {i.tipo === 'Proteção' && <Numero rotulo="Defesa" valor={i.defesa} aoMudar={(defesa) => aoMudar({ defesa })} />}
        {i.tipo === 'Amaldiçoado' && <Escolha rotulo="Elemento" valor={i.elemento} opcoes={['', ...ELEMENTOS]} aoMudar={(elemento) => aoMudar({ elemento })} />}
      </div>
      {(i.tipo === 'Arma' || i.dano) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Escolha rotulo="Proficiência" valor={i.proficiencia} opcoes={PROFICIENCIAS} aoMudar={(proficiencia) => aoMudar({ proficiencia })} />
          <Escolha rotulo="Empunhadura" valor={i.empunhadura} opcoes={EMPUNHADURAS} aoMudar={(empunhadura) => aoMudar({ empunhadura })} />
          <Escolha rotulo="Tipo de dano" valor={i.tipoDano} opcoes={['', ...TIPOS_DANO]} livre aoMudar={(tipoDano) => aoMudar({ tipoDano })} />
          <Texto rotulo="Dano" valor={i.dano} placeholder="1d8" aoMudar={(dano) => aoMudar({ dano })} />
          <Texto rotulo="Crítico" valor={i.critico} placeholder="19/x3" aoMudar={(critico) => aoMudar({ critico })} />
          <Texto rotulo="Alcance" valor={i.alcance} placeholder="curto" aoMudar={(alcance) => aoMudar({ alcance })} />
        </div>
      )}
      <AreaTexto rotulo="Descrição" valor={i.descricao} linhas={6} aoMudar={(descricao) => aoMudar({ descricao })} />
    </div>
  )
}
