import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  MAX_REPORTER_NAME_LENGTH,
  MIN_MESSAGE_LENGTH,
} from './config/WidgetConfig'
import type { SubCategory, TopLevelCategory } from './domain/Feedback'
import { SUB_CATEGORIES_BY_CATEGORY } from './domain/Feedback'
import { buildFeedbackPayload } from './use-cases/BuildFeedbackPayload'

/**
 * Pins the widget ↔ feedback-pipeline-worker payload contract (#118).
 * The schema in /contract is the shared artefact: a drift between it and
 * the widget's own tables or bounds fails here, and the Worker runs the
 * same fixtures against its validator.
 */
const contractDir = fileURLToPath(
  new URL('../../../contract/', import.meta.url),
)

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

interface Branch {
  properties: {
    category: { const: string }
    subCategory: { enum?: string[]; type?: string }
  }
}

interface ContractSchema {
  required: string[]
  oneOf: Branch[]
  properties: {
    category: { enum: string[] }
    message: { minLength: number; maxLength: number }
    reporterName: { maxLength: number }
  }
}

const schema = readJson(
  `${contractDir}feedback-payload.v1.schema.json`,
) as ContractSchema
const validate = new Ajv2020({ allErrors: true }).compile(schema)

function fixtures(kind: 'valid' | 'invalid'): [string, unknown][] {
  const dir = `${contractDir}fixtures/${kind}/`
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file, readJson(dir + file)])
}

describe('payload contract v1', () => {
  it('lists the categories in the widget order', () => {
    expect(schema.properties.category.enum).toEqual(
      Object.keys(SUB_CATEGORIES_BY_CATEGORY),
    )
  })

  it('pins every family to its exact sub-categories', () => {
    const fromSchema = Object.fromEntries(
      schema.oneOf.map((branch) => [
        branch.properties.category.const,
        branch.properties.subCategory.enum ?? [],
      ]),
    )
    expect(fromSchema).toEqual(SUB_CATEGORIES_BY_CATEGORY)
  })

  it('gives a family without sub-categories a null sub-category', () => {
    const praise = schema.oneOf.find(
      (branch) => branch.properties.category.const === 'praise',
    )
    expect(praise?.properties.subCategory).toEqual({ type: 'null' })
  })

  it('matches the message and reporter-name bounds', () => {
    expect(schema.properties.message).toMatchObject({
      minLength: MIN_MESSAGE_LENGTH,
      maxLength: MAX_MESSAGE_LENGTH,
    })
    expect(schema.properties.reporterName.maxLength).toBe(
      MAX_REPORTER_NAME_LENGTH,
    )
  })

  it('requires exactly the fields the widget builds', () => {
    const payload = buildPayload('praise', null)

    expect([...schema.required].sort()).toEqual(Object.keys(payload).sort())
  })

  it.each(
    Object.entries(SUB_CATEGORIES_BY_CATEGORY).flatMap(([category, subs]) =>
      subs.length === 0
        ? [[category, null]]
        : subs.map((sub) => [category, sub]),
    ) as [TopLevelCategory, string | null][],
  )('accepts the built payload %s/%s', (category, subCategory) => {
    const payload = buildPayload(category, subCategory)

    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true)
  })

  it('reads both fixture folders', () => {
    expect(fixtures('valid').length).toBeGreaterThan(0)
    expect(fixtures('invalid').length).toBeGreaterThan(0)
  })

  it.each(fixtures('valid'))('accepts %s', (_name, payload) => {
    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true)
  })

  it.each(fixtures('invalid'))('rejects %s', (_name, payload) => {
    expect(validate(payload)).toBe(false)
  })
})

function buildPayload(
  category: TopLevelCategory,
  subCategory: string | null,
): unknown {
  return buildFeedbackPayload({
    projectId: 'demo',
    url: 'https://example.com/',
    referrer: null,
    userAgent: 'UA',
    viewport: { w: 1280, h: 800 },
    locale: 'fr',
    timestamp: '2026-11-02T10:00:00.000Z',
    widgetVersion: '0.7.0',
    scrollDepth: 0.5,
    sessionId: 's-1',
    category,
    subCategory: subCategory as SubCategory | null,
    message: 'A message long enough.',
    reporterName: null,
    target: null,
  })
}
