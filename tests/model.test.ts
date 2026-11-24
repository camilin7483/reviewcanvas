import { describe, expect, it } from 'vitest'
import { dimensions, formats, layerBase, newProject, reviewLink, validateProject } from '../src/model'
import { templates, themes } from '../src/library/templates'
import { elements } from '../src/library/vectors'
import { safeSvg } from '../server/validation'

describe('formatos y enlaces', () => {
  it('calcula el A4 a 300 DPI y convierte unidades físicas', () => {
    expect(dimensions(formats[2], 300)).toEqual({ width: 2480, height: 3508 })
    expect(dimensions({ name: 'Tarjeta', width: 3, height: 2, unit: 'in' }, 300)).toEqual({ width: 900, height: 600 })
  })
  it('admite destinos de Google y traduce el Place ID', () => {
    expect(reviewLink('ChIJ1234567890123456')).toBe('https://search.google.com/local/writereview?placeid=ChIJ1234567890123456')
    expect(reviewLink('https://g.page/r/AbCd-123/review')).toBe('https://g.page/r/AbCd-123/review')
    const id = 'ChIJN1t_tDeuEmsRUsoyG83frY4'
    const direct = `https://search.google.com/local/writereview?placeid=${id}`
    expect(reviewLink(`https://www.google.com.co/maps/search/?api=1&query=Cafe+Aurora&query_place_id=${id}`)).toBe(direct)
    expect(reviewLink(`https://www.google.com/maps/place/Cafe+Aurora/data=!19s${id}`)).toBe(direct)
    expect(reviewLink('https://maps.app.goo.gl/AbCd1234')).toBe('')
    expect(reviewLink('https://www.google.com.co/maps/place/Cafe+Aurora')).toBe('')
    const legacy = { ...newProject(), url: 'https://maps.app.goo.gl/AbCd1234' }
    expect(validateProject(legacy)).toBeNull()
    expect(validateProject(legacy, true)?.url).toBe('')
  })
  it('descarta orígenes que no corresponden a Google y datos de proyecto fuera de rango', () => {
    expect(reviewLink('https://g.page.example.org/r/ABC/review')).toBe('')
    expect(reviewLink('https://foo@g.page/r/ABC/review')).toBe('')
    expect(validateProject({ ...newProject(), url: 'https://example.org/' })).toBeNull()
    expect(validateProject({ ...newProject(), format: { name: 'A4', width: 1000, height: 1000, unit: 'in' } })).toBeNull()
  })
  it('conserva una capa válida al importar JSON', () => {
    const project = newProject([{ ...layerBase('Fondo', 50, 50, 100, 100), kind: 'rect', fill: '#ffffff' }])
    expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
  })
})

describe('biblioteca', () => {
  it('contiene 100 diseños nuevos en diez categorías, seis premium y diez originales del kit', () => {
    expect(templates).toHaveLength(110)
    expect(templates.slice(0, 6).every((item) => item.premium)).toBe(true)
    expect(new Set(templates.map((item) => item.id)).size).toBe(110)
    for (const theme of themes) expect(templates.filter((item) => item.category === theme.title && !item.id.startsWith('kit-'))).toHaveLength(10)
    expect(new Set(templates.map((item) => item.format.name)).size).toBeGreaterThan(3)
  })
  it('provee 380 vectores procedurales sanitizables y 30 recursos del kit', () => {
    expect(elements).toHaveLength(410)
    expect(new Set(elements.map((item) => item.id)).size).toBe(elements.length)
    expect(elements.filter((item) => item.svg && safeSvg(item.svg))).toHaveLength(380)
  })
})
