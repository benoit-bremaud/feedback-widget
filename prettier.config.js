// Prettier config — kept consistent with the existing code style in
// `packages/core/vitest.config.ts` and `packages/web/vitest.config.ts`
// (single quotes, no semicolons, trailing commas where valid).
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 80,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
  // Preserve author-chosen line breaks in Markdown so prose-wrap does not
  // split inline code spans across lines, which breaks bullet-list
  // continuation indentation (see PR #37 Copilot review).
  proseWrap: 'preserve',
}
