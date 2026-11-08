// Importar um pacote da biblioteca (T11). Antes de mudar qualquer coisa, mostra o que o pacote traz, origem por
// origem: a origem nova entra como está; a que já existe aqui espera o mestre escolher entre atualizar e
// importar como cópia. O mesmo nome em outra origem só é avisado: as duas versões convivem.
import { useState } from 'react'
import { Button, Dialog, ErrorNote } from '@/ui'
import type { ImportChoice, ImportPreview, ImportPreviewSource, PackageImportResult } from '@shared/types'

const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`

function resumo(o: ImportPreviewSource): string {
  if (!o.match) return `Origem nova: ${n(o.total, 'registro', 'registros')}.`
  const partes = [
    o.mudam > 0 && `${n(o.mudam, 'muda', 'mudam')}`,
    o.novos > 0 && `${n(o.novos, 'é novo', 'são novos')}`,
    o.iguais > 0 && `${n(o.iguais, 'já está igual', 'já estão iguais')}`,
    o.soAqui > 0 && `${n(o.soAqui, 'só existe aqui', 'só existem aqui')} e não muda`
  ].filter(Boolean)
  return `Já existe aqui como "${o.match.name}". ${partes.join(', ')}.`
}

export function ImportarPacote({ preview, onClose, onDone }: { preview: ImportPreview; onClose: () => void; onDone: (r: PackageImportResult) => void }) {
  // Sem escolha, a origem que já existe fica como está; o mestre marca o que quer.
  const [choices, setChoices] = useState<Record<string, ImportChoice | ''>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const novas = preview.origens.filter((o) => !o.match)
  const existentes = preview.origens.filter((o) => o.match)
  const escolhidas = Object.fromEntries(Object.entries(choices).filter(([, v]) => v)) as Record<string, ImportChoice>
  const nada = novas.length === 0 && Object.keys(escolhidas).length === 0

  const importar = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await window.api.library.importPackage({ file: preview.file, choices: escolhidas }))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Importar para a biblioteca"
      description="Nada muda até você confirmar."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void importar()} disabled={busy || nada}>
            Importar
          </Button>
        </>
      }
    >
      <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto" aria-label="Origens do pacote">
        {[...novas, ...existentes].map((o) => (
          <li key={o.pacoteId} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm" aria-label={`Origem ${o.name}`}>
            <div>
              <p className="font-medium text-fg">{o.name}</p>
              <p className="text-muted">{resumo(o)}</p>
              {o.mesmoNomeEmOutra > 0 && (
                <p className="text-subtle">
                  {n(o.mesmoNomeEmOutra, 'registro tem', 'registros têm')} o mesmo nome em outra origem daqui. As duas versões ficam.
                </p>
              )}
            </div>
            {o.match && (
              <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                <legend className="sr-only">O que fazer com {o.name}</legend>
                {(
                  [
                    ['', 'Não importar'],
                    ['atualizar', `Atualizar "${o.match.name}"`],
                    ['copia', 'Importar como cópia']
                  ] as const
                ).map(([v, rotulo]) => (
                  <label key={v} className="flex items-center gap-1.5">
                    <input type="radio" name={`escolha-${o.pacoteId}`} value={v} checked={(choices[o.pacoteId] ?? '') === v} onChange={() => setChoices((c) => ({ ...c, [o.pacoteId]: v }))} />
                    {rotulo}
                  </label>
                ))}
              </fieldset>
            )}
          </li>
        ))}
      </ul>
      {error && <ErrorNote message={error} />}
    </Dialog>
  )
}

/** Frase do que a importação fez, para o aviso depois de importar. */
export const resultadoDaImportacao = (r: PackageImportResult) =>
  r.origens === 0 ? 'Nada foi importado.' : `Importado: ${n(r.novos, 'registro novo', 'registros novos')} e ${n(r.atualizados, 'atualizado', 'atualizados')}.`
