// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Smoke test for the public bundle (the `build:bundle` script). Bundles
// src/index.ts in-memory and asserts the self-contained output exports
// the public API and inlined the private core (no bare specifier left).
// Runs in node env (esbuild + fs), not happy-dom.
describe('public bundle', () => {
  it('bundles src/index.ts into a self-contained ESM module exposing the public API', async () => {
    const entry = fileURLToPath(new URL('./index.ts', import.meta.url))

    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      write: false,
      target: 'es2022',
      logLevel: 'silent',
    })

    const code = result.outputFiles[0]?.text ?? ''

    // Public API is exported from the bundle.
    expect(code).toContain('mountFeedbackWidget')
    expect(code).toContain('createBrowserContextCollector')

    // The private core was inlined — no leftover bare import of the
    // workspace package (a static site can't resolve that specifier).
    expect(code).not.toContain('@benoit-bremaud/feedback-widget-core')
  })
})
