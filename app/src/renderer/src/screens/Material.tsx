// Arquivos da aventura dentro do app: ver o PDF na página certa, e o "Material desta cena".
import * as RadixDialog from '@radix-ui/react-dialog'
import { ExternalLink, FileText, Paperclip, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { fold } from '@shared/mentions'
import type { Attachment, AttachmentKind, ImportResult, SceneAttachment } from '@shared/types'
import { useCampaign } from '@/campaign'
import { useLoad } from '@/lib/data'
import { Button, Chip, cx, Dialog, ErrorNote, IconButton } from '@/ui'

export const KIND_LABEL: Record<AttachmentKind, string> = { imagem: 'Imagem', pdf: 'PDF', token: 'Token', mapa: 'Mapa', outro: 'Outro' }

export const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)

export function importSummary(r: ImportResult): string {
  const parts = [
    r.imported.length > 0 && `${r.imported.length} ${r.imported.length === 1 ? 'arquivo importado' : 'arquivos importados'}`,
    r.reused.length > 0 && `${r.reused.length} já ${r.reused.length === 1 ? 'estava' : 'estavam'} na campanha`,
    r.errors.length > 0 && `${r.errors.length} com problema: ${r.errors.map((e) => `${e.file} (${e.message})`).join('; ')}`
  ].filter(Boolean)
  return parts.join(' · ') || 'Nada importado.'
}

/** Miniatura: a própria imagem, ou um ícone para PDF. */
export function FileThumb({ file, className }: { file: Attachment; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-md bg-bg', className)}>
      {file.mime.startsWith('image/') ? (
        <img src={file.url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <FileText className="size-1/2 max-h-8 max-w-8 text-subtle" aria-hidden />
      )}
    </span>
  )
}

/** Visualizador grande: PDF no leitor do Chromium já na página, ou a imagem inteira. */
export function FileViewer({ file, page, onClose }: { file: Attachment | null; page?: number | null; onClose: () => void }) {
  return (
    <RadixDialog.Root open={file !== null} onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/70" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-4 flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-pop md:inset-8"
        >
          {file && (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-2">
                <RadixDialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {file.fileName}
                  {page ? <span className="ml-2 font-mono text-xs text-muted">p. {page}</span> : null}
                </RadixDialog.Title>
                <Button size="sm" variant="ghost" icon={<ExternalLink className="size-4" />} onClick={() => void window.api.attachments.openExternal(file.id)}>
                  Abrir no computador
                </Button>
                <RadixDialog.Close asChild>
                  <IconButton label="Fechar">
                    <X className="size-4" />
                  </IconButton>
                </RadixDialog.Close>
              </div>
              {file.mime === 'application/pdf' ? (
                <iframe title={`PDF ${file.fileName}`} src={`${file.url}${page ? `#page=${page}` : ''}`} className="min-h-0 flex-1 bg-bg" />
              ) : (
                <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-bg p-4">
                  <img src={file.url} alt={file.fileName} className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Escolher um arquivo já importado (ou importar novos) para ligar à cena, com a página do PDF. */
function AttachPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (file: Attachment, page: number | null) => void }) {
  const { changed } = useCampaign()
  const files = useLoad(() => (open ? window.api.attachments.list() : Promise.resolve([])), [open])
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Attachment | null>(null)
  const [page, setPage] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const needle = fold(q.trim())
  const shown = (files.data ?? []).filter((f) => !needle || fold(f.fileName).includes(needle))
  const importNew = async () => {
    const r = await window.api.attachments.pickFiles()
    if (!r) return
    setNote(importSummary(r))
    changed()
    files.reload()
    const first = r.imported[0] ?? r.reused[0]
    if (first) setChosen(first)
  }
  const close = () => {
    setChosen(null)
    setPage('')
    setNote(null)
    onClose()
  }
  const pageNum = page.trim() ? Number(page) : null
  const pageOk = pageNum === null || (Number.isInteger(pageNum) && pageNum >= 1)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Anexar à cena"
      description="O PDF da aventura (com a página), tokens, mapas e imagens."
      footer={
        <>
          <Button variant="ghost" icon={<Upload className="size-4" />} onClick={() => void importNew()} className="mr-auto">
            Importar novos…
          </Button>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!chosen || !pageOk}
            onClick={() => {
              if (chosen) onPick(chosen, chosen.mime === 'application/pdf' ? pageNum : null)
              close()
            }}
          >
            Anexar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filtrar arquivos"
          placeholder="Filtrar pelo nome…"
          className="h-9 w-full rounded-md border border-border-input bg-bg px-3 text-sm text-fg focus:border-focus"
        />
        {note && <p className="text-xs text-muted">{note}</p>}
        {files.error && <ErrorNote message={files.error} />}
        <ul className="flex max-h-72 flex-col gap-1 overflow-auto" aria-label="Arquivos da campanha">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={chosen?.id === f.id}
                onClick={() => setChosen(f)}
                className={cx('flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left', chosen?.id === f.id ? 'bg-surface ring-1 ring-accent' : 'hover:bg-surface')}
              >
                <FileThumb file={f} className="size-9" />
                <span className="min-w-0 flex-1 truncate text-sm">{f.fileName}</span>
                <Chip>{KIND_LABEL[f.kind]}</Chip>
              </button>
            </li>
          ))}
          {files.data && shown.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">Nenhum arquivo. Use "Importar novos…".</li>}
        </ul>
        {chosen?.mime === 'application/pdf' && (
          <label className="flex items-center gap-2 text-sm">
            Página do PDF
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              aria-label="Página do PDF"
              placeholder="ex.: 12"
              className="h-8 w-24 rounded-md border border-border-input bg-bg px-2 font-mono text-sm text-fg focus:border-focus aria-invalid:border-danger"
              aria-invalid={!pageOk || undefined}
            />
            <span className="text-xs text-subtle">opcional</span>
          </label>
        )}
      </div>
    </Dialog>
  )
}

/** "Material desta cena": usado na cena (editar) e na tela de sessão (só abrir). */
export function SceneMaterial({ sceneId, items, onChange, readOnly = false }: { sceneId: string; items: SceneAttachment[]; onChange: () => void; readOnly?: boolean }) {
  const { changed } = useCampaign()
  const [viewing, setViewing] = useState<SceneAttachment | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (job: Promise<unknown>) => {
    try {
      await job
      setError(null)
      changed()
      onChange()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section aria-labelledby={`material-${sceneId}`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 id={`material-${sceneId}`} className="type-label text-muted">
          Material desta cena
        </h2>
        {!readOnly && (
          <Button size="sm" variant="ghost" icon={<Paperclip className="size-4" />} onClick={() => setPicking(true)} className="ml-auto">
            Anexar
          </Button>
        )}
      </div>
      {items.length === 0 && (
        <p className="text-sm text-subtle">{readOnly ? 'Nada anexado a esta cena.' : 'Anexe a página do PDF da aventura, tokens e mapas para abrir na hora, na mesa.'}</p>
      )}
      {error && <ErrorNote message={error} />}
      <ul className="flex flex-wrap gap-2" aria-label="Material desta cena">
        {items.map((m) => (
          <li key={m.attachment.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 pr-2">
            <button type="button" onClick={() => setViewing(m)} className="flex items-center gap-2 text-left hover:underline" aria-label={`Abrir ${m.attachment.fileName}${m.pdfPage ? ` na página ${m.pdfPage}` : ''}`}>
              <FileThumb file={m.attachment} className="size-9" />
              <span className="max-w-48 truncate text-sm">{m.attachment.fileName}</span>
              {m.pdfPage && <span className="font-mono text-xs text-muted">p. {m.pdfPage}</span>}
              {!m.pdfPage && m.attachment.kind !== 'pdf' && m.attachment.kind !== 'imagem' && <Chip>{KIND_LABEL[m.attachment.kind]}</Chip>}
            </button>
            {!readOnly && (
              <IconButton label={`Tirar ${m.attachment.fileName} da cena`} onClick={() => void act(window.api.scenes.detach({ sceneId, attachmentId: m.attachment.id }))} className="size-6">
                <X className="size-3.5" />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      <AttachPicker open={picking} onClose={() => setPicking(false)} onPick={(f, page) => void act(window.api.scenes.attach({ sceneId, attachmentId: f.id, pdfPage: page }))} />
      <FileViewer file={viewing?.attachment ?? null} page={viewing?.pdfPage} onClose={() => setViewing(null)} />
    </section>
  )
}

