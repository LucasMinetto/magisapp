import { Archive, FileDown, FolderOpen, HardDriveDownload, RotateCcw } from 'lucide-react'
import { useExportDialog } from './ExportDialog'
import { setThemePref, themePref, type ThemePref } from '@/lib/theme'
import { useState } from 'react'
import { useCampaign, useOpenCampaign } from '@/campaign'
import { useLoad } from '@/lib/data'
import { Button, Card, Chip, EmptyState, ErrorNote, SelectField } from '@/ui'

const INTERVALS = [
  { value: '0', label: 'Só ao fechar a campanha' },
  { value: '15', label: 'A cada 15 minutos' },
  { value: '30', label: 'A cada 30 minutos' },
  { value: '60', label: 'A cada hora' }
]
const KEEP = ['3', '5', '10', '20'].map((n) => ({ value: n, label: `${n} automáticos` }))

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)

export function Settings() {
  const campaign = useOpenCampaign()
  const { setCampaign } = useCampaign()
  const openExport = useExportDialog()
  const config = useLoad(() => window.api.backup.config(), [])
  const list = useLoad(() => window.api.backup.list(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePref>(themePref)

  const run = async <T,>(job: () => Promise<T>) => {
    setBusy(true)
    setError(null)
    try {
      return await job()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const backupNow = () =>
    run(async () => {
      const b = await window.api.backup.now()
      setDone(`Backup feito: ${b.name} (${size(b.sizeBytes)})`)
      list.reload()
    })
  const restore = () =>
    run(async () => {
      const c = await window.api.backup.pickAndRestore()
      if (c) setCampaign(c)
    })
  const setConfig = (patch: { intervalMin?: number; keep?: number }) =>
    run(async () => {
      if (!config.data) return
      config.setData(await window.api.backup.setConfig({ intervalMin: config.data.intervalMin, keep: config.data.keep, ...patch }))
    })

  return (
    <div className="mx-auto flex max-w-(--layout-reading-max) flex-col gap-6 px-6 py-6">
      <h1 className="type-xl">Ajustes</h1>
      {error && <ErrorNote message={error} />}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="type-lg">Backup</h2>
          <p className="mt-1 text-sm text-muted">
            Cada backup é um único arquivo <span className="font-mono">.mesa-backup</span> com tudo dentro. Se o app quebrar, dá para abrir sem ele: é um zip com a
            campanha em Markdown (para o Obsidian), as imagens e os dados em texto.
          </p>
        </div>
        {config.data && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="type-label text-muted">Pasta dos backups</span>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs" title={config.data.dir}>
                  {config.data.dir}
                </span>
                <Button size="sm" icon={<FolderOpen className="size-4" />} disabled={busy} onClick={() => run(async () => { const c = await window.api.backup.pickDir(); if (c) config.setData(c) })}>
                  Trocar
                </Button>
              </div>
              <p className="text-xs text-subtle">Melhor fora da pasta das campanhas: um pendrive, outro disco ou uma pasta sincronizada.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Backup automático" options={INTERVALS} value={String(config.data.intervalMin)} onChange={(e) => void setConfig({ intervalMin: Number(e.target.value) })} />
              <SelectField label="Guardar" options={KEEP} value={String(config.data.keep)} onChange={(e) => void setConfig({ keep: Number(e.target.value) })} />
            </div>
            <p className="text-xs text-subtle">O automático só roda se algo mudou, e sempre ao fechar a campanha. Os que você faz à mão nunca são apagados.</p>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<HardDriveDownload className="size-4" />} loading={busy} onClick={() => void backupNow()}>
            Fazer backup agora
          </Button>
          {done && (
            <span className="text-sm text-success" role="status">
              {done}
            </span>
          )}
        </div>
      </Card>

      <section aria-labelledby="bk-list-h" className="flex flex-col gap-2">
        <h2 id="bk-list-h" className="type-label text-muted">
          Backups de {campaign.name}
        </h2>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {list.data?.length === 0 && (
          <Card>
            <EmptyState icon={<Archive />} title="Nenhum backup ainda" text="Faça o primeiro agora; os automáticos aparecem aqui também." />
          </Card>
        )}
        <ul className="flex flex-col gap-2" aria-label="Backups">
          {list.data?.map((b) => (
            <li key={b.file} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
              <Archive className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{b.name}</span>
                <span className="block text-xs text-muted">
                  {new Date(b.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {size(b.sizeBytes)}
                </span>
              </span>
              {b.auto && <Chip>automático</Chip>}
              <Button size="sm" variant="ghost" onClick={() => void run(() => window.api.backup.reveal(b.file))}>
                Mostrar na pasta
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <Card className="flex flex-col gap-3">
        <h2 className="type-lg">Restaurar</h2>
        <p className="text-sm text-muted">Abre um backup como campanha nova, ao lado das outras. A campanha aberta agora não é tocada.</p>
        <Button icon={<RotateCcw className="size-4" />} disabled={busy} onClick={() => void restore()} className="self-start">
          Restaurar um backup…
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="type-lg">Aparência</h2>
        <SelectField
          label="Tema"
          className="max-w-64"
          options={[
            { value: 'escuro', label: 'Escuro' },
            { value: 'claro', label: 'Claro' },
            { value: 'sistema', label: 'Igual ao Windows' }
          ]}
          value={theme}
          onChange={(e) => {
            const pref = e.target.value as ThemePref
            setTheme(pref)
            setThemePref(pref)
          }}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="type-lg">Exportar</h2>
        <p className="text-sm text-muted">PDF, Word, texto ou uma pasta para o Obsidian. Dá para tirar os segredos e entregar aos jogadores.</p>
        <Button icon={<FileDown className="size-4" />} onClick={openExport} className="self-start">
          Exportar a campanha…
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="type-lg">Pasta da campanha</h2>
        <p className="truncate font-mono text-xs text-muted" title={campaign.path}>
          {campaign.path}
        </p>
        <Button size="sm" icon={<FolderOpen className="size-4" />} onClick={() => void window.api.campaign.reveal()} className="self-start">
          Abrir a pasta
        </Button>
      </Card>
    </div>
  )
}
