import { LoadPanel } from './LoadPanel.js'
import { SummaryPanel } from './SummaryPanel.js'
import { SearchPanel } from './SearchPanel.js'
import { BuildActions } from './BuildActions.js'
import type { BuildSummary } from './types.js'
import type { StreamState } from './useSearchStream.js'

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
}: {
  summary: BuildSummary | null
  summaryError: string | null
  stream: StreamState
}) {
  return (
    <div style={panel}>
      <div style={{ color: '#d9b45b', fontWeight: 'bold', marginBottom: 10 }}>poe2 viz</div>
      <LoadPanel disabled={stream.status === 'running'} />
      <hr style={{ border: 'none', borderTop: '1px solid #2a3140', margin: '12px 0' }} />
      {summary ? (
        <>
          <SummaryPanel summary={summary} />
          <SearchPanel stream={stream} />
          <BuildActions stream={stream} />
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>{summaryError ?? 'no build loaded'}</div>
      )}
    </div>
  )
}
