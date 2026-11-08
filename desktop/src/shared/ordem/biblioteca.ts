// Cópia de um registro da biblioteca para a ficha (sem Electron: usada pelo main e pela ficha).
// A ficha guarda uma cópia com id novo e a origem; a página fica só na biblioteca.
import { itemSchema, ritualDaFichaSchema, type Item, type Origem, type RitualDaFicha } from './esquemas'
import type { LibraryEntry } from '../types'

export const origemDe = (e: LibraryEntry): Origem => ({ libraryId: e.id, sourceId: e.sourceId, sourceName: e.sourceName })

/** Item da biblioteca no inventário de uma ficha: id novo, um de quantidade, guardado. */
export function itemParaFicha(e: LibraryEntry<'item'>, id: string): Item {
  const { pagina: _pagina, ...item } = e.data
  return itemSchema.parse({ ...item, id, quantidade: 1, equipado: false, origem: origemDe(e) })
}

/** Ritual da biblioteca na ficha: id novo e a origem. */
export function ritualParaFicha(e: LibraryEntry<'ritual'>, id: string): RitualDaFicha {
  const { alvoTipo: _alvoTipo, pagina: _pagina, ...ritual } = e.data
  return ritualDaFichaSchema.parse({ ...ritual, id, origem: origemDe(e) })
}
