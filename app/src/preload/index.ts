import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api, IpcResult } from '../shared/types'

// Cada função chama o canal de mesmo nome e transforma { ok: false } em erro de verdade.
const call =
  <T>(channel: string) =>
  async (input?: unknown): Promise<T> => {
    const res = (await ipcRenderer.invoke(channel, input)) as IpcResult<T>
    if (!res.ok) throw new Error(res.error)
    return res.data
  }

const api: Api = {
  campaign: {
    recent: call('campaign:recent'),
    create: call('campaign:create'),
    open: call('campaign:open'),
    pickAndOpen: call('campaign:pickAndOpen'),
    current: call('campaign:current'),
    counts: call('campaign:counts'),
    close: call('campaign:close'),
    reveal: call('campaign:reveal'),
    update: call('campaign:update'),
    renameRecent: call('campaign:renameRecent'),
    revealRecent: call('campaign:revealRecent'),
    backupRecent: call('campaign:backupRecent'),
    trashRecent: call('campaign:trashRecent')
  },
  documents: { list: call('documents:list'), get: call('documents:get'), save: call('documents:save'), trash: call('documents:trash') },
  trash: { list: call('trash:list'), restore: call('trash:restore'), purge: call('trash:purge') },
  export: { run: call('export:run'), reveal: call('export:reveal') },
  history: { state: call('history:state'), undo: call('history:undo'), redo: call('history:redo') },
  structures: { list: call('structures:list'), apply: call('structures:apply'), save: call('structures:save'), remove: call('structures:remove') },
  backup: {
    config: call('backup:config'),
    setConfig: call('backup:setConfig'),
    pickDir: call('backup:pickDir'),
    now: call('backup:now'),
    list: call('backup:list'),
    reveal: call('backup:reveal'),
    pickAndRestore: call('backup:pickAndRestore')
  },
  templates: { list: call('templates:list') },
  entities: {
    list: call('entities:list'),
    get: call('entities:get'),
    save: call('entities:save'),
    trash: call('entities:trash'),
    mentionTargets: call('entities:mentionTargets'),
    peekOther: call('entities:peekOther'),
    importFrom: call('entities:importFrom'),
    setSheet: call('entities:setSheet')
  },
  rolls: { list: call('rolls:list'), add: call('rolls:add'), remove: call('rolls:remove') },
  library: {
    sources: call('library:sources'),
    saveSource: call('library:saveSource'),
    deleteSource: call('library:deleteSource'),
    list: call('library:list'),
    get: call('library:get'),
    save: call('library:save'),
    remove: call('library:remove'),
    copyToCampaign: call('library:copyToCampaign'),
    backup: call('library:backup'),
    pickAndRestore: call('library:pickAndRestore'),
    importTokens: call('library:importTokens'),
    pickToken: call('library:pickToken'),
    clearToken: call('library:clearToken')
  },
  scenes: {
    saveNote: call('scenes:saveNote'),
    deleteNote: call('scenes:deleteNote'),
    reorder: call('scenes:reorder'),
    attach: call('scenes:attach'),
    detach: call('scenes:detach'),
    list: call('scenes:list'),
    get: call('scenes:get'),
    save: call('scenes:save'),
    trash: call('scenes:trash')
  },
  clock: { set: call('clock:set'), advance: call('clock:advance') },
  timeline: { list: call('timeline:list') },
  events: { get: call('events:get'), save: call('events:save'), trash: call('events:trash') },
  attachments: {
    pickImage: call('attachments:pickImage'),
    importPath: call('attachments:import'),
    pickFiles: call('attachments:pickFiles'),
    importPaths: call('attachments:importPaths'),
    list: call('attachments:list'),
    get: call('attachments:get'),
    setKind: call('attachments:setKind'),
    openExternal: call('attachments:openExternal')
  },
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  sessions: {
    list: call('sessions:list'),
    create: call('sessions:create'),
    get: call('sessions:get'),
    saveNotes: call('sessions:saveNotes'),
    initiative: call('sessions:initiative'),
    saveInitiative: call('sessions:saveInitiative')
  },
  clues: { list: call('clues:list'), get: call('clues:get'), save: call('clues:save'), trash: call('clues:trash') },
  boards: { list: call('boards:list'), create: call('boards:create'), get: call('boards:get'), save: call('boards:save'), trash: call('boards:trash') },
  search: { query: call('search:query') }
}

contextBridge.exposeInMainWorld('api', api)
