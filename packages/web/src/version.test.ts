// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { WIDGET_VERSION } from './widget'

// Node env (not happy-dom) so import.meta.url is a file:// URL and the
// package.json read is reliable. Guards against WIDGET_VERSION drifting
// from the published package version on future bumps — the value is
// stamped into every emitted FeedbackPayload.
describe('WIDGET_VERSION', () => {
  it('matches packages/web/package.json version', () => {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version: string
    }
    expect(WIDGET_VERSION).toBe(pkg.version)
  })
})
