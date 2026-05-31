import type { NodeType } from './types.js'

export function diffNodeIds(prev: Set<number>, cur: Set<number>): { added: Set<number>; removed: Set<number> } {
  const added = new Set<number>()
  const removed = new Set<number>()
  for (const id of cur) {
    if (!prev.has(id)) {
      added.add(id)
    }
  }
  for (const id of prev) {
    if (!cur.has(id)) {
      removed.add(id)
    }
  }
  return { added, removed }
}

export function nodeRadius(type: NodeType): number {
  switch (type) {
    case 'keystone':
      return 58
    case 'notable':
    case 'mastery':
      return 48
    case 'jewel_socket':
      return 44
    case 'class_start':
      return 42
    case 'ascend_start':
      return 36
    case 'ascendancy':
      return 32
    default:
      return 28
  }
}

export const GOLD = '#d9b45b'
export const DIM = '#3a4150'
export const JEWEL = '#5b8fd9'
export const START = '#5b8fd9'
export const SET1 = '#d95b5b' // weapon set 1 (red)
export const SET2 = '#5bd97a' // weapon set 2 (green)

// allocMode: 0 normal -> gold, 1 weapon set 1 -> red, 2 weapon set 2 -> green
export function nodeFill(type: NodeType, allocated: boolean, allocMode = 0): string {
  if (type === 'class_start' || type === 'ascend_start') {
    return START
  }
  if (!allocated) {
    return DIM
  }
  if (allocMode === 1) {
    return SET1
  }
  if (allocMode === 2) {
    return SET2
  }
  if (type === 'jewel_socket') {
    return JEWEL
  }
  return GOLD
}
