function normalizeUrl(raw) {
  if (!raw) return ''
  let url = String(raw).trim()
  url = url.replace(/&amp;/g, '&')
  url = url.replace(/[),.;]+$/g, '')
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  return url
}

export default function CalendarEventsPanel({ events }) {
  const onlineEvents = events.filter((event) => {
    const hasList = Array.isArray(event.online_meetings) && event.online_meetings.length > 0
    const hasSingle = Boolean(event.meeting_link)
    return hasList || hasSingle
  })

  return (
    <section className="calendar-panel">
      <div className="panel-title-row">
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Online Meetings</h2>
        <span className="badge">{onlineEvents.length}</span>
      </div>

      {onlineEvents.length === 0 ? (
        <p className="empty-state" style={{ textAlign: 'center', padding: '24px' }}>
          No online meeting links found yet. Click <strong>"Events"</strong> to scan your inbox.
        </p>
      ) : (
        <div className="calendar-event-list">
          {onlineEvents.map((event, index) => (
            <article key={`${event.source_email_id || 'event'}-${index}`} className="calendar-event-card">
              <h3>{event.title || 'Meeting'}</h3>
              <p><strong>Date:</strong> {event.date || 'TBD'} &bull; <strong>Time:</strong> {event.time || 'TBD'}</p>
              <p><strong>Provider:</strong> {event.meeting_provider || 'Unknown'}</p>
              {event.online_meetings?.length ? (
                <ul className="meeting-link-list">
                  {event.online_meetings.map((meeting, idx) => (
                    <li key={`${meeting.link}-${idx}`} className="meeting-link-item">
                      <p className="meeting-link-provider"><strong>{meeting.provider}</strong></p>
                      <a className="meeting-link-url" href={normalizeUrl(meeting.link)} target="_blank" rel="noreferrer">
                        {normalizeUrl(meeting.link)}
                      </a>
                      <br />
                      <a className="meeting-link-open" href={normalizeUrl(meeting.link)} target="_blank" rel="noreferrer">
                        Join Meeting →
                      </a>
                    </li>
                  ))}
                </ul>
              ) : event.meeting_link ? (
                <div className="meeting-link-item single">
                  <a className="meeting-link-url" href={normalizeUrl(event.meeting_link)} target="_blank" rel="noreferrer">
                    {normalizeUrl(event.meeting_link)}
                  </a>
                  <br />
                  <a className="meeting-link-open" href={normalizeUrl(event.meeting_link)} target="_blank" rel="noreferrer">
                    Join Meeting →
                  </a>
                </div>
              ) : (
                <p className="empty-state">No online link found in this email.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
