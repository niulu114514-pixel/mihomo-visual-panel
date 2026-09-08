import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { isMap, isScalar, isSeq, parseDocument, type Node } from 'yaml'

export type SourceLanguage = 'yaml' | 'json'

function segments(path: string): Array<string | number> {
  if (!path || path === '$') return []
  return path.replace(/^\$\.?/, '').split('.').filter(Boolean).map((part) => /^\d+$/.test(part) ? Number(part) : part)
}

function lineAt(source: string, offset: number) {
  let line = 1
  for (let index = 0; index < Math.min(offset, source.length); index++) if (source.charCodeAt(index) === 10) line++
  return line
}

export function sourceLineForPath(source: string, path: string, language: SourceLanguage): number {
  const pathSegments = segments(path)
  try {
    if (language === 'json') {
      const root = parseTree(source, [], { allowTrailingComma: true, disallowComments: false })
      if (!root) return 1
      let current = pathSegments
      let node = findNodeAtLocation(root, current)
      while (!node && current.length) {
        current = current.slice(0, -1)
        node = findNodeAtLocation(root, current)
      }
      return lineAt(source, node?.offset ?? 0)
    }
    const document = parseDocument(source, { keepSourceTokens: true })
    let node = document.contents as Node | null
    let offset = node?.range?.[0] ?? 0
    for (const [index, segment] of pathSegments.entries()) {
      if (isMap(node)) {
        const pair = node.items.find((item) => isScalar(item.key) && String(item.key.value) === String(segment))
        if (!pair) break
        if (index === pathSegments.length - 1 && isScalar(pair.key) && pair.key.range) offset = pair.key.range[0]
        node = pair.value as Node | null
        if (node?.range && index < pathSegments.length - 1) offset = node.range[0]
      } else if (isSeq(node) && typeof segment === 'number') {
        node = node.items[segment] as Node | null
        if (node?.range) offset = node.range[0]
      } else {
        break
      }
    }
    return lineAt(source, offset)
  } catch {
    return 1
  }
}
