import { describe, expect, it } from 'vitest'
import { defineTool } from '../src/tool.js'

interface RunnableTool {
  parameters: Record<string, unknown>
  output: {
    presentationMeta?: (args: unknown, value: unknown) => unknown
  }
  execute(args: unknown, exec: { signal: AbortSignal }): Promise<unknown>
}

describe('out-of-tree tool adapter', () => {
  it('compiles required properties to raw JSON Schema', () => {
    const tool = defineTool({
      name: 'example',
      description: 'example',
      parameters: { uid: { type: 'string', required: true }, limit: { type: 'integer' } },
      output: { schema: { type: 'json' }, render: () => [] },
      async execute(args) { return args },
    }) as RunnableTool

    expect(tool.parameters).toEqual({
      type: 'object',
      properties: { uid: { type: 'string' }, limit: { type: 'integer' } },
      required: ['uid'],
    })
  })

  it('rejects malformed model arguments before execution', async () => {
    const tool = defineTool({
      name: 'example',
      description: 'example',
      parameters: { uid: { type: 'string', required: true } },
      output: { schema: { type: 'json' }, render: () => [] },
      async execute(args) { return args },
    }) as RunnableTool

    await expect(tool.execute({ uid: 42 }, { signal: new AbortController().signal })).rejects.toThrow(
      'arguments.uid must be a string',
    )
  })

  it('passes durable presentation metadata through the raw adapter', () => {
    const tool = defineTool({
      name: 'example',
      description: 'example',
      parameters: {},
      output: {
        schema: { type: 'json' },
        render: () => [],
        presentationMeta: (_args, value) => ({ kind: 'test', value }),
      },
      async execute(args) { return args },
    }) as RunnableTool

    expect(tool.output.presentationMeta?.({}, { answer: 42 })).toEqual({
      kind: 'test',
      value: { answer: 42 },
    })
  })
})
