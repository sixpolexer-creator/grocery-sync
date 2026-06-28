export interface StoreWithCoords {
  id: string
  chainId: string
  chainSlug: string
  chainName: string
  storeCode: string
  name: string | null
  city: string | null
  lat: number | null
  lon: number | null
}

export interface StoreWithDistance extends StoreWithCoords {
  distanceKm: number
}

/** Haversine great-circle distance in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Attach distances to stores; stores without coords get distanceKm = Infinity */
export function attachDistances(
  stores: StoreWithCoords[],
  userLat: number,
  userLon: number
): StoreWithDistance[] {
  return stores.map(s => ({
    ...s,
    distanceKm:
      s.lat != null && s.lon != null
        ? haversineKm(userLat, userLon, s.lat, s.lon)
        : Infinity,
  }))
}

/** For each chain return the nearest store */
export function nearestStorePerChain(
  stores: StoreWithDistance[]
): Map<string, StoreWithDistance> {
  const map = new Map<string, StoreWithDistance>()
  for (const s of stores) {
    const existing = map.get(s.chainId)
    if (!existing || s.distanceKm < existing.distanceKm) map.set(s.chainId, s)
  }
  return map
}

/** Keep only stores within radiusKm (excludes stores with no coordinates) */
export function filterByRadius(
  stores: StoreWithDistance[],
  radiusKm: number
): StoreWithDistance[] {
  return stores.filter(s => s.distanceKm <= radiusKm)
}
