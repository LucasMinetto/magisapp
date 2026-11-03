import {
  BookMarked,
  CalendarClock,
  CircleHelp,
  Clapperboard,
  Clock,
  Dices,
  FileText,
  FolderArchive,
  FolderOpen,
  Home as HomeIcon,
  LogOut,
  Maximize2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Search,
  SearchCheck,
  Settings,
  Trash2,
  Undo2,
  Users
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { flushAllAutosaves, useLoad } from '@/lib/data'
import { formatGameTime } from '@shared/gameTime'
import { useCampaign, useClock, useOpenCampaign } from '@/campaign'
import { cx, IconButton } from '@/ui'
import { CommandPalette } from './CommandPalette'
import { ExportProvider } from './ExportDialog'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

const CAMPAIGN_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: <HomeIcon />, end: true },
  { to: '/fichas', label: 'Fichas', icon: <Users /> },
  { to: '/cenas', label: 'Cenas', icon: <Clapperboard /> },
  { to: '/linha-do-tempo', label: 'Linha do tempo', icon: <CalendarClock /> },
  { to: '/pistas', label: 'Pistas', icon: <SearchCheck /> },
  { to: '/quadros', label: 'Quadros', icon: <Network /> },
  { to: '/textos', label: 'Textos', icon: <FileText /> },
  { to: '/arquivos', label: 'Arquivos', icon: <FolderArchive /> },
  { to: '/biblioteca', label: 'Biblioteca', icon: <BookMarked /> }
]
const TABLE_NAV: NavItem[] = [{ to: '/sessao', label: 'Sessão', icon: <Dices /> }]
const FOOT_NAV: NavItem[] = [
  { to: '/lixeira', label: 'Lixeira', icon: <Trash2 /> },
  { to: '/ajustes', label: 'Ajustes', icon: <Settings /> },
  { to: '/ajuda', label: 'Ajuda', icon: <CircleHelp /> }
]

const OPEN_KEY = 'magistrado.sidebar.open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

function NavRow({ item, open }: { item: NavItem; open: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={open ? undefined : item.label}
      className={({ isActive }) =>
        cx(
          'relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
          isActive
            ? 'bg-surface-raised text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent'
            : 'text-muted hover:bg-surface-raised hover:text-fg'
        )
      }
    >
      {item.icon}
      {open && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export function Shell() {
  const campaign = useOpenCampaign()
  const { setCampaign, changed, version } = useCampaign()
  const [open, setOpen] = useState(readOpen)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const clock = useClock()
  const location = useLocation()
  const history = useLoad(() => window.api.history.state(), [version])
  // Sobe a cada desfazer: a tela atual remonta e relê os dados do banco.
  const [epoch, setEpoch] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  // Modo foco: só o conteúdo na tela (para escrever ou ler na mesa).
  const [focus, setFocus] = useState(false)
  const travel = useCallback(
    async (direction: 'undo' | 'redo') => {
      await flushAllAutosaves() // o que está digitado entra no histórico antes de voltar
      const r = await (direction === 'undo' ? window.api.history.undo() : window.api.history.redo())
      if (!r.label) return
      setCampaign(r.campaign)
      changed()
      setEpoch((n) => n + 1)
      setToast(`${direction === 'undo' ? 'Desfeito' : 'Refeito'}: ${r.label}`)
    },
    [setCampaign, changed]
  )
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0')
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      // Alt+→ / Alt+← andam 10 min no jogo; com Shift, 1 hora. Fora de campos de texto.
      if (
        e.altKey &&
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
        !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 60 : 10
        void clock.advance(e.key === 'ArrowRight' ? step : -step)
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFocus((v) => !v)
      }
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setFocus(false)
      // Ctrl+Z / Ctrl+Y fora dos campos de texto (lá dentro, o desfazer é o do próprio campo).
      // O quadro tem o desfazer dele, mais fino (posição de cada cartão).
      const typing = !!(e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')
      if ((e.ctrlKey || e.metaKey) && !typing && !location.pathname.startsWith('/quadros') && !document.querySelector('[role="dialog"]')) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          void travel('undo')
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault()
          void travel('redo')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clock, travel, location.pathname])

  const closeCampaign = async () => {
    await window.api.campaign.close()
    setCampaign(null)
  }

  return (
    <ExportProvider>
      <div className="flex h-full">
        {focus && (
          <button
            type="button"
            onClick={() => setFocus(false)}
            className="fixed top-2 right-3 z-40 rounded-md border border-border bg-surface/90 px-3 py-1 text-xs text-muted hover:text-fg"
          >
            Sair do modo foco (Esc)
          </button>
        )}
        <nav
          aria-label="Principal"
          hidden={focus}
          className={cx(
            'flex shrink-0 flex-col gap-0.5 border-r border-border bg-surface p-2',
            open ? 'w-(--layout-sidebar-open)' : 'w-(--layout-sidebar-collapsed)'
          )}
        >
          <div className={cx('mb-2 flex items-center', open ? 'justify-between pl-2.5' : 'justify-center')}>
            {open && <span className="type-label text-subtle">Campanha</span>}
            <IconButton label={open ? 'Recolher menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </IconButton>
          </div>
          {CAMPAIGN_NAV.map((item) => (
            <NavRow key={item.to} item={item} open={open} />
          ))}
          {open && <span className="type-label px-2.5 pt-3 pb-1 text-subtle">Mesa</span>}
          {TABLE_NAV.map((item) => (
            <NavRow key={item.to} item={item} open={open} />
          ))}
          <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              title={open ? undefined : 'Buscar (Ctrl+K)'}
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted hover:bg-surface-raised hover:text-fg"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              {open && (
                <>
                  <span className="flex-1 text-left">Buscar</span>
                  <kbd className="rounded-sm border border-border-input px-1.5 font-mono text-xs text-subtle">Ctrl K</kbd>
                </>
              )}
              {!open && <span className="sr-only">Buscar</span>}
            </button>
            {FOOT_NAV.map((item) => (
              <NavRow key={item.to} item={item} open={open} />
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header hidden={focus} className="flex h-(--layout-topbar) shrink-0 items-center gap-3 border-b border-border px-4">
            <h1 className="type-lg min-w-0 truncate" title={campaign.path}>
              {campaign.name}
            </h1>
            <div className="flex items-center gap-1">
              <Link
                to="/linha-do-tempo"
                className="inline-flex h-7 items-center gap-2 rounded-pill border border-border bg-surface px-3 font-mono text-xs hover:border-border-input"
                title="Agora no jogo · abrir a linha do tempo"
              >
                <Clock className="size-3.5 text-muted" aria-hidden />
                <span className="sr-only">Agora no jogo: </span>
                <span aria-live="polite">{formatGameTime(campaign.epochDate, campaign.currentGameMinute)}</span>
              </Link>
              <button
                type="button"
                onClick={() => void clock.advance(10)}
                title="Avançar 10 minutos no jogo (Alt+→)"
                className="h-7 rounded-md px-2 font-mono text-xs text-muted hover:bg-surface-raised hover:text-fg"
              >
                +10 min
              </button>
              <button
                type="button"
                onClick={() => void clock.advance(60)}
                title="Avançar 1 hora no jogo (Alt+Shift+→)"
                className="h-7 rounded-md px-2 font-mono text-xs text-muted hover:bg-surface-raised hover:text-fg"
              >
                +1 h
              </button>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <IconButton
                label={history.data?.undo ? `Desfazer: ${history.data.undo} (Ctrl+Z)` : 'Nada para desfazer'}
                disabled={!history.data?.undo}
                onClick={() => void travel('undo')}
                className="disabled:opacity-35"
              >
                <Undo2 className="size-4" />
              </IconButton>
              <IconButton
                label={history.data?.redo ? `Refazer: ${history.data.redo} (Ctrl+Y)` : 'Nada para refazer'}
                disabled={!history.data?.redo}
                onClick={() => void travel('redo')}
                className="disabled:opacity-35"
              >
                <Redo2 className="size-4" />
              </IconButton>
              <IconButton label="Modo foco (Ctrl+Shift+F)" onClick={() => setFocus(true)}>
                <Maximize2 className="size-4" />
              </IconButton>
              <IconButton label="Abrir a pasta da campanha" onClick={() => window.api.campaign.reveal()}>
                <FolderOpen className="size-4" />
              </IconButton>
              <IconButton label="Fechar campanha" onClick={closeCampaign}>
                <LogOut className="size-4" />
              </IconButton>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet key={epoch} />
            {toast && (
              <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-surface-raised px-4 py-2 text-sm shadow-pop">
                {toast}
              </div>
            )}
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </ExportProvider>
  )
}
