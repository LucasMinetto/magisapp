// S18 Exportar: formato, o que entra e para quem. Abre de Início, Ajustes e da busca (Ctrl+K).
import { FileDown, FolderOpen } from 'lucide-react'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { EXPORT_SECTIONS, type ExportFormat, type ExportSection } from '@shared/types'
import { Button, cx, Dialog, ErrorNote } from '@/ui'

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Para imprimir ou ler no celular na mesa.' },
  { value: 'docx', label: 'Word (.docx)', hint: 'Para editar no Word ou no Google Docs.' },
  { value: 'txt', label: 'Texto (.txt)', hint: 'Só o texto, abre em qualquer lugar.' },
  { value: 'obsidian', label: 'Pasta do Obsidian', hint: 'Markdown com links, imagens e quadros (.canvas).' }
]

const SECTION_LABEL: Record<ExportSection, string> = {
  'linha-do-tempo': 'Linha do tempo',
  cenas: 'Cenas',
  fichas: 'Fichas',
  pistas: 'Pistas',
  sessoes: 'Sessões',
  textos: 'Textos'
}

const Ctx = createContext<() => void>(() => {})
/** Abre a janela de exportar de qualquer tela dentro do Shell. */
export const useExportDialog = () => useContext(Ctx)

export function ExportProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      {open && <ExportDialog onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  )
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [sections, setSections] = useState<ExportSection[]>([...EXPORT_SECTIONS])
  const [gmOnly, setGmOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const path = await window.api.export.run({ format, sections, gmOnly })
      if (path) setDone(path)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const toggle = (s: ExportSection) => setSections((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : EXPORT_SECTIONS.filter((x) => x === s || cur.includes(x))))
  const obsidian = format === 'obsidian'

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Exportar a campanha"
      footer={
        done ? (
          <>
            <Button variant="ghost" icon={<FolderOpen className="size-4" />} onClick={() => void window.api.export.reveal(done)}>
              Mostrar na pasta
            </Button>
            <Button variant="primary" onClick={onClose}>
              Pronto
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" icon={<FileDown className="size-4" />} loading={busy} disabled={!obsidian && sections.length === 0} onClick={() => void run()}>
              Exportar
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p role="status" className="text-sm">
          Exportado em <span className="font-mono text-xs break-all text-muted">{done}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="type-label mb-2 text-muted">Formato</legend>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={cx(
                    'flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors',
                    format === f.value ? 'border-accent bg-surface' : 'border-border hover:border-border-input'
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <input type="radio" name="export-format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} className="accent-accent" />
                    {f.label}
                  </span>
                  <span className="pl-5 text-xs text-muted">{f.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {obsidian ? (
            <p className="text-sm text-muted">A pasta leva a campanha inteira, como no backup. Abra a pasta toda como cofre no Obsidian.</p>
          ) : (
            <>
              <fieldset>
                <legend className="type-label mb-2 text-muted">O que entra</legend>
                <div className="flex flex-wrap gap-2">
                  {EXPORT_SECTIONS.map((s) => (
                    <label key={s} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-pill border border-border px-3 text-sm has-checked:border-accent has-checked:bg-surface">
                      <input type="checkbox" checked={sections.includes(s)} onChange={() => toggle(s)} className="accent-accent" />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
                {sections.length === 0 && <p className="mt-1 text-xs text-danger">Escolha pelo menos uma parte.</p>}
              </fieldset>
              <fieldset>
                <legend className="type-label mb-2 text-muted">Para quem</legend>
                <div className="flex flex-col gap-1.5 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="radio" name="export-who" checked={gmOnly} onChange={() => setGmOnly(true)} className="mt-1 accent-accent" />
                    <span>
                      Para o mestre <span className="text-muted">— tudo, com segredos e o que cada pista revela</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="export-who" checked={!gmOnly} onChange={() => setGmOnly(false)} className="mt-1 accent-accent" />
                    <span>
                      Para os jogadores <span className="text-muted">— sem segredos, sem pistas ocultas e sem eventos que ainda não aconteceram</span>
                    </span>
                  </label>
                </div>
              </fieldset>
            </>
          )}
          {error && <ErrorNote message={error} />}
        </div>
      )}
    </Dialog>
  )
}
