const mapsHost = /^(?:(?:www|maps)\.)?google\.(?:com(?:\.(?:co|mx|ar|pe|br|uy|ec))?|es|cl|fr|it|de|co\.uk)$/i
const placeIdentifier = /^[\w-]{10,255}$/
const typedPlaceId = /^(?:ChI|GhI|Ei)[\w-]{12,252}$/
const featureIdentifier = /!1s(0x[\da-f]{1,16}:0x[\da-f]{1,16})(?=[!/]|$)/gi
const reviewsMarker = '!9m1!1b1'
const writeMarker = '!12e1'
const reviewPath = (feature: string, mode: 'read' | 'write') => mode === 'read'
  ? `https://www.google.com/maps/place//data=!4m4!3m3!1s${feature}${reviewsMarker}`
  : `https://www.google.com/maps/place//data=!4m3!3m2!1s${feature}${writeMarker}`

function safeHttps(input: string) {
  try {
    const url = new URL(input.trim())
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null
  } catch { return null }
}

function mapsPath(url: URL) {
  return mapsHost.test(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname)
}

function writeShortLink(url: URL) {
  return url.hostname === 'g.page' && /^\/(?:r\/[\w-]+|[\w-]+)\/review\/?$/.test(url.pathname)
}

export function expandableGoogleLink(input: string) {
  const url = safeHttps(input)
  if (!url) return ''
  const supported = (url.hostname === 'maps.app.goo.gl' && /^\/[\w-]{5,80}\/?$/.test(url.pathname))
    || (url.hostname === 'goo.gl' && /^\/maps\/[\w-]{5,80}\/?$/.test(url.pathname))
    || writeShortLink(url)
  return supported ? `${url.origin}${url.pathname}` : ''
}

export function isGoogleMapsLink(input: string) {
  const url = safeHttps(input)
  return Boolean(url && (expandableGoogleLink(input) || mapsPath(url)
    || (url.hostname === 'maps.google.com' && url.pathname === '/' && url.searchParams.has('cid'))))
}

function mapFeature(input: string) {
  const url = safeHttps(input)
  if (!url || !mapsHost.test(url.hostname) || !/^\/maps\/place\//.test(url.pathname)) return null
  try {
    const data = decodeURIComponent(url.pathname.split('/data=')[1] ?? '').replace(/\/$/, '')
    const features = [...new Set(Array.from(data.matchAll(featureIdentifier), (entry) => entry[1].toLowerCase()))]
    if (features.length === 1) return { data, feature: features[0] }
  } catch { /* La dirección puede estar incompleta. */ }
  return null
}

export function isReviewsSectionLink(input: string) {
  return mapFeature(input)?.data.endsWith(reviewsMarker) ?? false
}

export function reviewsSectionLink(input: string) {
  const place = mapFeature(input)
  return place ? reviewPath(place.feature, 'read') : ''
}

export function googlePlaceId(input: string) {
  const value = input.trim()
  if (typedPlaceId.test(value)) return value
  const url = safeHttps(value)
  if (!url) return ''
  const google = mapsHost.test(url.hostname) || url.hostname === 'search.google.com'
  if (google && /^\/local\/writereview\/?$/.test(url.pathname)) {
    const id = url.searchParams.get('placeid')
    return id && placeIdentifier.test(id) ? id : ''
  }
  if (!mapsPath(url)) return ''
  const mapId = url.searchParams.get('query_place_id') ?? url.searchParams.get('placeid')
    ?? url.searchParams.get('q')?.match(/^place_id:([\w-]+)$/)?.[1]
  if (mapId && placeIdentifier.test(mapId)) return mapId
  try {
    const data = decodeURIComponent(url.pathname + url.search)
    const ids = [...new Set(Array.from(data.matchAll(/!(?:1s|19s)((?:ChI|GhI|Ei)[\w-]{12,252})(?=[!/?&#]|$)/g), (match) => match[1]))]
    return ids.length === 1 ? ids[0] : ''
  } catch { return '' }
}

export function writeReviewLink(input: string) {
  const url = safeHttps(input)
  if (url && writeShortLink(url)) return `https://g.page${url.pathname.replace(/\/$/, '')}`
  const place = mapFeature(input)
  if (place?.data.endsWith(writeMarker)) return reviewPath(place.feature, 'write')
  const id = googlePlaceId(input)
  return id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}` : ''
}

export function reviewLink(input: string) {
  return isReviewsSectionLink(input) ? reviewsSectionLink(input) : writeReviewLink(input)
}
