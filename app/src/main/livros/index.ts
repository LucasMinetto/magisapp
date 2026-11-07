// Dados extraídos dos livros (tools/livros/extrair.py): rituais, itens e ameaças com a página de origem.
// A biblioteca semeia estes registros com ids fixos; o mestre pode editar ou apagar à vontade.
import oprpg from './oprpg.json'
import sah from './sah.json'

export interface LivroDados {
  fonte: { nome: string; sigla: string }
  rituais: ({ id: string; nome: string } & Record<string, unknown>)[]
  itens: ({ id: string; nome: string } & Record<string, unknown>)[]
  ameacas: ({ id: string; nome: string } & Record<string, unknown>)[]
}

/** Sobe quando os JSON mudarem: a biblioteca acrescenta o que faltar (não sobrescreve edições). */
export const LIVROS_VERSAO = 1
export const LIVROS: LivroDados[] = [oprpg, sah] as unknown as LivroDados[]
