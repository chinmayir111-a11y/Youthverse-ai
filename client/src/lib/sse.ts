import { tokenStore } from './api'

/**
 * POST a JSON body and consume the Server-Sent Events response.
 *
 * `EventSource` can't be used here: it is GET-only and cannot send an
 * Authorization header, so the stream is read off `fetch` manually instead.
 */
export async function postSSE<T = unknown>(
  path: string,
  body: unknown,
  handlers: {
    onDelta?: (text: string) => void
    onDone?: (payload: T) => void
    onError?: (message: string) => void
    signal?: AbortSignal
  },
): Promise<void> {
  const token = tokenStore.get()

  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: handlers.signal,
  })

  // A failure before the stream opens is a normal JSON error response.
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      if (data?.message) message = data.message
    } catch {
      /* non-JSON body; keep the status-based message */
    }
    handlers.onError?.(message)
    return
  }

  if (!response.body) {
    handlers.onError?.('The server returned an empty response.')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (raw: string) => {
    // One SSE frame: "event: <name>\ndata: <json>"
    let event = 'message'
    const dataLines: string[] = []

    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length === 0) return

    let payload: unknown
    try {
      payload = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }

    if (event === 'delta') handlers.onDelta?.((payload as { text: string }).text)
    else if (event === 'done') handlers.onDone?.(payload as T)
    else if (event === 'error') handlers.onError?.((payload as { message: string }).message)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Frames are separated by a blank line.
    let split: number
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      dispatch(buffer.slice(0, split))
      buffer = buffer.slice(split + 2)
    }
  }

  if (buffer.trim()) dispatch(buffer)
}
