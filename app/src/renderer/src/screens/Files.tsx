// Arquivos da aventura: importar PDF, tokens, mapas e imagens, e ligar cada um às cenas e fichas.
import { Eye, FolderArchive, Link2, SearchCheck, Upload, UserPlus, X } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatGameTime } from '@shared/gameTime'
import { ATTACHMENT_KINDS, type AttachmentKind, type AttachmentUse, type EntityKind } from '@shared/types'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { createClue, createEntity, KIND_LABEL as ENTITY_LABEL } from '@/lib/actions'
import { useLoad } from '@/lib/data'
import { Button, Card, Chip, cx, EmptyState, ErrorNote, SelectField } from '@/ui'
import { FileThumb, FileViewer, fileSize, importSummary, KIND_LABEL } from './Material'

const USE_LINK: Record<AttachmentUse['type'], (u: AttachmentUse) => string> = {
  scene: (u) => `/cenas/${u.id}`,
  entity: (u) => `/ficha/${u.id}`,
  clue: (u) => `/pistas?pista=${u.id}`,
  board: (u) => `/quadros/${u.id}`,
  campaign: () => '/'
}
const USE_LABEL: Record<AttachmentUse['type'], string> = { scene: 'Cena', entity: 'Retrato', clue: 'Pista', board: 'Quadro', campaign: 'Capa' }

const baseName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\btokens?\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function FileDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const campaign = useOpenCampaign()
  const { version, changed } = useCampaign()
  const file = useLoad(() => window.api.attachments.get(id), [id, version])
  const scenes = useLoad(() => window.api.scenes.list(), [version])
  const [viewing, setViewing] = useState(false)
  const [sceneId, setSceneId] = useState('')
  const [page, setPage] = useState('')
  const [entityKind, setEntityKind] = useState<EntityKind>('personagem')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (file.error) return <ErrorNote message={file.error} onRetry={file.reload} />
  const f = file.data
  if (!f) return null
  const isPdf = f.mime === 'application/pdf'
  const isImage = f.mime.startsWith('image/')
  const pageNum = page.trim() ? Number(page) : null

  const act = async (job: () => Promise<string | void>) => {
    try {
      const msg = await job()
      setError(null)
      setDone(msg || null)
      changed()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const link = () =>
    act(async () => {
      await window.api.scenes.attach({ sceneId, attachmentId: f.id, pdfPage: isPdf ? pageNum : null })
      const title = scenes.data?.find((s) => s.id === sceneId)?.title || 'a cena'
      setSceneId('')
      setPage('')
      return `Ligado a ${title}.`
    })
  const newEntity = () =>
    act(async () => {
      const eid = await createEntity(entityKind, baseName(f.fileName))
      const e = await window.api.entities.get(eid)
      await window.api.entities.save({ ...e, portraitId: f.id })
      return `Ficha criada: ${e.name || 'sem nome'}.`
    })
  const newClue = () =>
    act(async () => {
      const c = await createClue(baseName(f.fileName), f.id)
      return `Pista criada: ${c.title || 'sem título'}.`
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="type-label text-muted">Arquivo</span>
        <Button size="sm" variant="ghost" icon={<X className="size-4" />} aria-label="Fechar o arquivo" onClick={onClose} className="ml-auto" />
      </div>
      <button type="button" onClick={() => setViewing(true)} className="group relative overflow-hidden rounded-lg border border-border" aria-label={`Abrir ${f.fileName}`}>
        <FileThumb file={f} className="aspect-video w-full rounded-none" />
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Eye className="size-6 text-fg" aria-hidden />
        </span>
      </button>
      <div>
        <div className="text-sm font-semibold break-all">{f.fileName}</div>
        <div className="text-xs text-muted">
          {fileSize(f.sizeBytes)} · importado em {new Date(f.createdAt).toLocaleDateString('pt-BR')}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <SelectField
          label="Tipo"
          className="flex-1"
          options={ATTACHMENT_KINDS.filter((k) => (k === 'pdf') === isPdf || k === 'outro').map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={f.kind}
          onChange={(e) => void act(async () => void (await window.api.attachments.setKind({ id: f.id, kind: e.target.value as AttachmentKind })))}
        />
        <Button icon={<Eye className="size-4" />} onClick={() => setViewing(true)}>
          Abrir
        </Button>
      </div>

      <Card className="flex flex-col gap-3">
        <h3 className="type-label text-muted">Ligar a uma cena</h3>
        <SelectField
          label="Cena"
          empty="Escolha a cena"
          options={(scenes.data ?? []).map((s) => ({
            value: s.id,
            label: `${s.gameMinuteStart === null ? '' : `${formatGameTime(campaign.epochDate, s.gameMinuteStart)} · `}${s.title || 'Sem título'}`
          }))}
          value={sceneId}
          onChange={(e) => setSceneId(e.target.value)}
        />
        {isPdf && (
          <label className="flex items-center gap-2 text-sm">
            Página
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              aria-label="Página do PDF"
              placeholder="ex.: 12"
              className="h-8 w-24 rounded-md border border-border-input bg-bg px-2 font-mono text-sm text-fg focus:border-focus"
            />
          </label>
        )}
        <Button icon={<Link2 className="size-4" />} disabled={!sceneId || (pageNum !== null && !(pageNum >= 1))} onClick={() => void link()} className="self-start">
          Ligar à cena
        </Button>
      </Card>

      {isImage && (
        <Card className="flex flex-col gap-3">
          <h3 className="type-label text-muted">Usar esta imagem</h3>
          <div className="flex items-end gap-2">
            <SelectField
              label="Ficha nova de"
              className="flex-1"
              options={(['personagem', 'criatura', 'local'] as EntityKind[]).map((k) => ({ value: k, label: ENTITY_LABEL[k].one }))}
              value={entityKind}
              onChange={(e) => setEntityKind(e.target.value as EntityKind)}
            />
            <Button icon={<UserPlus className="size-4" />} onClick={() => void newEntity()}>
              Criar ficha
            </Button>
          </div>
          <Button variant="ghost" icon={<SearchCheck className="size-4" />} onClick={() => void newClue()} className="self-start">
            Criar pista com esta imagem
          </Button>
        </Card>
      )}

      {done && (
        <p role="status" className="text-sm text-success">
          {done}
        </p>
      )}
      {error && <ErrorNote message={error} />}

      <section aria-labelledby="file-uses-h">
        <h3 id="file-uses-h" className="type-label mb-2 text-muted">
          Usado em
        </h3>
        {f.usedIn.length === 0 && <p className="text-sm text-subtle">Ainda não está ligado a nada.</p>}
        <ul className="flex flex-col gap-1.5">
          {f.usedIn.map((u) => (
            <li key={`${u.type}:${u.id}`}>
              <Link to={USE_LINK[u.type](u)} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-input">
                <span className="text-xs text-subtle">{USE_LABEL[u.type]}</span>
                <span className="min-w-0 flex-1 truncate">{u.title}</span>
                {u.pdfPage && <span className="font-mono text-xs text-muted">p. {u.pdfPage}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <FileViewer file={viewing ? f : null} onClose={() => setViewing(false)} />
    </div>
  )
}

export function Files() {
  const { version, changed } = useCampaign()
  const [params, setParams] = useSearchParams()
  const selected = params.get('arquivo')
  const list = useLoad(() => window.api.attachments.list(), [version])
  const [kind, setKind] = useState<AttachmentKind | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const select = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('arquivo', id)
      else next.delete('arquivo')
      return next
    })
  const run = async (job: () => Promise<Awaited<ReturnType<typeof window.api.attachments.importPaths>> | null>) => {
    setBusy(true)
    setError(null)
    try {
      const r = await job()
      if (!r) return
      setNote(importSummary(r))
      changed()
      const first = r.imported[0] ?? r.reused[0]
      if (first && r.imported.length + r.reused.length === 1) select(first.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const onDrop = (e: DragEvent) => {
    setOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    e.preventDefault()
    void run(() => window.api.attachments.importPaths(files.map((f) => window.api.pathForFile(f))))
  }

  const all = list.data ?? []
  const shown = all.filter((f) => !kind || f.kind === kind)
  const count = (k: AttachmentKind) => all.filter((f) => f.kind === k).length

  return (
    <div className="flex h-full min-h-0">
      <section
        className={cx('min-w-0 flex-1 overflow-auto px-6 py-5', over && 'outline-2 -outline-offset-4 outline-dashed outline-accent')}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setOver(false)}
        onDrop={onDrop}
      >
        <div className="mx-auto flex max-w-(--layout-content-max) flex-col gap-5">
          <h1 className="sr-only">Arquivos</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filtrar por tipo" className="flex rounded-md border border-border p-0.5">
              {[null, ...ATTACHMENT_KINDS].map((k) => (
                <Button
                  key={k ?? 'todos'}
                  size="sm"
                  variant="ghost"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className="aria-pressed:bg-surface-raised aria-pressed:text-fg"
                >
                  {k ? KIND_LABEL[k] : 'Todos'} <span className="font-mono text-xs text-subtle">{k ? count(k) : all.length}</span>
                </Button>
              ))}
            </div>
            <Button variant="primary" icon={<Upload className="size-4" />} loading={busy} onClick={() => void run(() => window.api.attachments.pickFiles())} className="ml-auto">
              Importar arquivos…
            </Button>
          </div>
          {note && (
            <p role="status" className="text-sm text-muted">
              {note}
            </p>
          )}
          {error && <ErrorNote message={error} />}
          {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}

          {list.data && all.length === 0 && (
            <Card>
              <EmptyState
                icon={<FolderArchive />}
                title="Nenhum arquivo ainda"
                text="Traga a aventura pronta: o PDF, os tokens, os mapas e as imagens. Solte tudo aqui de uma vez, depois ligue cada coisa à cena certa."
                action={
                  <Button variant="primary" icon={<Upload className="size-4" />} onClick={() => void run(() => window.api.attachments.pickFiles())}>
                    Importar arquivos…
                  </Button>
                }
              />
            </Card>
          )}

          <ul className="grid grid-cols-[repeat(auto-fill,minmax(calc(var(--layout-card-min)*0.8),1fr))] gap-3" aria-label="Arquivos">
            {shown.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => select(f.id)}
                  aria-pressed={selected === f.id}
                  className={cx('flex w-full flex-col overflow-hidden rounded-lg border bg-surface text-left transition-colors', selected === f.id ? 'border-accent' : 'border-border hover:border-border-input')}
                >
                  <FileThumb file={f} className="aspect-[4/3] w-full rounded-none border-b border-border" />
                  <span className="flex flex-col gap-1 p-2.5">
                    <span className="truncate text-sm font-semibold">{f.fileName}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <Chip>{KIND_LABEL[f.kind]}</Chip>
                      <span className="truncate">{f.usedIn.length ? `usado em ${f.usedIn.length}` : fileSize(f.sizeBytes)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {all.length > 0 && <p className="text-xs text-subtle">Solte arquivos em qualquer lugar desta tela para importar. O mesmo arquivo duas vezes não vira cópia.</p>}
        </div>
      </section>
      {selected && (
        <aside aria-label="Arquivo" className="w-(--layout-editor-panel) shrink-0 overflow-auto border-l border-border px-5 py-5">
          <FileDetail key={selected} id={selected} onClose={() => select(null)} />
        </aside>
      )}
    </div>
  )
}
