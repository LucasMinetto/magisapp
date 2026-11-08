// Estado do combate da sessão de jogo (T10): ordem de iniciativa, rodada, vez e o PV/condições de cada combatente.
// Fica salvo na sessão de jogo (fecha e reabre a campanha e continua). A tela do combate está em Combate.tsx.
import { useEffect, useRef, useState } from 'react'
import type { Iniciativa } from '@shared/ordem/esquemas'
import { nomeDaCopia, SEM_COMBATE } from '@shared/ordem/sessao'
import type { Entity } from '@shared/types'
import { useCampaign } from '@/campaign'
import { useAutosave, useLoad } from '@/lib/data'
import { blocoDe } from './rolagens'

const novoId = () => crypto.randomUUID()

/** O estado do combate da sessão, com salvamento automático. */
export function useIniciativa(sessionId: string | null) {
  const { version, changed } = useCampaign()
  const loaded = useLoad(() => (sessionId ? window.api.sessions.initiative(sessionId) : Promise.resolve(SEM_COMBATE)), [sessionId, version])
  const [ini, setIni] = useState<Iniciativa>(SEM_COMBATE)
  const editando = useRef(false)
  // O valor mais novo, para quem chega depois de um await (pôr fichas que ainda estavam carregando).
  const atual = useRef(ini)
  atual.current = ini
  const autosave = useAutosave(async (v: { id: string; initiative: Iniciativa }) => {
    await window.api.sessions.saveInitiative(v)
    editando.current = false
    changed()
  }, 300)
  // O que veio do banco só entra quando não há mudança esperando para salvar (senão apagaria o que o mestre digitou).
  useEffect(() => {
    if (loaded.data && !editando.current) setIni(loaded.data)
  }, [loaded.data])

  /** Muda só um combatente (PV, valor, condições), partindo do estado mais novo. */
  const mudar = (id: string, patch: Partial<Iniciativa['ordem'][number]>) => {
    const agora = atual.current
    alterar({ ...agora, ordem: agora.ordem.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  }

  const alterar = (next: Iniciativa) => {
    if (!sessionId) return
    editando.current = true
    atual.current = next
    setIni(next)
    autosave.schedule({ id: sessionId, initiative: next })
  }

  /** Põe uma ficha na ordem. Agente entra uma vez; cada ameaça entra de novo como cópia, com PV cheio. */
  const adicionar = (lista: Entity[]) => {
    const agora = atual.current
    let ordem = agora.ordem
    for (const e of lista) {
      const bloco = blocoDe(e)
      if (e.kind === 'ameaca') {
        const pv = bloco?.pv ?? 0
        ordem = [
          ...ordem,
          {
            id: novoId(),
            entityId: e.id,
            nome: nomeDaCopia(ordem, e.name),
            valor: 0,
            pv: { atual: pv, max: pv },
            condicoes: []
          }
        ]
      } else if (!ordem.some((c) => c.entityId === e.id)) {
        ordem = [...ordem, { id: novoId(), entityId: e.id, nome: e.name, valor: 0, pv: null, condicoes: [] }]
      }
    }
    alterar({ ...agora, ordem })
  }

  return { ini, alterar, mudar, adicionar, autosave, error: loaded.error }
}

export type Combate = ReturnType<typeof useIniciativa>
