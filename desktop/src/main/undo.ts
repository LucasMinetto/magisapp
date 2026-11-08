// Desfazer/refazer de qualquer ação na campanha (salvar ficha, lixeira, relógio, quadro…).
// Técnica do próprio SQLite ("undo/redo"): gatilhos TEMPORÁRIOS gravam, para cada linha mudada, o SQL que
// desfaz a mudança. Uma ação da interface = um passo. Nada disso vai para o arquivo da campanha.
import type { DB } from './db'

// Tabelas que o app refaz sozinho a partir das outras (rebuildIndexes): não precisam de registro.
const DERIVED = new Set(['mentions', 'timeline_event_entities', 'clue_links'])

interface Step {
  id: number
  label: string
}

export interface HistoryState {
  undo: string | null
  redo: string | null
}

export class UndoLog {
  private undoSteps: Step[] = []
  private redoSteps: Step[] = []
  private counter = 0
  private open: Step | null = null

  constructor(
    private readonly db: DB,
    private readonly limit = 50
  ) {
    db.exec(`
      create temp table if not exists undolog (seq integer primary key, step integer not null, sql text not null);
      create temp table if not exists undostate (active integer not null, step integer not null);
      delete from undostate; insert into undostate values (0, 0);`)
    const tables = (
      db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like 'search_index%'").all() as { name: string }[]
    )
      .map((r) => r.name)
      .filter((t) => !DERIVED.has(t))
    for (const t of tables) this.watch(t)
  }

  private watch(table: string): void {
    const cols = (this.db.prepare(`pragma table_info("${table}")`).all() as { name: string }[]).map((c) => `"${c.name}"`)
    const q = (c: string) => `quote(old.${c})`
    const rec = (sql: string) => `insert into undolog (step, sql) values ((select step from undostate), ${sql});`
    const when = 'when (select active from undostate) = 1'
    const t = `"${table}"`
    this.db.exec(`
      create temp trigger if not exists "undo_${table}_i" after insert on main.${t} ${when} begin
        ${rec(`'delete from ${t.replaceAll("'", "''")} where rowid = ' || new.rowid`)}
      end;
      create temp trigger if not exists "undo_${table}_u" after update on main.${t} ${when} begin
        ${rec(`'update ${t.replaceAll("'", "''")} set ${cols.map((c) => `${c.replaceAll("'", "''")} = ' || ${q(c)} || '`).join(', ')} where rowid = ' || old.rowid`)}
      end;
      create temp trigger if not exists "undo_${table}_d" after delete on main.${t} ${when} begin
        ${rec(`'insert into ${t.replaceAll("'", "''")} (rowid, ${cols.join(', ').replaceAll("'", "''")}) values (' || old.rowid || ', ' || ${cols.map(q).join(" || ', ' || ")} || ')'`)}
      end;`)
  }

  private setState(active: 0 | 1, step: number): void {
    this.db.prepare('update undostate set active = ?, step = ?').run(active, step)
  }

  private hasRows(step: number): boolean {
    return !!this.db.prepare('select 1 from undolog where step = ? limit 1').get(step)
  }

  private drop(steps: Step[]): void {
    const del = this.db.prepare('delete from undolog where step = ?')
    for (const s of steps) del.run(s.id)
  }

  /** Começa a gravar uma ação da interface. Chamadas aninhadas entram no passo já aberto. */
  begin(label: string): () => void {
    if (this.open) return () => {}
    const step = { id: ++this.counter, label }
    this.open = step
    this.setState(1, step.id)
    return () => {
      this.setState(0, 0)
      this.open = null
      if (!this.hasRows(step.id)) return // não mudou nada: não vira passo
      this.undoSteps.push(step)
      this.drop(this.redoSteps) // ação nova apaga o que dava para refazer
      this.redoSteps = []
      if (this.undoSteps.length > this.limit) this.drop(this.undoSteps.splice(0, this.undoSteps.length - this.limit))
    }
  }

  /** Roda o passo ao contrário, gravando o caminho de volta num passo novo. */
  private replay(from: Step[], to: Step[]): string | null {
    const step = from.pop()
    if (!step) return null
    const sqls = (this.db.prepare('select sql from undolog where step = ? order by seq desc').all(step.id) as { sql: string }[]).map((r) => r.sql)
    const back = { id: ++this.counter, label: step.label }
    this.db.transaction(() => {
      this.db.pragma('defer_foreign_keys = on') // a ordem das linhas não precisa respeitar as chaves; confere no fim
      this.db.prepare('delete from undolog where step = ?').run(step.id)
      this.setState(1, back.id)
      try {
        for (const sql of sqls) this.db.exec(sql)
      } finally {
        this.setState(0, 0)
      }
    })()
    to.push(back)
    return step.label
  }

  undo(): string | null {
    return this.replay(this.undoSteps, this.redoSteps)
  }

  redo(): string | null {
    return this.replay(this.redoSteps, this.undoSteps)
  }

  state(): HistoryState {
    return { undo: this.undoSteps.at(-1)?.label ?? null, redo: this.redoSteps.at(-1)?.label ?? null }
  }
}

/** Nome da ação para o botão "Desfazer: …". */
export const ACTION_LABEL: Record<string, string> = {
  'entities:save': 'editar ficha',
  'entities:setSheet': 'mudar o tamanho da ficha',
  'rolls:add': 'rolagem',
  'rolls:remove': 'apagar rolagem',
  'sessions:saveInitiative': 'iniciativa',
  'library:copyToCampaign': 'trazer da biblioteca',
  'entities:trash': 'ficha para a lixeira',
  'scenes:save': 'editar cena',
  'scenes:trash': 'cena para a lixeira',
  'scenes:reorder': 'reordenar cenas',
  'scenes:saveNote': 'nota da cena',
  'scenes:deleteNote': 'apagar nota da cena',
  'scenes:attach': 'anexar à cena',
  'scenes:detach': 'tirar anexo da cena',
  'events:save': 'editar evento',
  'events:trash': 'evento para a lixeira',
  'clues:save': 'editar pista',
  'clues:trash': 'pista para a lixeira',
  'clock:set': 'mudar a hora no jogo',
  'clock:advance': 'avançar o relógio',
  'boards:create': 'criar quadro',
  'boards:save': 'editar quadro',
  'boards:trash': 'quadro para a lixeira',
  'documents:save': 'editar texto',
  'documents:trash': 'texto para a lixeira',
  'sessions:create': 'começar sessão',
  'sessions:saveNotes': 'notas da sessão',
  'campaign:update': 'editar campanha',
  'attachments:setKind': 'tipo do arquivo',
  'trash:restore': 'restaurar da lixeira',
  'trash:purge': 'apagar de vez',
  'structures:apply': 'aplicar modelo',
  'entities:importFrom': 'trazer fichas de outra campanha',
  'attachments:import': 'importar arquivo',
  'attachments:pickImage': 'importar imagem',
  'attachments:pickFiles': 'importar arquivos',
  'attachments:importPaths': 'importar arquivos'
}
