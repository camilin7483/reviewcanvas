import { describe, expect, it, vi } from 'vitest'
import { googlePlaceId, isReviewsSectionLink, reviewLink, reviewsSectionLink } from '../src/googleReviews'
import { resolveReviewSection } from '../server/reviewDestination'

const feature = '0x808f778c55555555:0xa4f25c571acded3f'
const maps = `https://www.google.com/maps/place/San+Francisco+International+Airport/data=!4m2!3m1!1s${feature.replace(':', '%3A')}`
const direct = `https://www.google.com/maps/place//data=!4m4!3m3!1s${feature}!9m1!1b1`
const short = 'https://maps.app.goo.gl/ReviewDemo'
const place = 'ChIJN1t_tDeuEmsRUsoyG83frY4'

describe('enlaces que abren la sección de reseñas', () => {
  it('convierte una ficha identificada al enlace de Google Maps para leer reseñas', () => {
    expect(reviewsSectionLink(maps)).toBe(direct)
    expect(isReviewsSectionLink(direct)).toBe(true)
    expect(isReviewsSectionLink(maps)).toBe(false)
    expect(reviewLink(direct)).toBe(direct)
    expect(reviewLink(maps)).toBe('')
  })

  it('reconoce los destinos de lectura y escritura publicados por Google', () => {
    const write = `https://www.google.com/maps/place//data=!4m3!3m2!1s${feature}!12e1`
    expect(isReviewsSectionLink(write)).toBe(false)
    expect(reviewLink(write)).toBe(write)
    expect(reviewsSectionLink(write)).toBe(direct)
    expect(googlePlaceId(`https://search.google.com/local/writereview?placeid=${place}`)).toBe(place)
    expect(reviewsSectionLink('https://www.google.com.example.com/maps/place/' + feature)).toBe('')
    expect(reviewsSectionLink('https://maps.google.com/?cid=11885663895765773631')).toBe('')
  })

  it('expande un enlace corto de Maps y deja el QR en el destino de reseñas', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: maps } }))
    await expect(resolveReviewSection(short + '?g_st=aw', undefined, fetcher)).resolves.toEqual({ status: 'resolved', url: direct })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(short, { redirect: 'manual', signal: expect.any(AbortSignal) })
  })

  it('consulta el campo de lectura de Place Details cuando hay Place ID y una clave', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ googleMapsLinks: { reviewsUri: direct } }))
    await expect(resolveReviewSection(place, undefined, fetcher)).resolves.toEqual({ status: 'needs-key' })
    expect(fetcher).not.toHaveBeenCalled()
    await expect(resolveReviewSection(place, 'test-only', fetcher)).resolves.toEqual({ status: 'resolved', url: direct })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://places.googleapis.com/v1/places/${place}`, expect.objectContaining({
      headers: { 'X-Goog-Api-Key': 'test-only', 'X-Goog-FieldMask': 'googleMapsLinks.reviewsUri' },
      redirect: 'error',
    }))
  })

  it('solo sigue redirecciones cortas de Google y rechaza respuestas con una ficha general', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.org/maps/place/' + feature } }))
      .mockResolvedValueOnce(Response.json({ googleMapsLinks: { reviewsUri: maps } }))
    await expect(resolveReviewSection(short, undefined, fetcher)).resolves.toEqual({ status: 'missing' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(resolveReviewSection(place, 'test-only', fetcher)).resolves.toEqual({ status: 'missing' })
  })
})
