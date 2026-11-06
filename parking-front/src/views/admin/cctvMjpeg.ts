function findBytes(haystack: Uint8Array, needle: Uint8Array) {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer
    }
    return index
  }
  return -1
}

function appendBytes(left: Uint8Array, right: Uint8Array) {
  const combined = new Uint8Array(left.length + right.length)
  combined.set(left)
  combined.set(right, left.length)
  return combined
}

export async function consumeMjpegPreview(
  response: Response,
  signal: AbortSignal,
  onFrame: (frame: Blob) => void,
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The live preview did not provide a readable stream.')
  const headerSeparator = new TextEncoder().encode('\r\n\r\n')
  let buffer = new Uint8Array()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (signal.aborted) return
      if (done) return
      buffer = appendBytes(buffer, value)
      while (true) {
        const headerEnd = findBytes(buffer, headerSeparator)
        if (headerEnd < 0) break
        const headers = new TextDecoder().decode(buffer.subarray(0, headerEnd))
        const length = Number(headers.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i)?.[1])
        if (!Number.isSafeInteger(length) || length <= 0 || length > 1_000_000) {
          throw new Error('The live preview returned an invalid frame size.')
        }
        const frameStart = headerEnd + headerSeparator.length
        const frameEnd = frameStart + length
        if (buffer.length < frameEnd + 2) break
        onFrame(new Blob([buffer.slice(frameStart, frameEnd)], { type: 'image/jpeg' }))
        buffer = buffer.slice(frameEnd + 2)
      }
      if (buffer.length > 1_000_000) {
        throw new Error('The live preview returned an oversized frame.')
      }
    }
  } finally {
    reader.releaseLock()
  }
}
