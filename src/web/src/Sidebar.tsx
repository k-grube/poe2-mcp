import { LoadPanel } from './LoadPanel.js'
import { SummaryPanel } from './SummaryPanel.js'
import { SearchPanel } from './SearchPanel.js'
import { BuildActions } from './BuildActions.js'
import { GemSearchPanel } from './GemSearchPanel.js'
import { GemDiff } from './GemDiff.js'
import type { BuildSummary } from './types.js'
import type { StreamState } from './useSearchStream.js'
import type { GemStreamState } from './useGemSearchStream.js'

const panel: React.CSSProperties = {
  width: 320,
  height: '100%',
  overflow: 'auto',
  background: '#0e1218',
  borderRight: '1px solid #2a3140',
  color: '#cdd3dd',
  font: '12px ui-monospace, monospace',
  padding: 12,
  boxSizing: 'border-box',
  flex: '0 0 auto',
}

export function Sidebar({
  summary,
  summaryError,
  stream,
  gem,
  onMutate,
}: {
  summary: BuildSummary | null
  summaryError: string | null
  stream: StreamState
  gem: GemStreamState
  onMutate: () => void
}) {
  return (
    <div style={panel}>
      <div style={{ color: '#d9b45b', fontWeight: 'bold', marginBottom: 10 }}>poe2 viz</div>
      <LoadPanel disabled={stream.status === 'running'} />
      <hr style={{ border: 'none', borderTop: '1px solid #2a3140', margin: '12px 0' }} />
      {summary ? (
        <>
          <SummaryPanel summary={summary} onMutate={onMutate} />
          <SearchPanel stream={stream} />
          <BuildActions stream={stream} />
          <GemSearchPanel gem={gem} />
          <GemDiff results={gem.results} onMutate={onMutate} />
          {summary.dps && (summary.dps as { full_dps?: number }).full_dps === 0 ? (
            <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
              FullDPS is 0 for this build (no groups flagged into FullDPS). Use the TotalDPS objective or include groups
              so gem search has signal.
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>{summaryError ?? 'no build loaded'}</div>
      )}
    </div>
  )
}
