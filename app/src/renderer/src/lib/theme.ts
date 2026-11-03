// Tema escuro (padrão), claro ou o do Windows. É preferência de quem usa o computador: fica no localStorage.
export type ThemePref = 'escuro' | 'claro' | 'sistema'

const KEY = 'mesa.theme'
const media = () => window.matchMedia('(prefers-color-scheme: light)')

export function themePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'claro' || v === 'sistema' ? v : 'escuro'
  } catch {
    return 'escuro'
  }
}

/** O tema que está valendo agora (o "sistema" vira claro ou escuro). */
export const activeTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function apply(pref: ThemePref): void {
  const light = pref === 'claro' || (pref === 'sistema' && media().matches)
  if (light) document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* sem armazenamento: vale só até fechar */
  }
  apply(pref)
}

/** Na abertura: aplica a preferência e acompanha o Windows quando ela for "sistema". */
export function initTheme(): void {
  apply(themePref())
  media().addEventListener('change', () => themePref() === 'sistema' && apply('sistema'))
}
