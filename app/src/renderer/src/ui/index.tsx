import * as RadixDialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import type { SaveState } from '@/lib/data'

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

// ------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border-input text-fg hover:bg-surface-raised',
  ghost: 'text-muted hover:bg-surface-raised hover:text-fg',
  danger: 'border border-danger text-danger hover:bg-surface-raised'
}
const SIZE: Record<Size, string> = { sm: 'h-7 px-3', md: 'h-9 px-4', lg: 'h-11 px-5' }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-(--duration-fast) active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  pressed?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, pressed, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(
        'inline-grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-raised hover:text-fg aria-pressed:bg-surface-raised aria-pressed:text-fg',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

// ------------------------------------------------------------ Campos

const fieldBase =
  'w-full rounded-md border border-border-input bg-bg px-3 text-sm text-fg transition-colors focus:border-focus disabled:opacity-45 aria-invalid:border-danger'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string | null
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

function FieldShell({ label, hint, error, className, children }: FieldShellProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="type-label text-muted">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={!!error || undefined} className={cx(fieldBase, 'h-9')} {...rest} />
      )}
    </FieldShell>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
}

export function TextArea({ label, hint, className, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      {(id, describedBy) => (
        <textarea id={id} aria-describedby={describedBy} className={cx(fieldBase, 'min-h-24 resize-y py-2 leading-relaxed')} {...rest} />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
  empty?: string
}

export function SelectField({ label, options, empty, className, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} className={className}>
      {(id) => (
        <select id={id} className={cx(fieldBase, 'h-9')} {...rest}>
          {empty !== undefined && <option value="">{empty}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

// ------------------------------------------------------------ Chip, Card, Portrait, EmptyState

type ChipTone = 'neutral' | 'warning' | 'success' | 'danger' | 'hidden' | 'found' | 'understood'
const TONE: Record<ChipTone, string> = {
  neutral: 'text-muted bg-surface-raised',
  warning: 'text-warning bg-warning/15',
  success: 'text-success bg-success/15',
  danger: 'text-danger bg-danger/15',
  hidden: 'text-clue-hidden bg-clue-hidden/15',
  found: 'text-clue-found bg-clue-found/15',
  understood: 'text-clue-understood bg-clue-understood/15'
}

export function Chip({ tone = 'neutral', icon, children }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx('inline-flex h-5.5 items-center gap-1.5 rounded-pill px-2.5 text-xs font-semibold whitespace-nowrap', TONE[tone])}>
      {icon}
      {children}
    </span>
  )
}

export function Card({ className, children, selected }: { className?: string; children: ReactNode; selected?: boolean }) {
  return (
    <div className={cx('rounded-lg border bg-surface p-4', selected ? 'border-accent' : 'border-border', className)}>{children}</div>
  )
}

export function Portrait({ name, size = 40, src }: { name: string; size?: 24 | 40 | 64 | 96; src?: string | null }) {
  const initials =
    name
      .replace(/^(dr|dra|sr|sra)\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  const dims = size === 24 ? 'size-6 text-[10px]' : size === 64 ? 'size-16 text-lg' : size === 96 ? 'size-24 text-2xl' : 'size-10 text-xs'
  if (src)
    return <img src={src} alt="" aria-hidden draggable={false} className={cx('shrink-0 rounded-full border border-border bg-surface-raised object-cover', dims)} />
  return (
    <span aria-hidden className={cx('grid shrink-0 place-items-center rounded-full border border-border bg-surface-raised font-semibold text-muted', dims)}>
      {initials}
    </span>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="text-subtle [&>svg]:size-8">{icon}</span>
      <h2 className="type-lg mt-2">{title}</h2>
      <p className="mt-1.5 mb-4 max-w-sm text-muted">{text}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-danger bg-surface px-3 py-2 text-sm">
      <AlertTriangle className="size-4 text-danger" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

// ------------------------------------------------------------ SaveIndicator

export function SaveIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  if (state === 'idle') return null
  if (state === 'error')
    return (
      <span role="alert" title={error ?? undefined} className="inline-flex items-center gap-1.5 text-xs text-danger">
        <AlertTriangle className="size-3.5" aria-hidden /> Não salvou
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
      {state === 'saving' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
      {state === 'saving' ? 'Salvando…' : 'Salvo'}
    </span>
  )
}

// ------------------------------------------------------------ Dialog

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface-raised shadow-pop">
          <div className="flex items-start justify-between gap-4 px-5 pt-4">
            <div>
              <RadixDialog.Title className="type-lg">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-1 text-muted">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close asChild>
              <IconButton label="Fechar">
                <X className="size-4" />
              </IconButton>
            </RadixDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-5 pb-4">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export { cx }
