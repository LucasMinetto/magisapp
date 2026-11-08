// Número de versão no formato 1.2.3 (maior.menor.correção) e a decisão do aviso de versão nova.

/** O que o repositório publica em versao.json, na raiz. */
export interface VersaoPublicada {
  versao: string
  /** Menor versão que ainda pode ser usada; abaixo dela a atualização é obrigatória. */
  minimo: string
  publicada_em: string
  notas: string[]
}

const PADRAO = /^(\d+)\.(\d+)\.(\d+)$/

export function versaoValida(v: string): boolean {
  return PADRAO.test(v)
}

/** Negativo se a < b, zero se iguais, positivo se a > b. */
export function compararVersoes(a: string, b: string): number {
  const pa = PADRAO.exec(a)
  const pb = PADRAO.exec(b)
  if (!pa || !pb) throw new Error(`Versão inválida: ${!pa ? a : b}`)
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i])
    if (d !== 0) return d
  }
  return 0
}

/** Lê e confere o versao.json publicado. Erro claro se estiver malformado. */
export function lerVersaoPublicada(texto: string): VersaoPublicada {
  const bruto = JSON.parse(texto) as Partial<VersaoPublicada>
  if (typeof bruto.versao !== 'string' || !versaoValida(bruto.versao)) throw new Error('versao.json sem "versao" no formato 1.2.3')
  const minimo = typeof bruto.minimo === 'string' && versaoValida(bruto.minimo) ? bruto.minimo : '0.0.0'
  const notas = Array.isArray(bruto.notas) ? bruto.notas.filter((n): n is string => typeof n === 'string') : []
  return { versao: bruto.versao, minimo, publicada_em: typeof bruto.publicada_em === 'string' ? bruto.publicada_em : '', notas }
}

export interface Decisao {
  nova: string | null
  obrigatoria: boolean
}

/** Há versão nova quando a publicada é maior que a instalada; é obrigatória quando a instalada está abaixo do mínimo. */
export function decidirAtualizacao(instalada: string, publicada: VersaoPublicada): Decisao {
  if (compararVersoes(publicada.versao, instalada) <= 0) return { nova: null, obrigatoria: false }
  return { nova: publicada.versao, obrigatoria: compararVersoes(instalada, publicada.minimo) < 0 }
}
