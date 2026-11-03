import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildMatcher, type Matcher } from '@shared/mentions'
import type { Campaign, MentionTargetDTO } from '@shared/types'

interface CampaignState {
  campaign: Campaign | null
  setCampaign: (c: Campaign | null) => void
  /** Sobe a cada gravação: listas e contadores recarregam quando muda. */
  version: number
  changed: () => void
  targets: MentionTargetDTO[]
  matcher: Matcher
}

const Ctx = createContext<CampaignState | null>(null)

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)
  const [targets, setTargets] = useState<MentionTargetDTO[]>([])

  useEffect(() => {
    window.api.campaign
      .current()
      .then(setCampaign)
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!campaign) return setTargets([])
    window.api.entities.mentionTargets().then(setTargets).catch(() => setTargets([]))
  }, [campaign, version])

  const changed = useCallback(() => setVersion((v) => v + 1), [])
  const matcher = useMemo(() => buildMatcher(targets), [targets])

  if (!ready) return null
  return <Ctx.Provider value={{ campaign, setCampaign, version, changed, targets, matcher }}>{children}</Ctx.Provider>
}

export function useCampaign(): CampaignState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCampaign fora do CampaignProvider')
  return ctx
}

/** A campanha aberta. Só usar dentro do Shell, onde ela sempre existe. */
export function useOpenCampaign(): Campaign {
  const { campaign } = useCampaign()
  if (!campaign) throw new Error('Nenhuma campanha aberta')
  return campaign
}

/** Relógio do jogo: avança ou define a hora e atualiza a barra de cima e as listas. */
export function useClock() {
  const { setCampaign, changed } = useCampaign()
  const apply = useCallback(
    async (next: Promise<Campaign>) => {
      setCampaign(await next)
      changed()
    },
    [setCampaign, changed]
  )
  return {
    advance: useCallback((minutes: number) => apply(window.api.clock.advance(minutes)), [apply]),
    set: useCallback((minute: number) => apply(window.api.clock.set(minute)), [apply])
  }
}
