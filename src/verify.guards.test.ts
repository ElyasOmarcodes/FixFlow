import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The release gate a developer runs and the one CI runs have to be the same
 * list.
 *
 * A release build failed five minutes in on a Playwright check that had never
 * been run locally, because the local habit was "unit tests plus whichever
 * script felt related". `npm run verify` is that list now, and this keeps it
 * honest against the workflow.
 */
describe('verify gate', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
  const workflow = readFileSync('.github/workflows/apps.yml', 'utf8')

  it('runs every browser check CI runs', () => {
    const inCi = [...workflow.matchAll(/- run: npm run (test:[a-z]+)/g)].map((m) => m[1])
    expect(inCi.length).toBeGreaterThan(0)
    for (const script of inCi) {
      expect(pkg.scripts.verify, script).toContain(script)
    }
  })

  it('runs the static checks before the slow ones', () => {
    const verify = pkg.scripts.verify
    for (const early of ['typecheck', 'lint']) {
      expect(verify.indexOf(early)).toBeGreaterThanOrEqual(0)
      expect(verify.indexOf(early)).toBeLessThan(verify.indexOf('test:responsive'))
    }
  })

  it('names every check script it references', () => {
    for (const [, script] of pkg.scripts.verify.matchAll(/npm run ([a-z:]+)/g)) {
      expect(Object.keys(pkg.scripts), script).toContain(script)
    }
  })
})
