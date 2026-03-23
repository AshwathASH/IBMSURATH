export default function EmailList({ emails, selectedId, onSelect, getAvatarColor, aiPriorityMap, aiPriorityLoading }) {
  const HIGH_PRIORITY_HINTS = [
    'emergency', 'urgent', 'asap', 'immediately', 'critical', 'incident',
    'outage', 'sev1', 'p1', 'meeting', 'meet.google.com', 'zoom', 'teams', 'webex',
    'deadline today', 'join now',
  ]
  const MEDIUM_PRIORITY_HINTS = [
    'action required', 'required', 'follow up', 'reminder', 'schedule',
    'update', 'deadline', 'review', 'normal', 'please respond',
  ]

  const getInitials = (email) => {
    const parts = email.split('@')[0].split('.')
    return (parts.map(p => p[0]).join('').toUpperCase() || 'U').slice(0, 2)
  }

  const getPriority = (email) => {
    const aiPriority = String(aiPriorityMap?.[email.id] || '').trim().toLowerCase()
    const fromEmail = String(email.from_email || '').toLowerCase()

    if (fromEmail.includes('no-reply') || fromEmail.includes('noreply') || fromEmail.includes('do-not-reply')) {
      return { key: 'high', label: 'High' }
    }

    if (aiPriority.includes('urgent')) {
      return { key: 'high', label: 'High' }
    }

    if (aiPriority.includes('requires action') || aiPriority === 'action' || aiPriority === 'medium') {
      return { key: 'medium', label: 'Medium' }
    }

    if (aiPriority === 'fyi' || aiPriority === 'info' || aiPriority === 'informational' || aiPriority === 'low') {
      return { key: 'low', label: 'Low' }
    }

    // Deterministic fallback so severity is always shown even if AI result is delayed/unavailable.
    const text = `${email.subject || ''} ${email.body || ''}`.toLowerCase()
    if (HIGH_PRIORITY_HINTS.some((hint) => text.includes(hint))) {
      return { key: 'high', label: 'High' }
    }
    if (MEDIUM_PRIORITY_HINTS.some((hint) => text.includes(hint))) {
      return { key: 'medium', label: 'Medium' }
    }
    return { key: 'low', label: 'Low' }
  }

  return (
    <aside className="inbox-panel">
      {/* Focused / Other tabs */}
      <div className="inbox-tabs">
        <button className="inbox-tab active">Focused</button>
        <button className="inbox-tab">Other</button>
      </div>

      {/* Sort toolbar */}
      <div className="inbox-toolbar">
        <span>{emails.length} message{emails.length !== 1 ? 's' : ''}</span>
        <button className="inbox-sort">
          Date ▾
        </button>
      </div>

      {/* Email list */}
      <div className="email-list">
        {emails.length === 0 ? (
          <div className="empty-inbox">
            <svg viewBox="0 0 24 24" width="48" height="48" style={{ fill: '#a19f9d', opacity: 0.5, margin: '0 auto 12px', display: 'block' }}>
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
            </svg>
            <p style={{ color: '#a19f9d', fontSize: '13px' }}>No messages in this folder</p>
          </div>
        ) : (
          emails.map((email) => {
            const isActive = selectedId === email.id
            const initials = getInitials(email.from_email)
            const avatarColor = getAvatarColor(email.from_email)
            const dateObj = new Date()
            const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
            const senderName = email.from_email.split('@')[0].replace(/[._]/g, ' ')
            const priority = getPriority(email)

            return (
              <button
                key={email.id}
                className={`email-row priority-${priority.key} ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(email)}
              >
                <div className="unread-dot read" />
                <div className="email-avatar" style={{ background: avatarColor }}>{initials}</div>
                <div className="email-content">
                  <div className="email-header">
                    <p className="email-from">{senderName}</p>
                    <div className="email-meta">
                      <span className={`priority-chip ${priority.key}`}>{priority.label}</span>
                      <span className="email-date">{dateLabel}</span>
                    </div>
                  </div>
                  <p className="email-subject">{email.subject}</p>
                  <p className="email-preview">{email.body}</p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
