/**
 * Naming for projects created without the user typing a name.
 *
 * The project store rejects a duplicate name, so the start screen's "new
 * project" button — which deliberately asks nothing before opening a blank
 * canvas — has to pick one that is free.
 */

/**
 * `base`, or `base 2`, `base 3`… — the first that no existing project holds.
 * Comparison is case-insensitive and trims, to match the store's own
 * duplicate check; otherwise "untitled" would slip past and then be rejected.
 */
export function nextUntitledName(existing: { name: string }[], base = 'Untitled'): string {
  const taken = new Set(existing.map((project) => project.name.trim().toLowerCase()))
  if (!taken.has(base.trim().toLowerCase())) return base
  // No upper bound on purpose: the loop ends as soon as it finds a gap, and a
  // library large enough to matter would have exhausted storage long before.
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
