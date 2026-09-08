export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

export function readPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, root)
}

export function writePath(root: Record<string, unknown>, path: string, value: unknown) {
  const next = clone(root)
  const keys = path.split('.')
  let cursor = next
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete cursor[key]
      else cursor[key] = value
      return
    }
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  })
  return next
}
