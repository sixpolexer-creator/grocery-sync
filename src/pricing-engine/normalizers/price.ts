/** Round to 2 decimal places (avoids floating-point drift in DB) */
export function roundPrice(price: number): number {
  return Math.round(price * 100) / 100
}

/** Validate and clamp price to realistic Israeli market range */
export function sanitizePrice(price: number): number | null {
  if (!isFinite(price) || price < 0.01 || price > 10_000) return null
  return roundPrice(price)
}

/** Convert promo date strings to ISO — returns null for invalid dates */
export function sanitizeDate(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null
  // Reject clearly bogus dates (before 2020 or more than 2 years ahead)
  const year = d.getFullYear()
  if (year < 2020 || year > new Date().getFullYear() + 2) return null
  return d.toISOString()
}
