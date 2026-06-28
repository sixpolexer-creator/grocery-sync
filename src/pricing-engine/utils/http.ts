const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RETRIES    = 3

export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, ...fetchOptions } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok && attempt < retries) {
        await sleep(500 * 2 ** attempt)
        continue
      }
      return res
    } catch (err) {
      lastError = err
      if (attempt < retries) await sleep(500 * 2 ** attempt)
    }
  }
  throw lastError
}

export async function downloadBuffer(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<Buffer> {
  const res = await fetchWithRetry(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function downloadText(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<string> {
  const res = await fetchWithRetry(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.text()
}

export async function downloadJson<T = unknown>(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const res = await fetchWithRetry(url, { ...options, headers: { Accept: 'application/json', ...options?.headers } })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json() as Promise<T>
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
