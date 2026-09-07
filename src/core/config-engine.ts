export type ConfigDocument = Record<string, unknown>

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface ImportResult {
  config: ConfigDocument
  warnings: string[]
}

export interface ConfigEngine {
  readonly id: 'mihomo' | 'sing-box'
  readonly label: string
  createEmpty(): ConfigDocument
  parse(source: string): ImportResult
  stringify(config: ConfigDocument): string
  validate(config: ConfigDocument): ValidationIssue[]
}
