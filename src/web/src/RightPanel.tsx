import type { ReactNode } from 'react'

export interface RightPanelSpec {
  title: string
  // function so the body is recomputed on open (e.g. fresh fetch for the same stat)
  body: () => ReactNode
}

const panel: React.CSSProperties = {
  width: 360,
  height: '100%',
  overflow: 'auto',
  background: '#0e1218',
  borderLeft: '1px solid #2a3140',
  color: '#cdd3dd',
  font: '12px ui-monospace, monospace',
  padding: 12,
  boxSizing: 'border-box',
  flex: '0 0 auto',
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
  color: '#d9b45b',
  fontWeight: 'bold',
}

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#8a93a6',
  cursor: 'pointer',
  font: 'inherit',
  padding: '0 4px',
}

export function RightPanel({ spec, onClose }: { spec: RightPanelSpec | null; onClose: () => void }) {
  if (!spec) {
    return null
  }
  return (
    <div style={panel}>
      <div style={header}>
        <span>{spec.title}</span>
        <button style={closeBtn} onClick={onClose} title="close">
          ×
        </button>
      </div>
      {spec.body()}
    </div>
  )
}
