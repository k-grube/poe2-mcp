// the over-the-wire contract shared by the server (events + sse) and the browser
// viz. pure types -> erased at build, so the web imports these directly with no
// second copy to keep in sync.

export type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

// weapon-set mode for a champion node (1 = set 1, 2 = set 2). only non-zero modes
// are sent; the viz defaults every other allocated node to gold (mode 0).
export interface NodeMode {
  id: number
  mode: number
}

export interface TrajectoryEntry {
  generation: number
  best_score: number
  avg_score: number
  champion_score: number
  elapsed_s: number
  champion_node_ids: number[]
  champion_node_modes: NodeMode[]
  champion_stats: Record<string, number>
  points_used: number
}

export interface SearchBest {
  score: number
  stats: Record<string, number>
  node_ids: number[]
  node_modes: NodeMode[]
  points_used: number
}

export interface StartEvent {
  job_id: string
  total_generations: number
  initial: { score: number; stats: Record<string, number> }
}

export interface GenEvent extends TrajectoryEntry {
  job_id: string
  status: 'running'
}

export interface EndEvent {
  job_id: string
  status: 'done' | 'cancelled' | 'error'
  best: SearchBest | null
  total_evals: number | null
  error: string | null
}

export interface Snapshot {
  status: Status
  job_id: string | null
  total_generations: number
  initial: { score: number; stats: Record<string, number> } | null
  trajectory: TrajectoryEntry[]
  champion_node_ids: number[]
  champion_node_modes: NodeMode[]
  error: string | null
  build: BuildInfo | null
}

export interface BuildInfo {
  class_name: string
  ascendancy: string
  level: number
  main_skill: string
  // weapon-set points per pool, max = campaign cap (24) + conversions (Weapon Master)
  weapon_sets?: { set1: number; set2: number; max: number } | null
  // present when load_build auto-repaired N broken Companion gems (poe.ninja exports).
  // wires skillId/skillMinion onto the gem and adds the beast to build.beastList.
  fixed_companions?: number
}

export interface Gem {
  // gem id from PoB's data.gems map, e.g. "Metadata/Items/Gems/SkillGemFeedingFrenzySupport".
  // null for unresolved gems (poe.ninja exports of Companion gems before auto-fix runs)
  id: string | null
  name: string
  support: boolean
  enabled: boolean
  level: number | null
  quality: number | null
}

export interface SocketGroup {
  index: number
  label: string | null
  enabled: boolean
  include_in_full_dps: boolean
  is_main: boolean
  slot: string | null
  source: string | null
  main_skill_name: string | null
  gem_count: number
  gems: Gem[]
}

export interface MinionSkillsInfo {
  group: number
  gem: string
  beast: string | null
  current_skill_index: number
  skills: Array<{ index: number; name: string }>
}

export interface BuildSummary {
  info: BuildInfo
  dps: Record<string, unknown>
  ehp: Record<string, unknown>
  breakpoints: Record<string, unknown>
  tree: { points_used: number; keystones: string[]; notables: string[] }
  socket_groups: { groups: SocketGroup[]; main_socket_group: number }
  // alloc_mode: 0 normal, 1 weapon set 1, 2 weapon set 2
  allocated_nodes: Array<{ id: number; alloc_mode: number }>
  minion_skills: MinionSkillsInfo[]
}

// gem-search result: per in-scope skill, the recommended supports + score delta
export interface GemSupportChange {
  id: string
  name: string
  kept: boolean // already socketed before the search (unchanged)
}

export interface GemSupportRef {
  id: string
  name: string
}

export interface GemSkillResult {
  group: number
  main_skill: string
  supports: GemSupportChange[] // final layout, kept=true means unchanged
  removed: GemSupportRef[] // supports dropped from the original layout
  score: number
  score_before: number
}

export interface GemSearchResult {
  results: GemSkillResult[]
}

export interface GemStartEvent {
  job_id: string
  total_groups: number
  groups: number[]
}

// one per step: the in-flight skill's running best + already-finished skills
export interface GemProgressEvent {
  job_id: string
  status: 'running'
  group: number
  main_skill: string
  phase: 'greedy' | 'polish'
  step: number
  total_steps: number
  best_score: number
  score_before: number
  current_supports: GemSupportRef[]
  done_results: GemSkillResult[]
  group_ordinal: number
  total_groups: number
}

export interface GemEndEvent {
  job_id: string
  status: 'done' | 'cancelled' | 'error'
  results: GemSkillResult[]
  error: string | null
}

export interface GemSnapshot {
  status: Status
  job_id: string | null
  groups: number[]
  progress: GemProgressEvent | null
  results: GemSkillResult[]
  error: string | null
}
