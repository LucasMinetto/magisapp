// Aba Rituais: rituais conhecidos, com DT, custo e dano por forma. Portado do taberna (web/src/ficha/Rituais.tsx).
// Trazer um ritual da biblioteca é a T9 (library:copyToCampaign); aqui a origem só aparece.
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ELEMENTOS, type RitualDaFicha } from '@shared/ordem/esquemas'
import { CUSTO_CIRCULO, TIPOS_DANO } from '@shared/ordem/regras'
import { Button } from '@/ui'
import { novoId, useFicha } from './contexto'
import { AreaTexto, Escolha, Secao, Texto, Vazio } from './partes'

const VAZIO: Omit<RitualDaFicha, 'id'> = {
  nome: 'Novo ritual',
  elemento: '',
  circulo: 1,
  execucao: 'padrão',
  alcance: '',
  alvo: '',
  duracao: '',
  resistencia: '',
  efeito: '',
  discente: '',
  verdadeiro: '',
  danoNormal: '',
  danoDiscente: '',
  danoVerdadeiro: '',
  tipoDano: ''
}

const ROMANO = ['', 'I', 'II', 'III', 'IV']

export function Rituais() {
  const { a, alterar, d, rolar } = useFicha()
  const [editando, setEditando] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [elemento, setElemento] = useState('')
  const mudar = (id: string, patch: Partial<RitualDaFicha>) => alterar({ rituais: a.rituais.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const visiveis = a.rituais.filter((r) => !elemento || r.elemento === elemento).sort((x, y) => x.circulo - y.circulo || x.nome.localeCompare(y.nome))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
        <span className="text-sm text-muted">DT dos rituais</span>
        <span className="font-serif text-3xl font-semibold">{d.dtRitual}</span>
      </div>
      <Secao
        titulo="Rituais conhecidos"
        acoes={
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="size-4" />}
            onClick={() => {
              const r = { ...VAZIO, id: novoId() }
              alterar({ rituais: [...a.rituais, r] })
              setEditando(r.id)
            }}
          >
            Ritual
          </Button>
        }
      >
        {a.rituais.length > 0 && (
          <Escolha rotulo="Elemento" valor={elemento} opcoes={[{ valor: '', texto: 'Todos os elementos' }, ...ELEMENTOS]} aoMudar={setElemento} className="w-52" />
        )}
        {a.rituais.length === 0 && <Vazio>Nenhum ritual conhecido.</Vazio>}
        <ul className="flex flex-col gap-2">
          {visiveis.map((r) => {
            const custo = CUSTO_CIRCULO[r.circulo] ?? 0
            const formas = [
              { nome: 'Normal', expressao: r.danoNormal },
              { nome: 'Discente', expressao: r.danoDiscente },
              { nome: 'Verdadeiro', expressao: r.danoVerdadeiro }
            ].filter((f) => f.expressao.trim())
            const opcoes = formas.map((f) => ({ nome: f.nome, partes: [{ expressao: f.expressao, tipo: r.tipoDano }] }))

            if (editando === r.id)
              return (
                <li key={r.id}>
                  <EditorRitual
                    r={r}
                    aoMudar={(p) => mudar(r.id, p)}
                    aoFechar={() => setEditando(null)}
                    aoRemover={() => {
                      if (window.confirm(`Esquecer o ritual ${r.nome}?`)) alterar({ rituais: a.rituais.filter((x) => x.id !== r.id) })
                    }}
                  />
                </li>
              )

            return (
              <li key={r.id} className="rounded-md border border-border bg-surface p-3">
                <button type="button" aria-expanded={aberto === r.id} className="flex w-full items-center gap-2 text-left" onClick={() => setAberto(aberto === r.id ? null : r.id)}>
                  <span className="w-6 font-serif text-sm font-semibold text-subtle" title={`${r.circulo}º círculo`}>
                    {ROMANO[r.circulo]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.nome}</span>
                  {r.elemento && <span className="text-xs text-muted">{r.elemento}</span>}
                  <span className="text-xs text-warning">{custo} PE</span>
                </button>
                {formas.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {formas.map((f) => (
                      <div key={f.nome} className="flex-1 rounded-md bg-surface-raised px-1 py-1 text-center">
                        <div className="font-mono text-xs font-semibold">{f.expressao}</div>
                        <div className="text-[10px] tracking-wider text-subtle uppercase">{f.nome}</div>
                      </div>
                    ))}
                  </div>
                )}
                {aberto === r.id && (
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
                      {r.execucao && <span><b className="text-fg">Execução:</b> {r.execucao}</span>}
                      {r.alcance && <span><b className="text-fg">Alcance:</b> {r.alcance}</span>}
                      {r.alvo && <span><b className="text-fg">Alvo:</b> {r.alvo}</span>}
                      {r.duracao && <span><b className="text-fg">Duração:</b> {r.duracao}</span>}
                      {r.resistencia && <span className="col-span-2"><b className="text-fg">Resistência:</b> {r.resistencia}</span>}
                    </div>
                    {r.efeito && <p className="whitespace-pre-line">{r.efeito}</p>}
                    {r.discente && <p className="text-muted"><b className="text-fg">Discente:</b> {r.discente}</p>}
                    {r.verdadeiro && <p className="text-muted"><b className="text-fg">Verdadeiro:</b> {r.verdadeiro}</p>}
                    {r.origem && <p className="text-xs text-subtle">Da biblioteca: {r.origem.sourceName}</p>}
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditando(r.id)}>
                    Editar
                  </Button>
                  {rolar && (
                    <Button size="sm" variant="primary" onClick={() => rolar({ rotulo: r.nome, tipo: 'ritual', custoPe: custo, dano: opcoes.length ? { opcoes } : undefined })}>
                      Conjurar
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Secao>
    </div>
  )
}

function EditorRitual({ r, aoMudar, aoFechar, aoRemover }: { r: RitualDaFicha; aoMudar: (p: Partial<RitualDaFicha>) => void; aoFechar: () => void; aoRemover: () => void }) {
  const t = (campo: 'nome' | 'execucao' | 'alcance' | 'alvo' | 'duracao' | 'resistencia' | 'danoNormal' | 'danoDiscente' | 'danoVerdadeiro', rotulo: string, placeholder = '') => (
    <Texto rotulo={rotulo} valor={r[campo]} placeholder={placeholder} aoMudar={(v) => aoMudar({ [campo]: v })} />
  )
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-input bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">{t('nome', 'Nome')}</div>
        <Escolha rotulo="Elemento" valor={r.elemento} opcoes={['', ...ELEMENTOS]} aoMudar={(elemento) => aoMudar({ elemento })} />
        <Escolha
          rotulo="Círculo"
          valor={String(r.circulo)}
          opcoes={['1', '2', '3', '4'].map((c) => ({ valor: c, texto: `${c}º círculo` }))}
          aoMudar={(c) => aoMudar({ circulo: Number(c) })}
        />
        {t('execucao', 'Execução', 'padrão')}
        {t('alcance', 'Alcance', 'curto')}
        {t('alvo', 'Alvo ou área', '1 ser')}
        {t('duracao', 'Duração', 'cena')}
        <div className="col-span-2">{t('resistencia', 'Resistência', 'Vontade anula')}</div>
        {t('danoNormal', 'Dano normal', '3d8+3')}
        {t('danoDiscente', 'Dano discente', '5d8+5')}
        {t('danoVerdadeiro', 'Dano verdadeiro', '7d8+7')}
        <Escolha rotulo="Tipo de dano" valor={r.tipoDano} opcoes={['', ...TIPOS_DANO]} aoMudar={(tipoDano) => aoMudar({ tipoDano })} />
      </div>
      <AreaTexto rotulo="Efeito" valor={r.efeito} aoMudar={(efeito) => aoMudar({ efeito })} />
      <AreaTexto rotulo="Discente" valor={r.discente} linhas={1} aoMudar={(discente) => aoMudar({ discente })} />
      <AreaTexto rotulo="Verdadeiro" valor={r.verdadeiro} linhas={1} aoMudar={(verdadeiro) => aoMudar({ verdadeiro })} />
      <div className="flex justify-between">
        <Button size="sm" variant="danger" onClick={aoRemover}>
          Remover
        </Button>
        <Button size="sm" onClick={aoFechar}>
          Pronto
        </Button>
      </div>
    </div>
  )
}
