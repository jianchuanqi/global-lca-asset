declare module '@deepseek-ai/cordis' {
  export interface Context {
    tools: {
      register(tool: unknown): () => void
    }
    systemPrompt: {
      section(section: { name: string; order: number; text: string }): () => void
    }
  }
}
