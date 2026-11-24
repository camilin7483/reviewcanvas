import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { brandSchema, colors, fonts, reviewLink, type Brand } from '../model'
import { useLibrary } from '../storage'
import { elements } from '../library/vectors'
import { readRaster } from '../editor/assets'
import { ColorField, Dialog, FileField, IconButton } from './ui'

const blankBrand = (): Brand => ({
  id: crypto.randomUUID(), name: '', slogan: '', primary: colors.forest, secondary: colors.terracotta,
  font: fonts[0], url: '', notes: '', images: [], decorations: [],
})
export function BrandForm({ initial, save, close }: { initial?: Brand; save: (brand: Brand) => Promise<void>; close: () => void }) {
  const [brand, setBrand] = useState(initial ?? blankBrand)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { decorationFavorites } = useLibrary()
  const patch = (value: Partial<Brand>) => setBrand((before) => ({ ...before, ...value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const url = brand.url ? reviewLink(brand.url) : ''
    if (brand.url && !url) { setError('Introduce un enlace de Google Maps o un Place ID válido.'); return }
    const checked = brandSchema.safeParse({ ...brand, name: brand.name.trim(), url })
    if (!checked.success) { setError('Comprueba el nombre y los archivos de la marca.'); return }
    setBusy(true)
    try { await save(checked.data); close() } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  function image(file: File, logo: boolean) {
    void readRaster(file).then(({ value }) => setBrand((current) => logo
      ? { ...current, logo: value } : { ...current, images: [...current.images, value].slice(0, 6) }))
      .catch((failure: Error) => setError(failure.message))
  }
  return <Dialog title={initial ? 'Editar marca' : 'Añadir una marca'} onClose={close}>
    <form className="dialog-body field-stack" onSubmit={(event) => void submit(event)}>
      <label>Nombre del negocio<input required maxLength={100} value={brand.name} onChange={(event) => patch({ name: event.target.value })} /></label>
      <label>Eslogan<input maxLength={150} value={brand.slogan} onChange={(event) => patch({ slogan: event.target.value })} /></label>
      <div className="field-columns"><ColorField label="Color principal" value={brand.primary} change={(primary) => patch({ primary })} />
        <ColorField label="Color secundario" value={brand.secondary} change={(secondary) => patch({ secondary })} /></div>
      <label>Tipografía<select value={brand.font} onChange={(event) => patch({ font: event.target.value })}>
        {fonts.map((font) => <option key={font}>{font}</option>)}
      </select></label>
      <label>Enlace de reseñas<input maxLength={1200} value={brand.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://g.page/r/…/review" /></label>
      <label>Información comercial<textarea maxLength={500} value={brand.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
      <div className="brand-images">
        {brand.logo && <div><img src={brand.logo} alt="Logotipo" /><IconButton label="Quitar logotipo" onClick={() => patch({ logo: undefined })}><Trash2 size={14} /></IconButton></div>}
        <FileField label="Cargar logotipo" accept="image/png,image/jpeg,image/webp" change={(file) => image(file, true)} />
      </div>
      <div className="brand-images">
        {brand.images.map((photo, index) => <div key={index}><img src={photo} alt={`Imagen de marca ${index + 1}`} />
          <IconButton label={`Quitar imagen ${index + 1}`} onClick={() => patch({ images: brand.images.filter((_, i) => i !== index) })}><Trash2 size={14} /></IconButton></div>)}
        {brand.images.length < 6 && <FileField label="Añadir imagen favorita" accept="image/png,image/jpeg,image/webp" change={(file) => image(file, false)} />}
      </div>
      {decorationFavorites.length > 0 && <details><summary>Decoraciones favoritas</summary>
        {elements.filter((item) => decorationFavorites.includes(item.id)).map((item) => <label key={item.id} className="checkbox">
          <input type="checkbox" checked={brand.decorations.includes(item.id)} onChange={(event) => patch({
            decorations: event.target.checked ? [...brand.decorations, item.id] : brand.decorations.filter((id) => id !== item.id),
          })} />{item.name}</label>)}
      </details>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="button button-primary" disabled={busy} type="submit">Guardar marca</button></div>
    </form>
  </Dialog>
}
