// one shared EventSource per tab. the server multiplexes every event type on /events,
// and chrome caps connections at 6 per origin across all open tabs, so both the search
// and gem streams attach their own listeners to this single connection.
let es: EventSource | null = null

export function sharedEvents(): EventSource {
  if (!es) {
    es = new EventSource('/events')
  }
  return es
}

// dev: drop the connection on hot-reload so edits don't orphan a live socket
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    es?.close()
    es = null
  })
}
