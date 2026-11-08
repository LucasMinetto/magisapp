// Ritual da biblioteca (T9): leitura no formato do livro e formulário.
import { ELEMENTOS, type RitualBiblioteca } from '@shared/ordem/esquemas'
import { CUSTO_CIRCULO, TIPOS_DANO } from '@shared/ordem/regras'
import { AreaTexto, Escolha, Numero, Texto } from '@/ficha/partes'

export const ROMANO = ['', 'I', 'II', 'III', 'IV']
export const ALVO_TIPOS = ['Alvo', 'Área', 'Efeito'] as const

export function BlocoRitual({ r, fonte }: { r: RitualBiblioteca; fonte?: string }) {
  const linha = (rotulo: string, valor: string) =>
    valor ? (
      <p>
        <b>{rotulo}:</b> {valor}
      </p>
    ) : null
  const danos = [
    ['Normal', r.danoNormal],
    ['Discente', r.danoDiscente],
    ['Verdadeiro', r.danoVerdadeiro]
  ].filter(([, d]) => d.trim())
  return (
    <article className="flex flex-col gap-3 text-sm" aria-label={`Ritual ${r.nome}`}>
      <header className="flex items-start justify-between gap-3">
        <h2 className="type-lg">{r.nome}</h2>
        <span className="shrink-0 text-right text-xs font-semibold tracking-wider text-muted uppercase">
          {r.elemento || 'Sem elemento'} {r.circulo}
          <span className="block font-normal normal-case text-warning">{CUSTO_CIRCULO[r.circulo] ?? 0} PE</span>
        </span>
      </header>
      <div className="flex flex-col gap-0.5 text-muted [&_b]:text-fg">
        {linha('Execução', r.execucao)}
        {linha('Alcance', r.alcance)}
        {linha(r.alvoTipo, r.alvo)}
        {linha('Duração', r.duracao)}
        {linha('Resistência', r.resistencia)}
      </div>
      {r.efeito && <p className="whitespace-pre-line">{r.efeito}</p>}
      {r.discente && (
        <p className="whitespace-pre-line text-muted">
          <b className="text-fg">Discente:</b> {r.discente}
        </p>
      )}
      {r.verdadeiro && (
        <p className="whitespace-pre-line text-muted">
          <b className="text-fg">Verdadeiro:</b> {r.verdadeiro}
        </p>
      )}
      {danos.length > 0 && (
        <div className="flex gap-1.5">
          {danos.map(([nome, d]) => (
            <div key={nome} className="flex-1 rounded-md bg-surface-raised px-1 py-1 text-center">
              <div className="font-mono text-xs font-semibold">
                {d} {r.tipoDano}
              </div>
              <div className="text-[10px] tracking-wider text-subtle uppercase">{nome}</div>
            </div>
          ))}
        </div>
      )}
      {fonte && (
        <p className="text-xs text-subtle">
          {fonte}
          {r.pagina > 0 && `, p. ${r.pagina}`}
        </p>
      )}
    </article>
  )
}

export function EditorRitual({ r, aoMudar }: { r: RitualBiblioteca; aoMudar: (p: Partial<RitualBiblioteca>) => void }) {
  type Campo = 'execucao' | 'alcance' | 'alvo' | 'duracao' | 'resistencia' | 'danoNormal' | 'danoDiscente' | 'danoVerdadeiro'
  const t = (campo: Campo, rotulo: string, placeholder = '') => <Texto rotulo={rotulo} valor={r[campo]} placeholder={placeholder} aoMudar={(v) => aoMudar({ [campo]: v })} />
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Escolha rotulo="Elemento" valor={r.elemento} opcoes={['', ...ELEMENTOS]} aoMudar={(elemento) => aoMudar({ elemento })} />
        <Escolha
          rotulo="Círculo"
          valor={String(r.circulo)}
          opcoes={['1', '2', '3', '4'].map((c) => ({ valor: c, texto: `${c}º círculo` }))}
          aoMudar={(c) => aoMudar({ circulo: Number(c) })}
        />
        <Numero rotulo="Página" valor={r.pagina} min={0} aoMudar={(pagina) => aoMudar({ pagina: Math.max(0, pagina) })} />
        {t('execucao', 'Execução', 'padrão')}
        {t('alcance', 'Alcance', 'curto')}
        {t('duracao', 'Duração', 'cena')}
        <Escolha rotulo="Alvo, área ou efeito" valor={r.alvoTipo} opcoes={[...ALVO_TIPOS]} aoMudar={(v) => aoMudar({ alvoTipo: v as RitualBiblioteca['alvoTipo'] })} />
        <div className="sm:col-span-2">{t('alvo', r.alvoTipo, '1 ser')}</div>
        <div className="sm:col-span-3">{t('resistencia', 'Resistência', 'Vontade anula')}</div>
      </div>
      <AreaTexto rotulo="Efeito" valor={r.efeito} linhas={6} aoMudar={(efeito) => aoMudar({ efeito })} />
      <AreaTexto rotulo="Discente" valor={r.discente} linhas={2} aoMudar={(discente) => aoMudar({ discente })} />
      <AreaTexto rotulo="Verdadeiro" valor={r.verdadeiro} linhas={2} aoMudar={(verdadeiro) => aoMudar({ verdadeiro })} />
      <div className="grid gap-3 sm:grid-cols-4">
        {t('danoNormal', 'Dano normal', '3d8+3')}
        {t('danoDiscente', 'Dano discente', '5d8+5')}
        {t('danoVerdadeiro', 'Dano verdadeiro', '7d8+7')}
        <Escolha rotulo="Tipo de dano" valor={r.tipoDano} opcoes={['', ...TIPOS_DANO]} aoMudar={(tipoDano) => aoMudar({ tipoDano })} />
      </div>
    </div>
  )
}
