import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
  }

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        className={clsx('input', error && 'border-red-500 focus:ring-red-500', className)}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// Toggle
interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-orange-500' : 'bg-gray-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  )
}

// Badge
interface BadgeProps {
  variant: 'green' | 'red' | 'gray' | 'orange'
  children: ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  const variants = {
    green: 'badge-green',
    red: 'badge-red',
    gray: 'badge-gray',
    orange: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/50 text-orange-400 border border-orange-800',
  }
  return <span className={clsx(variants[variant], className)}>{children}</span>
}

// Modal
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null
  const maxW = size === 'lg' ? 'max-w-2xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={clsx('relative bg-gray-900 border border-gray-800 rounded-xl p-6 w-full mx-4 shadow-2xl', maxW)}>
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// EmptyState
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-600 mb-4">{icon}</div>
      <h3 className="text-gray-300 font-medium mb-1">{title}</h3>
      {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}

// Spinner
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className || 'w-5 h-5 text-orange-500')} />
}
