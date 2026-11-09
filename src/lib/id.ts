// Utilitários para geração de IDs únicos.

/** Gera um ID único usando crypto.randomUUID (padrão Web Crypto API). */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para ambientes sem crypto.randomUUID (ex: Node.js antigo)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Gera um ID curto (não criptográfico) para uso interno. */
export function generateShortId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
