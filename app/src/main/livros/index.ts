// Dados extraídos dos livros (tools/livros/extrair.py): rituais, itens e ameaças com a página de origem.
// A biblioteca semeia estes registros com ids fixos; o mestre pode editar ou apagar à vontade.
import oprpg from './oprpg.json'
import sah from './sah.json'
import tokens from './tokens.json'
import anteriores from './anteriores.json'

export interface LivroDados {
  fonte: { nome: string; sigla: string }
  rituais: ({ id: string; nome: string } & Record<string, unknown>)[]
  itens: ({ id: string; nome: string } & Record<string, unknown>)[]
  ameacas: ({ id: string; nome: string } & Record<string, unknown>)[]
}

/**
 * Sobe quando os JSON mudarem. A biblioteca acrescenta o que faltar e troca pelos dados novos os registros que ainda
 * estão como vieram do livro (os editados pelo mestre ficam e viram aviso). Versão 3: conferência com os livros.
 */
export const LIVROS_VERSAO = 3

/**
 * Os registros que mudaram desde a versão anterior, como eram nela: a biblioteca compara com o que tem para saber se
 * o mestre editou. Gerado na conferência (tools/livros), a partir dos JSON da versão anterior.
 */
export const LIVROS_ANTERIORES = (anteriores as { registros: Record<string, Record<string, unknown>> }).registros

/** Tokens das ameaças (tools/livros/tokens.py): as imagens ficam em app/resources/livros-tokens. */
const TOKENS = tokens as Record<string, { token: string; extras: string[] }>

const comTokens = (livro: LivroDados): LivroDados => ({
  ...livro,
  ameacas: livro.ameacas.map((a) => (TOKENS[a.id] ? { ...a, token: TOKENS[a.id].token, tokensExtras: TOKENS[a.id].extras } : a))
})

export const LIVROS: LivroDados[] = ([oprpg, sah] as unknown as LivroDados[]).map(comTokens)
