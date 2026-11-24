import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...props}>{children}</button>
}

export function BrandLogo({ light = false }: { light?: boolean }) {
  return <a href="/" className="wordmark" aria-label="ReviewCanvas, inicio">
    <img src={light ? '/01-marca/logo-horizontal-blanco.svg' : '/01-marca/logo-horizontal-principal.svg'} alt="ReviewCanvas" width="145" height="30" />
  </a>
}

export function Dialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const modal = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const current = modal.current
    current?.showModal()
    return () => current?.close()
  }, [])
  return <dialog className={`dialog ${className}`} ref={modal} onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <header className="dialog-header"><h2>{title}</h2><IconButton label="Cerrar" onClick={onClose}><X size={19} /></IconButton></header>
      {children}
    </div>
  </dialog>
}

export function NumberField({ label, value, change, min, max, step = 1 }: { label: string; value: number; change: (value: number) => void; min: number; max: number; step?: number }) {
  return <label className="number-field"><span>{label}</span><input aria-label={label} key={Math.round(value * 100) / 100}
    type="number" min={min} max={max} step={step} defaultValue={Math.round(value * 100) / 100}
    onBlur={(event) => {
      const parsed = event.target.valueAsNumber
      if (!Number.isFinite(parsed)) { event.target.value = String(Math.round(value * 100) / 100); return }
      const next = Math.max(min, Math.min(max, parsed))
      event.target.value = String(next)
      if (next !== value) change(next)
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

export function ColorField({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-input"><input type="color" value={value} aria-label={label} onChange={(event) => change(event.target.value)} /><span>{value.toUpperCase()}</span></span></label>
}

export function FileField({ label, accept, change }: { label: string; accept: string; change: (file: File) => void }) {
  return <label className="button button-outline file-field">{label}<input aria-label={label} type="file" accept={accept}
    onChange={(event) => {
      const file = event.target.files?.[0]
      if (file) change(file)
      event.target.value = ''
    }} /></label>
}
