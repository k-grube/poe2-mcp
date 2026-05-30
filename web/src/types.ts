export type NodeType =
  | 'keystone'
  | 'notable'
  | 'mastery'
  | 'jewel_socket'
  | 'class_start'
  | 'ascend_start'
  | 'ascendancy'
  | 'normal'

export interface TreeNode {
  id: number
  type: NodeType
  x: number
  y: number
  name: string
  ascendancy?: string
  stats?: string[]
}

export interface TreeLayout {
  nodes: TreeNode[]
  edges: [number, number][]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

// search wire types come from the server (single source of truth, erased at build)
export type {
  Status,
  TrajectoryEntry,
  SearchBest,
  StartEvent,
  GenEvent,
  EndEvent,
  Snapshot,
  BuildInfo,
  BuildSummary,
  Gem,
  SocketGroup,
} from '../../src/wire-types.js'
