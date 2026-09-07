export type FieldType = 'text' | 'number' | 'switch' | 'select' | 'tags' | 'textarea'

export interface ConfigFieldSchema {
  path: string
  label: string
  description?: string
  type: FieldType
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
}

export interface ConfigSectionSchema {
  id: string
  title: string
  description?: string
  fields: ConfigFieldSchema[]
  defaultOpen?: boolean
}

export type ModuleKind = 'form' | 'proxies' | 'groups' | 'providers' | 'rules' | 'record' | 'raw-list'

export interface ConfigModuleSchema {
  id: string
  label: string
  description: string
  icon: string
  kind: ModuleKind
  rootKey?: string
  docsPath: string
  sections?: ConfigSectionSchema[]
}
