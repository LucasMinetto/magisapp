import { useCallback, useEffect, useRef, useState } from 'react'

/** Carrega dados do processo principal e recarrega quando `deps` mudam. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const run = useCallback(() => {
    const mine = ++seq.current
    setLoading(true)
    load()
      .then((d) => mine === seq.current && (setData(d), setError(null)))
      .catch((e: Error) => mine === seq.current && setError(e.message))
      .finally(() => mine === seq.current && setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(run, [run])
  return { data, error, loading, reload: run, setData }
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// Todos os salvamentos pendentes da tela, para o desfazer salvar antes de voltar no tempo.
const flushers = new Set<() => Promise<void>>()

/** Salva já tudo o que está esperando o debounce. */
export async function flushAllAutosaves(): Promise<void> {
  await Promise.all([...flushers].map((f) => f()))
}

/** Salva com debounce. `flush` salva já (ao trocar de tela). */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 600) {
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const job = pending.current
    if (!job) return
    pending.current = null
    setState('saving')
    try {
      await saveRef.current(job.value)
      setState('saved')
      setError(null)
    } catch (e) {
      setState('error')
      setError((e as Error).message)
    }
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      setState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [flush, delay]
  )

  useEffect(() => {
    flushers.add(flush)
    return () => {
      flushers.delete(flush)
      void flush()
    }
  }, [flush])
  return { state, error, schedule, flush }
}
