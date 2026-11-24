import { expandableGoogleLink, googlePlaceId, isReviewsSectionLink, reviewsSectionLink } from '../src/googleReviews'

export type ReviewResolution =
  | { status: 'resolved'; url: string }
  | { status: 'needs-key' | 'missing' | 'upstream' }

async function expandGoogleLink(input: string, signal: AbortSignal, fetcher: typeof fetch) {
  let next = input
  const visited = new Set<string>()
  for (let hops = 0; hops < 3; hops++) {
    const allowed = expandableGoogleLink(next)
    if (!allowed || visited.has(allowed)) break
    visited.add(allowed)
    const response = await fetcher(allowed, { redirect: 'manual', signal })
    const location = response.headers.get('location')
    if (response.body) await response.body.cancel()
    if (!location || response.status < 300 || response.status >= 400) break
    // Solo se solicita el siguiente salto cuando sigue siendo un enlace corto de Google.
    next = new URL(location, allowed).href
  }
  return next
}

export async function resolveReviewSection(input: string, placesKey?: string, fetcher = fetch): Promise<ReviewResolution> {
  const immediate = reviewsSectionLink(input)
  if (immediate) return { status: 'resolved', url: immediate }
  try {
    const signal = AbortSignal.timeout(6000)
    const resolved = await expandGoogleLink(input, signal, fetcher)
    const direct = reviewsSectionLink(resolved)
    if (direct) return { status: 'resolved', url: direct }
    const place = googlePlaceId(resolved) || googlePlaceId(input)
    if (!place) return { status: 'missing' }
    if (!placesKey) return { status: 'needs-key' }
    const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(place)}`, {
      headers: { 'X-Goog-Api-Key': placesKey, 'X-Goog-FieldMask': 'googleMapsLinks.reviewsUri' },
      redirect: 'error', signal,
    })
    if (response.status === 404) return { status: 'missing' }
    if (!response.ok) return { status: 'upstream' }
    const data = await response.json() as { googleMapsLinks?: { reviewsUri?: unknown } } | null
    const link = data?.googleMapsLinks?.reviewsUri
    if (typeof link === 'string' && isReviewsSectionLink(link)) return { status: 'resolved', url: reviewsSectionLink(link) }
    return { status: 'missing' }
  } catch { return { status: 'upstream' } }
}
