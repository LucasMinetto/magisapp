import { ArrowLeft, CalendarClock, Clapperboard, Dices, FileSearch, FileText, ImagePlus, Map as MapIcon, Plus, ScrollText, Trash2, User, X } from 'lucide-react'
import { SceneEditor } from '@/editor/SceneEditor'
import { FichaCompleta } from '@/ficha/FichaCompleta'
import { BlocoAmeaca } from '@/ameaca/BlocoAmeaca'
import { EditorAmeaca } from '@/ameaca/EditorAmeaca'
import { FileViewer } from './Material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCampaign } from '@/campaign'
import { KIND_LABEL } from '@/lib/actions'
import { useAutosave, useLoad } from '@/lib/data'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, IconButton, Portrait, SaveIndicator, SelectField, TextArea, TextField } from '@/ui'
import type { BlocoAmeaca as Bloco, FichaAgente } from '@shared/ordem/esquemas'
import type { Attachment, CustomAttribute, Entity, EntityInput, SheetSize, StatValue, TemplateField } from '@shared/types'

type Resource = { current: number; max: number }
const isResource = (v: StatValue | undefined): v is Resource => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (s: string) => (s.trim() === '' ? 0 : Number(s))

function StatField({ field, value, onChange }: { field: TemplateField; value: StatValue | undefined; onChange: (v: StatValue) => void }) {
  if (field.type === 'resource') {
    const r = isResource(value) ? value : { current: 0, max: 0 }
    const pct = r.max > 0 ? Math.max(0, Math.min(100, (r.current / r.max) * 100)) : 0
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="type-label mb-1.5 text-muted">{field.label}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label={`${field.label} atual`}
            value={r.current}
            onChange={(e) => onChange({ ...r, current: num(e.target.value) })}
            className="h-9 w-16 rounded-md border border-border-input bg-bg px-2 text-center font-mono text-sm"
          />
          <span className="text-subtle">/</span>
          <input
            type="number"
            aria-label={`${field.label} máximo`}
            value={r.max}
            min={0}
            onChange={(e) => onChange({ ...r, max: num(e.target.value) })}
            className="h-9 w-16 rounded-md border border-border-input bg-bg px-2 text-center font-mono text-sm"
          />
        </div>
        <div
          role="meter"
          aria-label={field.label}
          aria-valuenow={r.current}
          aria-valuemin={0}
          aria-valuemax={r.max}
          className="h-1.5 overflow-hidden rounded-pill bg-bg"
        >
          <div className={`h-full ${r.current <= 0 && r.max > 0 ? 'bg-danger' : pct < 35 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${pct}%` }} />
        </div>
      </fieldset>
    )
  }
  if (field.type === 'number')
    return (
      <TextField
        label={field.label}
        type="number"
        className="w-20"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(num(e.target.value))}
      />
    )
  if (field.type === 'select')
    return (
      <SelectField
        label={field.label}
        empty="—"
        options={(field.options.choices ?? []).map((c) => ({ value: c, label: c }))}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  if (field.type === 'list')
    return (
      <TextArea
        label={field.label}
        hint="Um por linha"
        className="min-h-0"
        rows={3}
        value={Array.isArray(value) ? value.join('\n') : ''}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
    )
  return <TextField label={field.label} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
}

/** Retrato: clicar escolhe a imagem, soltar um arquivo também serve. */
function PortraitPicker({ name, url, onPick, onClear }: { name: string; url: string | null; onPick: (path?: string) => void; onClear: () => void }) {
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={url ? 'Trocar o retrato' : 'Escolher um retrato'}
        title="Escolher imagem, ou solte um arquivo aqui"
        onClick={() => onPick()}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
          setOver(false)
          if (!file) return
          e.preventDefault()
          onPick(window.api.pathForFile(file))
        }}
        className={cx('group relative rounded-full', over && 'outline-2 outline-offset-2 outline-accent')}
      >
        <Portrait name={name} size={96} src={url} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImagePlus className="size-5 text-fg" aria-hidden />
        </span>
      </button>
      {url && (
        <button type="button" onClick={onClear} className="text-xs text-subtle hover:text-fg">
          Tirar retrato
        </button>
      )}
    </div>
  )
}

function CustomAttributes({ value, onChange }: { value: CustomAttribute[]; onChange: (v: CustomAttribute[]) => void }) {
  const set = (i: number, patch: Partial<CustomAttribute>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-label text-muted">Seus atributos</h2>
      {value.length === 0 && <p className="text-sm text-subtle">O que o modelo do sistema não tem: "Deve favor a", "Arma", "Medo de".</p>}
      <ul className="flex flex-col gap-2">
        {value.map((a, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              aria-label={`Nome do atributo ${i + 1}`}
              value={a.label}
              placeholder="Atributo"
              maxLength={80}
              onChange={(e) => set(i, { label: e.target.value })}
              className="h-9 w-40 shrink-0 rounded-md border border-border-input bg-bg px-2 text-sm font-semibold text-fg focus:border-focus"
            />
            <textarea
              aria-label={`Valor de ${a.label || `atributo ${i + 1}`}`}
              value={a.value}
              placeholder="Valor"
              maxLength={2_000}
              rows={1}
              onChange={(e) => set(i, { value: e.target.value })}
              className="field-sizing-content min-h-9 flex-1 resize-none rounded-md border border-border-input bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus"
            />
            <IconButton label={`Tirar ${a.label || 'atributo'}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => onChange([...value, { label: '', value: '' }])} className="self-start">
        Adicionar atributo
      </Button>
    </Card>
  )
}

/** Mapa do lugar: uma imagem pronta (da internet ou do livro). Clicar abre grande. */
function MapCard({ name, url, mapId, onPick, onClear }: { name: string; url: string | null; mapId: string | null; onPick: (path?: string) => void; onClear: () => void }) {
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const [over, setOver] = useState(false)
  const open = async () => mapId && setViewing(await window.api.attachments.get(mapId))
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="type-label text-muted">Mapa</h2>
        {url && (
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onPick()}>
              Trocar
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
              Tirar
            </Button>
          </span>
        )}
      </div>
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false)
          const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
          if (!file) return
          e.preventDefault()
          onPick(window.api.pathForFile(file))
        }}
        className={cx('rounded-lg', over && 'outline-2 outline-offset-2 outline-accent')}
      >
        {url ? (
          <button type="button" onClick={() => void open()} aria-label={`Abrir o mapa de ${name || 'lugar'}`} className="block w-full overflow-hidden rounded-lg border border-border bg-bg">
            <img src={url} alt={`Mapa de ${name || 'lugar'}`} className="max-h-96 w-full object-contain" />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-input px-4 py-6 text-center">
            <MapIcon className="size-6 text-subtle" aria-hidden />
            <p className="text-sm text-muted">Solte aqui o mapa do lugar (uma imagem pronta)</p>
            <Button size="sm" onClick={() => onPick()}>
              Escolher mapa
            </Button>
          </div>
        )}
      </div>
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </Card>
  )
}

const isFull = (e: Pick<Entity, 'kind' | 'sheet'>) => e.kind === 'personagem' && e.sheet === 'completa'

const toInput = (e: Entity): EntityInput => ({
  id: e.id,
  kind: e.kind,
  name: e.name,
  role: e.role,
  isPlayer: e.isPlayer,
  aliases: e.aliases,
  stats: e.stats,
  description: e.description,
  personality: e.personality,
  portraitId: e.portraitId,
  customAttributes: e.customAttributes,
  mapId: e.mapId,
  notes: e.notes,
  sheet: e.sheet,
  // A ficha completa e o bloco de ameaça vão junto; a compacta usa os campos do modelo em `stats`.
  sheetData: isFull(e) || e.kind === 'ameaca' ? e.sheetData : undefined
})

export function EntitySheet() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { changed, version } = useCampaign()
  const loaded = useLoad(() => window.api.entities.get(id), [id])
  const mentions = useLoad(() => window.api.entities.get(id).then((e) => e.mentionedIn), [id, version])
  const templates = useLoad(() => window.api.templates.list(), [])
  const [draft, setDraft] = useState<EntityInput | null>(null)
  const [aliasText, setAliasText] = useState('')
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [showOptional, setShowOptional] = useState(false)

  useEffect(() => {
    if (loaded.data) {
      setDraft(toInput(loaded.data))
      setAliasText(loaded.data.aliases.join(', '))
      setPortraitUrl(loaded.data.portraitUrl)
      setMapUrl(loaded.data.mapUrl)
    }
  }, [loaded.data])

  const autosave = useAutosave(async (value: EntityInput) => {
    await window.api.entities.save(value)
    changed()
  })

  const fields = useMemo(() => {
    if (!draft || !loaded.data?.systemTemplateId) return []
    const t = templates.data?.find((x) => x.id === loaded.data!.systemTemplateId)
    return (t?.fields ?? []).filter((f) => f.entityKind === draft.kind)
  }, [templates.data, loaded.data, draft])

  const filled = (v: StatValue | undefined) => (isResource(v) ? v.max > 0 || v.current > 0 : Array.isArray(v) ? v.some(Boolean) : v !== undefined && v !== '' && v !== 0)
  const hiddenOptional = fields.filter((f) => f.options.optional && !filled(draft?.stats[f.key]) && draft?.stats.classe !== 'Sobrevivente')
  const groups = useMemo(() => {
    const map = new Map<string, TemplateField[]>()
    for (const f of fields) {
      if (!showOptional && hiddenOptional.includes(f)) continue
      map.set(f.groupName, [...(map.get(f.groupName) ?? []), f])
    }
    return [...map.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, showOptional, hiddenOptional.length])

  if (loaded.error) return <div className="p-6"><ErrorNote message={loaded.error} onRetry={loaded.reload} /></div>
  if (!draft) return null

  const update = (patch: Partial<EntityInput>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    autosave.schedule(next)
  }

  const pickMap = async (path?: string) => {
    try {
      const a = path ? await window.api.attachments.importPath(path) : await window.api.attachments.pickImage()
      if (!a) return
      if (a.kind === 'imagem') await window.api.attachments.setKind({ id: a.id, kind: 'mapa' })
      setMapUrl(a.url)
      setPickError(null)
      update({ mapId: a.id })
    } catch (e) {
      setPickError((e as Error).message)
    }
  }

  const pickPortrait = async (path?: string) => {
    try {
      const a = path ? await window.api.attachments.importPath(path) : await window.api.attachments.pickImage()
      if (!a) return
      setPortraitUrl(a.url)
      setPickError(null)
      update({ portraitId: a.id })
    } catch (e) {
      setPickError((e as Error).message)
    }
  }

  const trash = async () => {
    await autosave.flush()
    await window.api.entities.trash(draft.id!)
    changed()
    navigate(`/fichas/${draft.kind}`)
  }

  // Ficha completa ↔ compacta: salva o que está pendente, troca e recarrega a ficha.
  const changeSheet = async (sheet: SheetSize) => {
    if (sheet === 'compacta' && !window.confirm('Voltar à ficha compacta? A ficha completa fica guardada e volta como está se você trocar de novo.')) return
    await autosave.flush()
    try {
      await window.api.entities.setSheet({ id: draft.id!, sheet })
      changed()
      loaded.reload()
    } catch (e) {
      setPickError((e as Error).message)
    }
  }

  // Marcar como personagem de jogador leva à ficha completa (o agente usa sempre a completa).
  const setPlayer = async (isPlayer: boolean) => {
    update({ isPlayer })
    if (isPlayer && draft.sheet !== 'completa') {
      await autosave.flush()
      changed()
      loaded.reload()
    }
  }

  const full = isFull({ kind: draft.kind, sheet: draft.sheet ?? 'compacta' }) && draft.sheetData != null
  const bloco = draft.kind === 'ameaca' && draft.sheetData ? (draft.sheetData as Bloco) : null

  const identity = (
    <div className="flex items-start gap-4">
      <PortraitPicker
        name={draft.name}
        url={portraitUrl}
        onPick={(path) => void pickPortrait(path)}
        onClear={() => {
          setPortraitUrl(null)
          update({ portraitId: null })
        }}
      />
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="entity-name">
          Nome
        </label>
        <input
          id="entity-name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Nome"
          autoFocus={!draft.name}
          maxLength={200}
          className="type-xl w-full rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-focus"
        />
        <label className="sr-only" htmlFor="entity-role">
          Papel na história
        </label>
        <input
          id="entity-role"
          value={draft.role}
          onChange={(e) => update({ role: e.target.value })}
          placeholder="Papel na história"
          className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 font-serif text-muted italic hover:border-border focus:border-focus"
        />
        {pickError && <p className="mt-1 px-1 text-xs text-danger">{pickError}</p>}
      </div>
    </div>
  )

  const aliasCard = (
    <Card className="flex flex-col gap-4">
      <TextField
        label="Apelidos"
        hint="Separados por vírgula. Também são achados nos textos."
        value={aliasText}
        onChange={(e) => {
          setAliasText(e.target.value)
          update({ aliases: e.target.value.split(',') })
        }}
      />
      {draft.kind === 'personagem' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.isPlayer} onChange={(e) => void setPlayer(e.target.checked)} className="size-4 accent-(--color-accent)" />
          Personagem de jogador
        </label>
      )}
    </Card>
  )

  const texts = (
    <>
      <CustomAttributes value={draft.customAttributes} onChange={(customAttributes) => update({ customAttributes })} />
      <Card className="flex flex-col gap-4">
        <TextArea label="Descrição" value={draft.description} onChange={(e) => update({ description: e.target.value })} placeholder="Aparência, o que os agentes percebem primeiro" />
        <TextArea label="Personalidade e segredos" value={draft.personality} onChange={(e) => update({ personality: e.target.value })} placeholder="O que quer, o que esconde, como reage" />
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="type-label text-muted">Notas do mestre</h2>
        <div className="rounded-md border border-border-input bg-bg px-4 py-3 [&_.ProseMirror]:min-h-24">
          <SceneEditor
            key={`notas-${draft.id}`}
            initial={draft.notes ?? null}
            label={`Notas de ${draft.name || 'ficha'}`}
            placeholder="O que você precisa lembrar sobre esta ficha. Nomes de outras fichas viram ligação."
            onChange={(notes) => update({ notes })}
          />
        </div>
      </Card>
    </>
  )

  const mentionList = (
    <aside aria-labelledby="mentions-h" className="flex flex-col gap-3">
      <h2 id="mentions-h" className="type-label text-muted">
        Aparece em
      </h2>
      {!draft.name.trim() && <p className="text-sm text-subtle">Dê um nome à ficha para achá-la nos textos.</p>}
      {draft.name.trim() && mentions.data?.length === 0 && (
        <Card>
          <EmptyState icon={<Clapperboard />} title="Em nenhuma cena" text="Quando o nome ou um apelido aparecer no texto de uma cena, ela entra aqui sozinha." />
        </Card>
      )}
      <ul className="flex flex-col gap-2">
        {mentions.data?.map((m) => (
          <li key={`${m.sourceType}:${m.sourceId}`}>
            <Link
              to={
                m.sourceType === 'event'
                  ? `/linha-do-tempo?evento=${m.sourceId}`
                  : m.sourceType === 'clue'
                    ? `/pistas?pista=${m.sourceId}`
                    : m.sourceType === 'document'
                      ? `/textos/${m.sourceId}`
                      : m.sourceType === 'session'
                        ? `/sessao?s=${m.sourceId}`
                        : m.sourceType === 'entity'
                          ? `/ficha/${m.sourceId}`
                        : `/cenas/${m.sourceId}`
              }
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-border-input"
            >
              {m.sourceType === 'event' ? (
                <CalendarClock className="size-4 text-muted" aria-hidden />
              ) : m.sourceType === 'clue' ? (
                <FileSearch className="size-4 text-muted" aria-hidden />
              ) : m.sourceType === 'document' ? (
                <FileText className="size-4 text-muted" aria-hidden />
              ) : m.sourceType === 'session' ? (
                <Dices className="size-4 text-muted" aria-hidden />
              ) : m.sourceType === 'entity' ? (
                <User className="size-4 text-muted" aria-hidden />
              ) : (
                <Clapperboard className="size-4 text-muted" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              {m.sourceType === 'event' || m.sourceType === 'clue' ? (
                <span className="text-xs text-subtle">{m.sourceType === 'event' ? 'evento' : 'pista'}</span>
              ) : (
                <span className="font-mono text-xs text-subtle" title="Vezes no texto">
                  ×{m.hits}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )

  return (
    <div className={cx('mx-auto flex flex-col gap-6 px-6 py-6', full ? 'max-w-[1600px]' : 'max-w-(--layout-content-max)')}>
      <div className="flex items-center justify-between gap-4">
        <Link to={`/fichas/${draft.kind}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> {KIND_LABEL[draft.kind].many}
        </Link>
        <div className="flex items-center gap-3">
          <SaveIndicator state={autosave.state} error={autosave.error} />
          {draft.kind === 'personagem' && !full && (
            <Button size="sm" icon={<ScrollText className="size-4" />} onClick={() => void changeSheet('completa')}>
              Usar ficha completa
            </Button>
          )}
          {full && !draft.isPlayer && (
            <Button size="sm" variant="ghost" onClick={() => void changeSheet('compacta')}>
              Voltar à ficha compacta
            </Button>
          )}
          <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={trash}>
            Mover para a lixeira
          </Button>
        </div>
      </div>

      {full ? (
        <FichaCompleta
          entityId={draft.id!}
          ficha={draft.sheetData as FichaAgente}
          aoMudar={(sheetData) => update({ sheetData })}
          jogador={draft.isPlayer}
          topo={
            <>
              {identity}
              {aliasCard}
            </>
          }
          notas={
            <>
              {texts}
              {mentionList}
            </>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_var(--layout-inspector)]">
          <div className="flex flex-col gap-6">
            {identity}
            {aliasCard}

            {bloco && (
              <Card className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="type-label text-muted">Bloco · Ordem Paranormal</h2>
                  {loaded.data?.origin && <Chip>Da biblioteca: {loaded.data.origin.sourceName}</Chip>}
                </div>
                <EditorAmeaca a={bloco} aoMudar={(patch) => update({ sheetData: { ...bloco, ...patch } })} />
              </Card>
            )}

            {!bloco && groups.length > 0 && (
              <Card className="flex flex-col gap-5">
                <h2 className="type-label text-muted">Ficha · Ordem Paranormal</h2>
                {groups.map(([group, gf]) => (
                  <section key={group} aria-label={group} className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">{group}</h3>
                    <div className="flex flex-wrap gap-4 [&>*]:min-w-32">
                      {gf.map((f) => (
                        <StatField key={f.id} field={f} value={draft.stats[f.key]} onChange={(v) => update({ stats: { ...draft.stats, [f.key]: v } })} />
                      ))}
                    </div>
                  </section>
                ))}
                {hiddenOptional.length > 0 && !showOptional && (
                  <Button size="sm" variant="ghost" onClick={() => setShowOptional(true)} className="self-start">
                    Mostrar regras opcionais ({[...new Set(hiddenOptional.map((f) => f.groupName))].join(', ')})
                  </Button>
                )}
              </Card>
            )}

            {draft.kind === 'local' && (
              <MapCard
                name={draft.name}
                url={mapUrl}
                mapId={draft.mapId ?? null}
                onPick={(path) => void pickMap(path)}
                onClear={() => {
                  setMapUrl(null)
                  update({ mapId: null })
                }}
              />
            )}

            {texts}
          </div>
          <div className="flex flex-col gap-6">
            {bloco && (
              <Card>
                <BlocoAmeaca a={bloco} nome={draft.name} />
              </Card>
            )}
            {mentionList}
          </div>
        </div>
      )}
    </div>
  )
}
