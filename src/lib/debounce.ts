// Saver debounced sem React: agenda a última edição e grava uma única vez depois
// do atraso (ou no flush). Uma rajada de edições gera um só `save`.
// A serialização das gravações evita que dois flushs sobreponham as escritas.

export interface DebouncedSaver<T> {
  /** Agenda `value`; se já houver um agendamento, substitui o valor pendente. */
  schedule: (value: T) => void;
  /** Grava já o valor pendente (sem esperar o atraso) e aguarda a gravação. */
  flush: () => Promise<void>;
  /** Descarta o valor pendente sem gravar. */
  cancel: () => void;
  /** Há uma edição aguardando gravação? */
  hasPending: () => boolean;
}

export function createDebouncedSaver<T>(
  save: (value: T) => Promise<void> | void,
  delay = 600
): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;
  let running: Promise<void> = Promise.resolve();

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;
    const value = pending.value;
    pending = null;
    running = running.then(() => save(value));
    await running;
  };

  const schedule = (value: T): void => {
    pending = { value };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, delay);
  };

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { schedule, flush, cancel, hasPending: () => pending !== null };
}
