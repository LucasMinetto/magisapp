// Bloco de estatísticas de uma ameaça no formato do livro de regras (portado de taberna/web/src/componentes/BlocoAmeaca.tsx).
import type { ReactNode } from 'react'
import { Chip } from '@/ui'
import type { Acao, BlocoAmeaca as Bloco } from '@shared/ordem/esquemas'

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  if (children === '' || children === null || children === undefined || children === false) return null
  return (
    <div className="text-sm">
      <span className="font-semibold tracking-wide uppercase">{rotulo} </span>
      <span className="text-muted">{children}</span>
    </div>
  )
}

function ListaAcoes({ titulo, acoes }: { titulo: string; acoes: Acao[] }) {
  const validas = acoes.filter((a) => a.nome || a.descricao)
  if (!validas.length) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="border-b border-border pb-0.5 text-xs font-semibold tracking-widest uppercase">{titulo}</div>
      {validas.map((a, i) => (
        <div key={i} className="text-sm leading-snug">
          {a.tipo && <span className="mr-1.5 rounded-sm bg-surface-raised px-1.5 py-0.5 text-xs font-semibold uppercase">{a.tipo}</span>}
          <b className="uppercase">{a.nome}</b>
          {a.descricao && <span className="whitespace-pre-line text-muted"> {a.descricao}</span>}
        </div>
      ))}
    </div>
  )
}

/** `nome` aparece no topo com o VD; `compacto` tira o topo, o PV e a descrição (a Sessão mostra isso fora). */
export function BlocoAmeaca({ a, nome, compacto }: { a: Bloco; nome?: string; compacto?: boolean }) {
  const presenca = a.presencaDt
    ? `DT ${a.presencaDt}${a.presencaDano ? ` · ${a.presencaDano}` : ''}${a.presencaNexImune ? ` · NEX ${a.presencaNexImune} é imune` : ''}`
    : ''
  const testes = [a.fortitude && `Fortitude ${a.fortitude}`, a.reflexos && `Reflexos ${a.reflexos}`, a.vontade && `Vontade ${a.vontade}`].filter(Boolean).join(' · ')
  const sentidos = [a.percepcao && `Percepção ${a.percepcao}`, a.iniciativa && `Iniciativa ${a.iniciativa}`, a.sentidos].filter(Boolean).join(' · ')
  const tipo = [a.tipo, a.tamanho].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-3" aria-label={nome ? `Bloco de ${nome}` : 'Bloco da ameaça'}>
      {!compacto && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-accent pb-1">
          <div className="type-xl uppercase">{nome || 'Sem nome'}</div>
          <div className="font-mono text-lg font-semibold">VD {a.vd}</div>
        </div>
      )}
      {(a.elemento || tipo || a.deslocamento) && (
        <div className="flex flex-wrap items-center gap-2 text-xs tracking-wider text-muted uppercase">
          {a.elemento && <Chip>{a.elemento}</Chip>}
          {tipo}
          {a.deslocamento && <span>· Deslocamento {a.deslocamento}</span>}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Linha rotulo="Presença Perturbadora">{presenca}</Linha>
        <Linha rotulo="Sentidos">{sentidos}</Linha>
        <Linha rotulo="Defesa">{a.defesa ? `${a.defesa}${testes ? ` · ${testes}` : ''}` : testes}</Linha>
        {!compacto && <Linha rotulo="Pontos de Vida">{a.pv ? `${a.pv}${a.pvMachucado ? ` · ${a.pvMachucado} machucado` : ''}` : ''}</Linha>}
        <Linha rotulo="Resistências">{a.resistencias}</Linha>
        <Linha rotulo="Vulnerabilidades">{a.vulnerabilidades}</Linha>
        <Linha rotulo="Imunidades">{a.imunidades}</Linha>
        <Linha rotulo="Atributos">{`AGI ${a.agi} · FOR ${a.for} · INT ${a.int} · PRE ${a.pre} · VIG ${a.vig}`}</Linha>
        <Linha rotulo="Perícias">{a.pericias}</Linha>
      </div>
      <ListaAcoes titulo="Habilidades" acoes={a.habilidades} />
      <ListaAcoes titulo="Ações" acoes={a.acoes} />
      <Linha rotulo="Enigma de Medo">{a.enigma}</Linha>
      {!compacto && a.descricao && <p className="font-serif text-sm whitespace-pre-line text-muted italic">{a.descricao}</p>}
    </div>
  )
}
