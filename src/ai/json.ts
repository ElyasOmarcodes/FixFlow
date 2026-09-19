/**
 * Finding JSON in a model's reply.
 *
 * Models wrap JSON in prose or a fence even when told not to, so the object is
 * found rather than assumed to be the whole reply. Shared by every feature
 * that asks for a JSON answer — the slide generator and the agent loop.
 */

/** Every balanced `{…}` in a response, parsed. Unparseable candidates are skipped. */
export function jsonObjects(raw: string): unknown[] {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const found: unknown[] = []
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    const end = objectEnd(cleaned, start)
    if (end === -1) continue
    try { found.push(JSON.parse(cleaned.slice(start, end + 1))) } catch { /* keep scanning */ }
  }
  return found
}

/** Index of the `}` that closes the object opening at `start`, or -1. */
function objectEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}
