import { useState, type FormEvent } from 'react'
import { LogIn } from 'lucide-react'
import { api, type Account } from '../api'
import { Dialog } from './ui'

export function AccountDialog({ onAccount, close }: { onAccount: (account: Account) => void; close: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try { onAccount((await api.session(mode, email, password)).account); close() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <Dialog title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} onClose={close}>
    <form className="dialog-body field-stack" onSubmit={(event) => void submit(event)}>
      <p>La cuenta guarda una copia de tus proyectos para abrirlos en otros dispositivos.</p>
      <label>Correo electrónico<input type="email" autoComplete="email" autoFocus required value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Contraseña<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10}
        maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {mode === 'register' && <p className="helper">Usa al menos 10 caracteres.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
      </button><button className="button button-primary" type="submit" disabled={busy}><LogIn size={17} />
        {busy ? 'Conectando…' : mode === 'login' ? 'Entrar' : 'Registrar cuenta'}</button></div>
    </form>
  </Dialog>
}
