// N03 Sessão: a tela que fica aberta durante o jogo. Modo cena (cena, grupo, pistas, notas, NPCs) e modo combate
// (T10 e T10b: iniciativa com tudo de cada combatente num cartão).
import { Clapperboard, Dices, FileQuestion, MapPin, Plus, SearchCheck, Swords, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import type { Clue, GameSession, SceneSummary } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { SceneEditor } from '@/editor/SceneEditor'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, EmptyState, ErrorNote, SaveIndicator } from '@/ui'
import { Abas } from '@/ficha/partes'
import { ComecarCombate, ModoCombate } from '@/sessao/Combate'
import { FaixaGrupo } from '@/sessao/Grupo'
import { useIniciativa } from '@/sessao/Iniciativa'
import { NaCena } from '@/sessao/NaCena'
import { SceneMaterial } from './Material'
import { SceneNotes } from './SceneNotes'
import { GameClock } from './Timeline'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sessionLabel = (s: GameSession) => `Sessão ${s.number}${s.playedOn ? ` · ${s.playedOn.slice(8)}/${s.playedOn.slice(5, 7)}` : ''}`

/** A cena "de agora": a que contém a hora do relógio; senão a próxima planejada; senão a última. */
function currentScene(scenes: SceneSummary[], now: number): SceneSummary | undefined {
  const timed = scenes.filter((s) => s.gameMinuteStart !== null)
  return (
    timed.find((s) => s.gameMinuteStart! <= now && now <= (s.gameMinuteEnd ?? s.gameMinuteStart!)) ??
    timed.find((s) => s.status === 'planejada' && s.gameMinuteStart! >= now) ??
    timed.at(-1) ??
    scenes[0]
  )
}

// ------------------------------------------------------------ pistas da cena

function ClueRow({ clue, sessionId }: { clue: Clue; sessionId: string | null }) {
  const campaign = useOpenCampaign()
  const { changed } = useCampaign()
  const [error, setError] = useState<string | null>(null)
  const save = async (found: boolean) => {
    try {
      await window.api.clues.save({
        id: clue.id,
        title: clue.title,
        description: clue.description,
        reveals: clue.reveals,
        status: found ? 'achada' : 'oculta',
        imageId: clue.image?.id ?? null,
        plannedSceneId: clue.plannedSceneId,
        locationId: clue.locationId,
        foundGameMinute: found ? campaign.currentGameMinute : null,
        foundSessionId: found ? sessionId : null,
        finderIds: found ? clue.finders.map((f) => f.id) : []
      })
      setError(null)
      changed()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-bg">
        {clue.image ? (
          <img src={clue.image.url} alt={clue.title} className="size-full object-cover" />
        ) : (
          <FileQuestion className="size-5 text-subtle" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <Link to={`/pistas?pista=${clue.id}`} className="block truncate text-sm font-semibold hover:underline">
          {clue.title || 'Sem título'}
        </Link>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {clue.status === 'oculta' ? (
            <span>{clue.locationName ?? 'sem lugar'}</span>
          ) : (
            <>
              <Chip tone={clue.status === 'achada' ? 'found' : 'understood'}>{clue.status === 'achada' ? 'Achada' : 'Entendida'}</Chip>
              {clue.foundGameMinute !== null && <span className="font-mono">{formatGameTime(campaign.epochDate, clue.foundGameMinute)}</span>}
              {clue.foundSessionNumber !== null && <span>sessão {clue.foundSessionNumber}</span>}
            </>
          )}
        </span>
        {error && <span className="block text-xs text-danger">{error}</span>}
      </span>
      {clue.status === 'oculta' ? (
        <Button
          size="sm"
          variant="primary"
          icon={<SearchCheck className="size-4" />}
          onClick={() => void save(true)}
          aria-label={`Achada agora: ${clue.title}`}
        >
          Achada
        </Button>
      ) : (
        clue.status === 'achada' && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Undo2 className="size-4" />}
            onClick={() => void save(false)}
            aria-label={`Desfazer: ${clue.title} volta a oculta`}
            title="Desfazer: volta a oculta"
          />
        )
      )}
    </li>
  )
}

// ------------------------------------------------------------ notas da sessão

function Notes({ sessionId }: { sessionId: string }) {
  const { changed } = useCampaign()
  const loaded = useLoad(() => window.api.sessions.get(sessionId), [sessionId])
  const autosave = useAutosave(async (notes: string) => {
    await window.api.sessions.saveNotes({ id: sessionId, notes })
    changed()
  })
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />
  if (!loaded.data) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="type-label text-muted">Notas da sessão {loaded.data.number}</h2>
        <SaveIndicator state={autosave.state} error={autosave.error} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface px-4 py-3 [&_.ProseMirror]:min-h-40 [&_.ProseMirror]:text-base">
        <SceneEditor
          key={sessionId}
          initial={loaded.data.notes}
          label={`Notas da sessão ${loaded.data.number}`}
          placeholder="O que aconteceu, decisões dos jogadores, ganchos para a próxima."
          onChange={(json) => autosave.schedule(json)}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------ tela

type Aba = 'pistas' | 'notas' | 'npcs'

/**
 * Dois modos (T10b). Cena: topo numa linha, faixa do grupo, a cena larga e abas ao lado (pistas, notas, NPCs).
 * Combate: começa por "Começar combate" e ocupa a tela até "Encerrar combate"; "Ver a cena" volta à cena sem encerrar.
 */
export function Session() {
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const [params, setParams] = useSearchParams()
  const timeline = useLoad(() => window.api.timeline.list(), [version])
  const sessions = useLoad(() => window.api.sessions.list(), [version])
  const clues = useLoad(() => window.api.clues.list(), [version])
  const personagens = useLoad(() => window.api.entities.list({ kind: 'personagem' }), [version])
  const [aba, setAba] = useState<Aba>('pistas')
  const [verCena, setVerCena] = useState(false)
  const [comecando, setComecando] = useState(false)

  const sessionId = params.get('s') ?? sessions.data?.at(-1)?.id ?? null
  const scenes = timeline.data?.scenes ?? []
  const auto = currentScene(scenes, campaign.currentGameMinute)
  const sceneId = params.get('cena') ?? auto?.id ?? null
  const scene = useLoad(() => (sceneId ? window.api.scenes.get(sceneId) : Promise.resolve(null)), [sceneId, version])
  const combate = useIniciativa(sessionId)
  const emCombate = combate.ini.ordem.length > 0

  const set = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const start = async () => {
    const s = await window.api.sessions.create({ playedOn: today() })
    changed()
    set('s', s.id)
  }
  const markPlayed = async () => {
    if (!scene.data) return
    const { mentions: _m, locationName: _l, sort: _s, summaryText: _t, attachments: _a, notes: _n, ...input } = scene.data
    await window.api.scenes.save({ ...input, status: 'jogada' })
    changed()
  }

  const jogadores = (personagens.data ?? []).filter((p) => p.isPlayer)
  const ehJogador = new Set(jogadores.map((j) => j.id))
  const people = (scene.data?.mentions ?? []).filter((m) => m.kind === 'personagem' || m.kind === 'ameaca')
  const npcs = people.filter((p) => !ehJogador.has(p.id))
  const sceneClues = useMemo(
    () =>
      (clues.data ?? []).filter(
        (c) => scene.data && (c.plannedSceneId === scene.data.id || (scene.data.locationId !== null && c.locationId === scene.data.locationId))
      ),
    [clues.data, scene.data]
  )
  const abas: { id: Aba; texto: string }[] = [
    { id: 'pistas', texto: `Pistas${sceneClues.length ? ` ${sceneClues.length}` : ''}` },
    { id: 'notas', texto: 'Notas' },
    { id: 'npcs', texto: `NPCs${npcs.length ? ` ${npcs.length}` : ''}` }
  ]
  const erro = timeline.error || sessions.error || clues.error

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-6 py-4">
      <h1 className="sr-only">Sessão</h1>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2">
        <span className="flex items-center gap-1">
          <label className="sr-only" htmlFor="session-pick">
            Sessão
          </label>
          <select
            id="session-pick"
            value={sessionId ?? ''}
            onChange={(e) => set('s', e.target.value || null)}
            className="h-8 rounded-md border border-border-input bg-bg px-2 text-sm font-semibold text-fg focus:border-focus"
          >
            {!sessions.data?.length && <option value="">Nenhuma sessão</option>}
            {sessions.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => void start()} title="Começar a sessão de hoje">
            Começar sessão {(sessions.data?.length ?? 0) + 1}
          </Button>
        </span>
        <GameClock compacto scenes={scenes} events={timeline.data?.events ?? []} />
        <span className="flex-1" />
        {emCombate ? (
          verCena && (
            <Button variant="primary" icon={<Swords className="size-4" />} onClick={() => setVerCena(false)}>
              Voltar ao combate
            </Button>
          )
        ) : (
          <Button
            variant="primary"
            icon={<Swords className="size-4" />}
            disabled={!sessionId}
            title={sessionId ? undefined : 'Comece a sessão de hoje primeiro'}
            onClick={() => setComecando(true)}
          >
            Começar combate
          </Button>
        )}
      </header>
      {erro && <ErrorNote message={erro} />}

      {emCombate && !verCena ? (
        <ModoCombate combate={combate} sessionId={sessionId} aoVerCena={() => setVerCena(true)} />
      ) : (
        <>
          <FaixaGrupo jogadores={jogadores} />
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-5">
            <section aria-labelledby="now-scene-h" className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
              {!scene.data && scenes.length === 0 && (
                <Card>
                  <EmptyState icon={<Clapperboard />} title="Nenhuma cena" text="Crie as cenas da aventura com hora no jogo e elas aparecem aqui na ordem." />
                </Card>
              )}
              {scenes.length > 0 && (
                <Card className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 id="now-scene-h" className="type-label text-muted">
                        Cena atual
                      </h2>
                      <div className="type-lg truncate">{scene.data?.title || 'Sem título'}</div>
                      {scene.data && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          {scene.data.gameMinuteStart !== null && (
                            <span className="font-mono">{formatGameTime(campaign.epochDate, scene.data.gameMinuteStart)}</span>
                          )}
                          {scene.data.locationName && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden />
                              {scene.data.locationName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <select
                      aria-label="Escolher a cena"
                      value={sceneId ?? ''}
                      onChange={(e) => set('cena', e.target.value || null)}
                      className="h-8 max-w-56 rounded-md border border-border-input bg-bg px-2 text-sm text-fg focus:border-focus"
                    >
                      {scenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.gameMinuteStart === null ? '' : `${formatGameTime(campaign.epochDate, s.gameMinuteStart)} · `}
                          {s.title || 'Sem título'}
                          {s.id === auto?.id ? ' (agora)' : ''}
                        </option>
                      ))}
                    </select>
                    {scene.data &&
                      (scene.data.status === 'jogada' ? (
                        <Chip tone="success">Jogada</Chip>
                      ) : (
                        <Button size="sm" onClick={() => void markPlayed()}>
                          Marcar como jogada
                        </Button>
                      ))}
                    {scene.data && (
                      <Link to={`/cenas/${scene.data.id}`} className="pt-1.5 text-xs text-subtle hover:text-fg hover:underline">
                        editar
                      </Link>
                    )}
                  </div>
                  {scene.data && (
                    <SceneEditor
                      key={`${scene.data.id}:${version}`}
                      readOnly
                      initial={scene.data.body}
                      label={`Texto da cena ${scene.data.title}`}
                      onChange={() => {}}
                    />
                  )}
                </Card>
              )}
              {scene.data && (
                <>
                  <SceneMaterial readOnly sceneId={scene.data.id} items={scene.data.attachments} onChange={scene.reload} />
                  <SceneNotes readOnly sceneId={scene.data.id} notes={scene.data.notes} onChange={scene.reload} />
                </>
              )}
            </section>

            <section aria-label="Pistas, notas e NPCs" className="flex min-h-0 flex-col gap-3">
              <Abas rotulo="Painel da sessão" abas={abas} atual={aba} aoMudar={setAba} />
              <div role="tabpanel" aria-label={abas.find((a) => a.id === aba)?.texto} className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
                {aba === 'pistas' && (
                  <>
                    {scene.data && sceneClues.length === 0 && <p className="text-sm text-subtle">Nenhuma pista plantada nesta cena ou neste lugar.</p>}
                    {!sessionId && sceneClues.some((c) => c.status === 'oculta') && (
                      <p className="text-xs text-warning">Comece uma sessão para a pista achada guardar em qual sessão foi.</p>
                    )}
                    <ul className="flex flex-col gap-2" aria-label="Pistas desta cena">
                      {sceneClues.map((c) => (
                        <ClueRow key={c.id} clue={c} sessionId={sessionId} />
                      ))}
                    </ul>
                  </>
                )}
                {aba === 'notas' &&
                  (sessionId ? (
                    <Notes key={sessionId} sessionId={sessionId} />
                  ) : (
                    <Card>
                      <EmptyState
                        icon={<Dices />}
                        title="Nenhuma sessão ainda"
                        text="Comece a sessão de hoje para guardar notas e saber em que sessão cada pista foi achada."
                        action={
                          <Button variant="primary" icon={<Dices className="size-4" />} onClick={() => void start()}>
                            Começar sessão 1
                          </Button>
                        }
                      />
                    </Card>
                  ))}
                {aba === 'npcs' && (
                  <>
                    {npcs.length === 0 && <p className="text-sm text-subtle">Nenhum NPC ou ameaça citado no texto desta cena.</p>}
                    <ul className="flex flex-col gap-2" aria-label="NPCs e ameaças da cena">
                      {npcs.map((p) => (
                        <NaCena key={p.id} id={p.id} sessionId={sessionId} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {comecando && (
        <ComecarCombate
          naCena={people}
          aoFechar={() => setComecando(false)}
          aoComecar={(lista) => {
            combate.adicionar(lista)
            setComecando(false)
            setVerCena(false)
          }}
        />
      )}
    </div>
  )
}
