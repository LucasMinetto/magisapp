// Timeout de fetch portátil: `AbortSignal.timeout` não existe no Hermes nativo.
// Usa `AbortSignal.timeout` quando disponível (web/node) e cai para um
// AbortController + setTimeout quando não (React Native / Hermes).

export function timeoutSignal(ms: number): AbortSignal {
  const AbortSignalAny = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof AbortSignalAny?.timeout === 'function') {
    return AbortSignalAny.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
