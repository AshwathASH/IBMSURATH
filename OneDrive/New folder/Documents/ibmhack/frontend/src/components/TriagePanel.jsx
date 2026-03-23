import { useState } from 'react'

function normalizeUrl(raw) {
  if (!raw) return ''
  const trimmed = String(raw).trim().replace(/[),.;]+$/g, '')
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

function renderTextWithLinks(text) {
  if (!text) return null

  const urlRegex = /((?:https?:\/\/)?(?:meet\.google\.com|(?:[\w-]+\.)?zoom\.us|(?:[\w-]+\.)?teams\.microsoft\.com|(?:[\w-]+\.)?webex\.com)\/[^\s)>,"']+)/gi
  const urlPartRegex = /^(?:https?:\/\/)?(?:meet\.google\.com|(?:[\w-]+\.)?zoom\.us|(?:[\w-]+\.)?teams\.microsoft\.com|(?:[\w-]+\.)?webex\.com)\/[^\s)>,"']+$/i
  const parts = text.split(urlRegex)

  return parts.map((part, idx) => {
    if (!part) return null
    if (urlPartRegex.test(part)) {
      const href = normalizeUrl(part)
      return (
        <a key={`link-${idx}`} href={href} target="_blank" rel="noreferrer" className="inline-link">
          {href}
        </a>
      )
    }
    return <span key={`text-${idx}`}>{part}</span>
  })
}

function extractEmailAddress(fromEmail) {
  if (!fromEmail) return ''

  const bracketMatch = String(fromEmail).match(/<([^>]+)>/)
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim()
  }

  const directEmailMatch = String(fromEmail).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return directEmailMatch?.[0] || String(fromEmail).trim()
}

function ActionCard({ action, emailId, onApprove, loading }) {
  if (action.type === 'draft_reply') {
    return (
      <article className="action-card">
        <h4>
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ fill: '#0078d4' }}><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
          Drafted Reply
        </h4>
        <p><strong>Subject:</strong> {action.subject}</p>
        <p>{action.body}</p>
        <button onClick={() => onApprove(emailId, action.type, action)} disabled={loading}>
          ✓ Approve & Send
        </button>
      </article>
    )
  }

  if (action.type === 'calendar_event') {
    return (
      <article className="action-card">
        <h4>
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ fill: '#0078d4' }}><path d="M17 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2V2h2v1h6V2h2v1zM5 9v10h14V9H5zm2 2h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/></svg>
          Calendar Event
        </h4>
        <p><strong>Title:</strong> {action.title}</p>
        <p><strong>Date:</strong> {action.date} &bull; <strong>Time:</strong> {action.time}</p>
        <p><strong>Attendees:</strong> {action.attendees?.join(', ') || 'None'}</p>
        <button onClick={() => onApprove(emailId, action.type, action)} disabled={loading}>
          ✓ Approve & Create
        </button>
      </article>
    )
  }

  return (
    <article className="action-card">
      <h4>
        <svg viewBox="0 0 24 24" width="16" height="16" style={{ fill: '#0078d4' }}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        Task List
      </h4>
      <ul>
        {(action.tasks || []).map((task, idx) => <li key={`${task}-${idx}`}>{task}</li>)}
      </ul>
      <button onClick={() => onApprove(emailId, action.type, action)} disabled={loading}>
        ✓ Approve & Execute
      </button>
    </article>
  )
}

export default function TriagePanel({ selectedEmail, triageData, onRunTriage, onApproveAction, onAskAssistant, assistantData, loading, approvalMessage, getAvatarColor, Icons }) {
  if (!selectedEmail) {
    return (
      <section className="reading-pane">
        <div className="reading-pane-empty">
          <svg viewBox="0 0 24 24" width="64" height="64" style={{ fill: '#a19f9d', opacity: 0.4 }}>
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
          </svg>
          <p>Select a message to read</p>
        </div>
      </section>
    )
  }

  const initials = selectedEmail.from_email.split('@')[0].split('.').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'U'
  const avatarColor = getAvatarColor(selectedEmail.from_email)
  const senderName = selectedEmail.from_email.split('@')[0].replace(/[._]/g, ' ')
  const dateLabel = new Date().toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
  const quickReplies = ['Okay', 'Good morning', "You're welcome", 'Thank you']
  const [assistantPrompt, setAssistantPrompt] = useState('')

  const assistantQuickActions = [
    { label: 'Summarise this email', prompt: 'Summarise this email in concise bullet points.' },
    { label: 'List the next steps', prompt: 'List the next steps with clear action items.' },
    { label: 'Suggest a reply', prompt: 'Suggest a professional reply to this email.' },
  ]

  const openQuickReply = (message) => {
    const toAddress = extractEmailAddress(selectedEmail.from_email)
    if (!toAddress) return

    const subject = encodeURIComponent(`Re: ${selectedEmail.subject || ''}`)
    const body = encodeURIComponent(message)
    const to = encodeURIComponent(toAddress)
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <section className="reading-pane">
      {/* Reading Pane Header */}
      <div className="rp-header">
        <h1 className="rp-subject">{selectedEmail.subject}</h1>
        <div className="rp-sender-row">
          <div className="rp-sender-avatar" style={{ background: avatarColor }}>{initials}</div>
          <div className="rp-sender-info">
            <div className="rp-sender-name">{senderName}</div>
            <div className="rp-sender-email">&lt;{selectedEmail.from_email}&gt;</div>
          </div>
          <span className="rp-date">{dateLabel}</span>
        </div>
        <div className="rp-to-line">
          <span>To:</span> <strong>me</strong>
        </div>
      </div>

      {/* Action bar */}
      <div className="rp-action-bar">
        <button className="rp-action-btn primary" onClick={() => onRunTriage(selectedEmail.id)} disabled={loading}>
          <Icons.Sparkle />
          <span>{loading ? 'Analyzing...' : 'AI Triage'}</span>
        </button>
        <button className="rp-action-btn" title="Reply">
          <Icons.Reply />
          <span>Reply</span>
        </button>
        <button className="rp-action-btn" title="Reply All">
          <Icons.ReplyAll />
          <span>Reply All</span>
        </button>
        <button className="rp-action-btn" title="Forward">
          <Icons.Forward />
          <span>Forward</span>
        </button>
        <button className="rp-action-btn" title="More Actions">
          <Icons.MoreHoriz />
        </button>
      </div>

      <div className="quick-reply-bar">
        <span className="quick-reply-title">Instant reply:</span>
        {quickReplies.map((message) => (
          <button
            key={message}
            className="quick-reply-btn"
            onClick={() => openQuickReply(message)}
            title={`Reply with: ${message}`}
          >
            {message}
          </button>
        ))}
      </div>

      <div className="assist-panel">
        <div className="assist-title-row">
          <span className="assist-title">How can I help you today?</span>
        </div>
        <div className="assist-actions">
          {assistantQuickActions.map((item) => (
            <button
              key={item.label}
              className="assist-action-btn"
              onClick={() => onAskAssistant?.(selectedEmail.id, item.prompt)}
              disabled={assistantData?.loading}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="assist-input-row">
          <input
            className="assist-input"
            placeholder="Enter a prompt here"
            value={assistantPrompt}
            onChange={(e) => setAssistantPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && assistantPrompt.trim()) {
                onAskAssistant?.(selectedEmail.id, assistantPrompt.trim())
                setAssistantPrompt('')
              }
            }}
          />
          <button
            className="assist-send-btn"
            onClick={() => {
              const prompt = assistantPrompt.trim()
              if (!prompt) return
              onAskAssistant?.(selectedEmail.id, prompt)
              setAssistantPrompt('')
            }}
            disabled={!assistantPrompt.trim() || assistantData?.loading}
          >
            Ask
          </button>
        </div>
        {assistantData?.error && <p className="assist-note">{assistantData.error}</p>}
        {assistantData?.answer && (
          <div className="assist-answer">
            <p className="assist-answer-title">Assistant response</p>
            <pre>{assistantData.answer}</pre>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="rp-body">
        <div className="rp-email-body">
          {renderTextWithLinks(selectedEmail.body)}
        </div>

        {/* AI Triage Section */}
        {triageData ? (
          <div className="triage-section">
            <div className="triage-header">
              <div className="triage-title">
                <Icons.Sparkle />
                AI Assistant
                <span className="triage-badge">AI</span>
              </div>
            </div>

            <div className="triage-meta">
              <p><strong>Priority:</strong> <span className={`priority ${triageData.priority.toLowerCase().replace(/\s+/g, '-')}`}>{triageData.priority}</span></p>
            </div>

            <div className="summary-box">
              <h4>Thread Summary</h4>
              <ul>
                {triageData.summary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            </div>

            <div className="actions-grid">
              {triageData.actions.map((action, index) => (
                <ActionCard
                  key={`${action.type}-${index}`}
                  action={action}
                  emailId={selectedEmail.id}
                  onApprove={onApproveAction}
                  loading={loading}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="triage-section">
            <p className="empty-state" style={{ textAlign: 'center', padding: '20px' }}>
              Click <strong>"AI Triage"</strong> above to analyze this email with AI
            </p>
          </div>
        )}

        {approvalMessage && <p className="approval-message">{approvalMessage}</p>}
      </div>
    </section>
  )
}
