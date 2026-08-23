/** Portable graph and minimal DeepSeek Harness owner contracts used by the graph card. */

import type { ReactNode } from 'react'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface GraphNode {
  uid: string
  labels: string[]
  name: string
  properties: Record<string, JsonValue>
}

export interface GraphRelationship {
  uid: string
  type: string
  start_uid: string
  end_uid: string
  properties: Record<string, JsonValue>
}

export interface GraphPresentationMeta {
  kind: 'global-lca-graph'
  version: 1
  nodes: GraphNode[]
  relationships: GraphRelationship[]
  records: Array<Record<string, JsonValue>>
  truncated: boolean
  cypher?: string
  parameters?: Record<string, JsonValue>
}

export interface TextContentBlock {
  type: 'text'
  text: string
}

export interface RunningToolCall {
  callId: string
  name: string
  argsRaw: string
  callView: unknown
}

export interface SettledToolCall {
  kind: 'tool-result'
  callId: string
  call: { name: string; argsRaw: string } | null
  content: ReadonlyArray<TextContentBlock | Record<string, unknown>>
  isError: boolean
  error?: { name: string; code: string }
  meta?: unknown
}

export type ToolCallBlock = RunningToolCall | SettledToolCall

export interface ToolCallViewProps {
  callId: string
  toolName: string
  block: ToolCallBlock
  inspect?: (() => void) | undefined
}

export interface ClientContext {
  effect(effect: () => void | (() => void), label?: string): void
  slots: {
    inject(name: string, factory: () => unknown): void
    register(
      options: { name: string; key: string },
      component: (props: ToolCallViewProps) => ReactNode,
    ): () => void
  }
}
