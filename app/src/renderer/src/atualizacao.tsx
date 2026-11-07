import { Download, HardDriveDownload, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EstadoAtualizacao } from '@shared/types'
import { Button, Card, Dialog, ErrorNote } from '@/ui'

/** Estado da atualização, vivo: o processo principal avisa a cada mudança. */
export function useAtualizacao(): EstadoAtualizacao | null {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  useEffect(() => {
    void window.api.atualizacao.estado().then(setEstado)
    return window.api.atualizacao.aoMudar(setEstado)
  }, [])
  return estado
}

const data = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')

function Notas({ estado }: { estado: EstadoAtualizacao }) {
  if (estado.notas.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label text-muted">Novidades{estado.publicadaEm ? ` · ${data(estado.publicadaEm)}` : ''}</span>
      <ul className="list-disc pl-5 text-sm">
        {estado.notas.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}

/** Faz backup da campanha aberta e da biblioteca. Devolve o que foi salvo. */
async function backupAntes(): Promise<string> {
  const feitos: string[] = []
  if (await window.api.campaign.current()) feitos.push(`campanha (${(await window.api.backup.now()).name})`)
  await window.api.library.backup()
  feitos.push('biblioteca')
  return `Backup feito: ${feitos.join(' e ')}.`
}

function useAplicar() {
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const aplicar = async () => {
    setErro(null)
    try {
      setAviso(await window.api.atualizacao.aplicar())
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return { erro, aviso, aplicar }
}

/** Aviso "Nova versão X", em qualquer tela. A obrigatória não fecha e oferece backup antes. */
export function AvisoAtualizacao() {
  const estado = useAtualizacao()
  const { erro, aviso, aplicar } = useAplicar()
  const [backup, setBackup] = useState<{ busy: boolean; msg: string | null; erro: string | null }>({ busy: false, msg: null, erro: null })
  if (!estado?.nova) return null
  const adiado = !estado.obrigatoria && estado.adiadoAte && new Date(estado.adiadoAte) > new Date()
  if (adiado) return null

  const fazerBackup = async () => {
    setBackup({ busy: true, msg: null, erro: null })
    try {
      setBackup({ busy: false, msg: await backupAntes(), erro: null })
    } catch (e) {
      setBackup({ busy: false, msg: null, erro: (e as Error).message })
    }
  }

  return (
    <Dialog
      open
      closable={!estado.obrigatoria}
      onOpenChange={(open) => {
        if (!open && !estado.obrigatoria && !estado.atualizando) void window.api.atualizacao.adiar()
      }}
      title={`Nova versão ${estado.nova}`}
      description={
        estado.obrigatoria
          ? `Esta atualização é obrigatória: a versão ${estado.instalada} não pode mais ser usada.`
          : `Você está na versão ${estado.instalada}.`
      }
      footer={
        <>
          {estado.obrigatoria ? (
            <Button icon={<HardDriveDownload className="size-4" />} loading={backup.busy} disabled={estado.atualizando} onClick={() => void fazerBackup()}>
              Fazer backup antes
            </Button>
          ) : (
            <Button variant="ghost" disabled={estado.atualizando} onClick={() => void window.api.atualizacao.adiar()}>
              Depois
            </Button>
          )}
          <Button variant="primary" icon={<Download className="size-4" />} loading={estado.atualizando} onClick={() => void aplicar()}>
            Atualizar agora
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Notas estado={estado} />
        {estado.atualizando && (
          <p className="text-sm text-muted" role="status">
            Baixando e preparando a versão nova. O Magistrado fecha e abre de novo sozinho; pode levar um minuto.
          </p>
        )}
        {backup.msg && (
          <p className="text-sm text-success" role="status">
            {backup.msg}
          </p>
        )}
        {backup.erro && <ErrorNote message={backup.erro} />}
        {aviso && (
          <p className="text-sm text-success" role="status">
            {aviso}
          </p>
        )}
        {erro && <ErrorNote message={erro} />}
        {!estado.atualizando && !erro && <p className="text-xs text-subtle">Suas campanhas e a biblioteca ficam fora do programa e não são tocadas.</p>}
      </div>
    </Dialog>
  )
}

/** Cartão "Versão do Magistrado" na tela Ajustes. */
export function CartaoVersao() {
  const estado = useAtualizacao()
  const { erro, aviso, aplicar } = useAplicar()
  if (!estado) return null
  const quando = estado.verificadoEm ? new Date(estado.verificadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="type-lg">Versão do Magistrado</h2>
        <p className="mt-1 text-sm text-muted">
          Versão instalada: <span className="font-mono text-text">{estado.instalada}</span>
          {quando && <> · verificado em {quando}</>}
        </p>
      </div>
      {!estado.disponivel ? (
        <p className="text-sm text-muted">Esta cópia não veio do repositório git, então não verifica atualizações sozinha.</p>
      ) : estado.nova ? (
        <>
          <p className="text-sm">
            Versão nova disponível: <span className="font-mono">{estado.nova}</span>
            {estado.obrigatoria && ' (obrigatória)'}
          </p>
          <Notas estado={estado} />
          <Button variant="primary" icon={<Download className="size-4" />} loading={estado.atualizando} onClick={() => void aplicar()} className="self-start">
            Atualizar agora
          </Button>
        </>
      ) : (
        quando && !estado.erro && <p className="text-sm text-success">Você está na versão mais nova.</p>
      )}
      {estado.disponivel && !estado.nova && (
        <Button
          size="sm"
          icon={<RefreshCw className="size-4" />}
          loading={estado.verificando}
          onClick={() => void window.api.atualizacao.verificar()}
          className="self-start"
        >
          Verificar atualizações
        </Button>
      )}
      {estado.erro && <ErrorNote message={estado.erro} />}
      {aviso && (
        <p className="text-sm text-success" role="status">
          {aviso}
        </p>
      )}
      {erro && erro !== estado.erro && <ErrorNote message={erro} />}
    </Card>
  )
}
