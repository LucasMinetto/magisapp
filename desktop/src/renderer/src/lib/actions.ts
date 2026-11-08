import type { Clue, EntityKind, TimelineEvent } from '@shared/types'

export const KIND_LABEL: Record<EntityKind, { one: string; many: string }> = {
  personagem: { one: 'Personagem', many: 'Personagens' },
  ameaca: { one: 'Ameaça', many: 'Ameaças' },
  local: { one: 'Local', many: 'Locais' },
  grupo: { one: 'Grupo', many: 'Grupos' },
  lore: { one: 'Lore', many: 'Lore' }
}

/** Cria uma ficha vazia e devolve o id, para abrir direto na edição. */
export async function createEntity(kind: EntityKind, name = ''): Promise<string> {
  const e = await window.api.entities.save({
    kind,
    name,
    role: '',
    isPlayer: false,
    aliases: [],
    stats: {},
    description: '',
    personality: '',
    portraitId: null,
    customAttributes: []
  })
  return e.id
}

export async function createScene(title = ''): Promise<string> {
  const s = await window.api.scenes.save({
    title,
    summary: '',
    body: null,
    status: 'planejada',
    locationId: null,
    gameMinuteStart: null,
    gameMinuteEnd: null
  })
  return s.id
}

/** Pista nova, oculta. Com imagem quando nasce de um arquivo solto na tela. */
export async function createClue(title = '', imageId: string | null = null): Promise<Clue> {
  return window.api.clues.save({
    title,
    description: '',
    reveals: '',
    status: 'oculta',
    imageId,
    plannedSceneId: null,
    locationId: null,
    foundGameMinute: null,
    foundSessionId: null,
    finderIds: []
  })
}

/** Evento novo na hora indicada (a hora atual no jogo, ou o começo de uma lacuna).
 *  Antes da hora atual ele já aconteceu: é o registro do que os jogadores fizeram. */
export async function createEvent(minute: number, now: number, title = ''): Promise<TimelineEvent> {
  return window.api.events.save({
    title,
    description: '',
    ifIgnored: '',
    status: minute < now ? 'aconteceu' : 'planejado',
    gameMinuteStart: minute,
    gameMinuteEnd: null,
    sceneId: null,
    locationId: null
  })
}
