import { useEffect, useMemo, useState } from 'react'
import VoiceAssistant from './components/VoiceAssistant'
import { approveAction, askEmailAssistant, fetchCalendarEvents, fetchEmails, generateCalendarEvents, getGmailAuthUrl, gmailStatus, triageEmail } from './api'
import CalendarEventsPanel from './components/CalendarEventsPanel'
import CalendarView from './components/CalendarView'
import EmailList from './components/EmailList'
import TriagePanel from './components/TriagePanel'

/* ── SVG Icon Components (Fluent-style) ─────────────────────── */
const Icons = {
  Mail: () => (
    <svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.01L12 11l8-4.99V6H4zm0 2.83V18h16V8.83l-7.6 4.75a.75.75 0 0 1-.8 0L4 8.83z"/></svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24"><path d="M17 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2V2h2v1h6V2h2v1zM5 9v10h14V9H5zm2 2h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2z"/></svg>
  ),
  People: () => (
    <svg viewBox="0 0 24 24"><path d="M16.5 13c1.2 0 3.07.34 4.5 1v2h-6v-1.5c0-1-.68-1.94-1.81-2.62.53-.1 1.01-.13 1.31-.13.68 0 1.36.25 2 .25zM9 12c1.93 0 3.5-1.57 3.5-3.5S10.93 5 9 5 5.5 6.57 5.5 8.5 7.07 12 9 12zm0-5c.83 0 1.5.67 1.5 1.5S9.83 10 9 10s-1.5-.67-1.5-1.5S8.17 7 9 7zm0 6.75c-2.34 0-7 1.17-7 3.5V19h14v-1.75c0-2.33-4.66-3.5-7-3.5zm-4.94 3c.64-.71 3-1.75 4.94-1.75s4.3 1.04 4.94 1.75H4.06zm12.44-6.25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7zm7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.06 7.06 0 0 0-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.05.24.26.42.49.42h4c.24 0 .44-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.49.49 0 0 0-.12-.64l-2.11-1.65zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
  ),
  Inbox: () => (
    <svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z"/></svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
  ),
  Draft: () => (
    <svg viewBox="0 0 24 24"><path d="M21.04 12.13c.14 0 .27.06.38.17l1.28 1.28c.22.21.22.56 0 .77l-1 1-2.05-2.05 1-1c.11-.12.24-.17.39-.17zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM14.06 9.19l.75.75L5.92 18.84h-.75v-.75l8.89-8.9z"/></svg>
  ),
  Delete: () => (
    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4h-3.5z"/></svg>
  ),
  Junk: () => (
    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0 1 12 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0 1 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>
  ),
  Archive: () => (
    <svg viewBox="0 0 24 24"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>
  ),
  Folder: () => (
    <svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
  ),
  NewMail: () => (
    <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h9v-2H4V8l8 5 8-5v5h2V6c0-1.1-.9-2-2-2zm-8 7L4 6h16l-8 5zm7 4v3h-3v2h3v3h2v-3h3v-2h-3v-3h-2z"/></svg>
  ),
  Reply: () => (
    <svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
  ),
  ReplyAll: () => (
    <svg viewBox="0 0 24 24"><path d="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
  ),
  Forward: () => (
    <svg viewBox="0 0 24 24"><path d="M12 8V4l8 8-8 8v-4H4V8h8z"/></svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
  ),
  Sparkle: () => (
    <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
  ),
  Warning: () => (
    <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
  ),
  Person: () => (
    <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
  ),
  MoreHoriz: () => (
    <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
  ),
}

/* ── Avatar Color Generator ─────────────────────────────────── */
const AVATAR_COLORS = [
  '#0078d4', '#ca5010', '#8764b8', '#008272',
  '#e3008c', '#515c6b', '#4f6bed', '#c19c00',
  '#986f0b', '#498205', '#881798', '#b4009e',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function deriveFallbackPriority(email) {
  const fromEmail = String(email?.from_email || '').toLowerCase()
  const text = `${email?.subject || ''} ${email?.body || ''}`.toLowerCase()

  if (fromEmail.includes('no-reply') || fromEmail.includes('noreply') || fromEmail.includes('do-not-reply')) {
    return 'Urgent'
  }

  if (/emergency|urgent|asap|critical|meeting|meet\.google\.com|zoom|teams|webex/.test(text)) {
    return 'Urgent'
  }

  if (/action required|required|follow up|reminder|schedule|update|deadline|review/.test(text)) {
    return 'Requires Action'
  }

  return 'FYI'
}

function buildFallbackTriage(email) {
  const priority = deriveFallbackPriority(email)
  const subject = email?.subject || 'No subject'
  const from = email?.from_email || 'Unknown sender'

  return {
    summary: [
      `Sender: ${from}`,
      `Subject: ${subject}`,
      'Generated from local fallback triage due temporary AI/network issue.',
    ],
    priority,
    actions: [
      {
        type: 'draft_reply',
        subject: `Re: ${subject}`,
        body: 'Thanks for your email. I will review this and get back to you shortly.',
      },
      {
        type: 'calendar_event',
        title: subject,
        date: 'TBD',
        time: 'TBD',
        attendees: from ? [from] : [],
        notes: 'Created from fallback triage.',
      },
      {
        type: 'task_list',
        tasks: ['Review message details', 'Prioritize response', 'Follow up with sender'],
      },
    ],
  }
}

async function requestTriageWithRetry(emailLike) {
  try {
    return await triageEmail(emailLike)
  } catch (firstError) {
    if (typeof emailLike !== 'string' && emailLike?.id) {
      return triageEmail(emailLike.id)
    }
    throw firstError
  }
}

/* ── Main App ───────────────────────────────────────────────── */
export default function App() {
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [triageMap, setTriageMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [approvalMessage, setApprovalMessage] = useState('')
  const [gmailAccount, setGmailAccount] = useState('')
  const [calendarEvents, setCalendarEvents] = useState([])
  const [showCalendarPanel, setShowCalendarPanel] = useState(false)
  const [activeNav, setActiveNav] = useState('mail')
  const [activeFolder, setActiveFolder] = useState('inbox')
  const [aiPriorityMap, setAiPriorityMap] = useState({})
  const [aiPriorityLoading, setAiPriorityLoading] = useState(false)
  const [assistantMap, setAssistantMap] = useState({})

  const isOAuthReturn = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      connected: params.get('gmail_connected') === '1',
      error: params.get('gmail_error') === '1',
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      try {
        if (isOAuthReturn.error) {
          setError('Gmail connection failed. Verify OAuth setup and try again.')
        }

        const status = await gmailStatus()

        if (isOAuthReturn.connected || isOAuthReturn.error) {
          window.history.replaceState({}, '', window.location.pathname)
        }

        if (!active) return
        if (status.connected) {
          setGmailAccount(status.email || '')
          const [gmailEmails, storedEvents] = await Promise.all([
            fetchEmails('gmail'),
            fetchCalendarEvents().catch(() => []),
          ])
          if (!active) return
          setEmails(gmailEmails)
          setCalendarEvents(storedEvents)
          if (gmailEmails.length > 0) setSelectedEmail(gmailEmails[0])
          generateAiSeverityForEmails(gmailEmails)
          await syncCalendarFromGmailInbox()
          return
        }
        setEmails([])
        setSelectedEmail(null)
        setError(status.reason || 'Connect Gmail to load your inbox.')
      } catch (err) {
        if (!active) return
        setError(err.message)
      }
    }

    loadInitialData()
    return () => {
      active = false
    }
  }, [isOAuthReturn.connected, isOAuthReturn.error])

  async function syncCalendarFromGmailInbox() {
    try {
      await generateCalendarEvents('gmail')
      const storedEvents = await fetchCalendarEvents()
      setCalendarEvents(storedEvents)
    } catch {
      // Keep inbox usable even if calendar sync fails.
    }
  }

  async function generateAiSeverityForEmails(emailList) {
    if (!Array.isArray(emailList) || emailList.length === 0) {
      setAiPriorityMap({})
      return
    }

    setAiPriorityLoading(true)
    try {
      const emailIds = new Set(emailList.map((email) => email?.id).filter(Boolean))
      setAiPriorityMap((prev) => {
        const next = {}
        for (const id of emailIds) {
          if (prev[id]) {
            next[id] = prev[id]
          }
        }
        return next
      })

      for (const email of emailList) {
        if (!email?.id) {
          continue
        }

        try {
          const result = await requestTriageWithRetry(email)
          const triage = result?.triage
          if (triage?.priority) {
            setAiPriorityMap((prev) => ({ ...prev, [email.id]: triage.priority }))
            setTriageMap((prev) => ({ ...prev, [email.id]: triage }))
          } else {
            setAiPriorityMap((prev) => ({ ...prev, [email.id]: 'Unknown' }))
          }
        } catch {
          setAiPriorityMap((prev) => ({ ...prev, [email.id]: 'Unknown' }))
        }
      }
    } finally {
      setAiPriorityLoading(false)
    }
  }

  async function reloadEmails(source) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchEmails(source)
      setEmails(data)
      setSelectedEmail(data[0] || null)
      setApprovalMessage('')
      generateAiSeverityForEmails(data)
      if (source === 'gmail') {
        await syncCalendarFromGmailInbox()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function connectGmail() {
    setError('')
    try {
      const res = await getGmailAuthUrl()
      window.location.href = res.auth_url
    } catch (err) {
      setError(err.message)
    }
  }

  async function refreshGmailStatus() {
    setError('')
    try {
      const status = await gmailStatus()
      if (!status.connected) {
        setError(status.reason || 'Gmail not connected yet. Complete Google sign-in first.')
        return
      }
      setGmailAccount(status.email || '')
      await reloadEmails('gmail')
    } catch (err) {
      setError(err.message)
    }
  }

  async function createMeetingCalendarEvents() {
    setLoading(true)
    setError('')
    setApprovalMessage('')
    try {
      const result = await generateCalendarEvents('gmail')
      const storedEvents = await fetchCalendarEvents()
      setCalendarEvents(storedEvents)
      setShowCalendarPanel(true)
      setApprovalMessage(
        `Calendar events saved: ${result.created_events} new (${result.created_online_meeting_events} with online links), ${result.total_events} total.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openCalendarEvents() {
    setLoading(true)
    setError('')
    try {
      const storedEvents = await fetchCalendarEvents()
      setCalendarEvents(storedEvents)
      setShowCalendarPanel(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedTriage = useMemo(() => {
    if (!selectedEmail) return null
    return triageMap[selectedEmail.id] || null
  }, [selectedEmail, triageMap])

  const selectedAssistant = useMemo(() => {
    if (!selectedEmail) return null
    return assistantMap[selectedEmail.id] || null
  }, [selectedEmail, assistantMap])

  async function runTriage(emailId) {
    setLoading(true)
    setError('')
    setApprovalMessage('')
    const emailForTriage = emails.find((email) => email.id === emailId)
    try {
      const result = await requestTriageWithRetry(emailForTriage || emailId)
      setTriageMap((prev) => ({ ...prev, [emailId]: result.triage }))
      if (result?.triage?.priority) {
        setAiPriorityMap((prev) => ({ ...prev, [emailId]: result.triage.priority }))
      }
    } catch (err) {
      if (emailForTriage) {
        const fallbackTriage = buildFallbackTriage(emailForTriage)
        setTriageMap((prev) => ({ ...prev, [emailId]: fallbackTriage }))
        setAiPriorityMap((prev) => ({ ...prev, [emailId]: fallbackTriage.priority }))
        setApprovalMessage('')
        setError('')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(emailId, actionType, payload) {
    setLoading(true)
    setError('')
    setApprovalMessage('')
    try {
      const res = await approveAction(emailId, actionType, payload)
      setApprovalMessage(`Action executed: ${res.action_type}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssistantAsk(emailId, prompt) {
    const email = emails.find((item) => item.id === emailId)
    if (!email || !prompt?.trim()) {
      return
    }

    setAssistantMap((prev) => ({
      ...prev,
      [emailId]: {
        ...(prev[emailId] || {}),
        loading: true,
        error: '',
      },
    }))

    try {
      const result = await askEmailAssistant(email, prompt)
      setAssistantMap((prev) => ({
        ...prev,
        [emailId]: {
          loading: false,
          error: '',
          prompt,
          answer: result?.answer || 'No response generated.',
        },
      }))
    } catch {
      const fallback = buildFallbackTriage(email)
      let fallbackAnswer = ''
      const normalizedPrompt = prompt.toLowerCase()
      if (normalizedPrompt.includes('summary') || normalizedPrompt.includes('summar')) {
        fallbackAnswer = fallback.summary.join('\n')
      } else if (normalizedPrompt.includes('next step') || normalizedPrompt.includes('task')) {
        fallbackAnswer = (fallback.actions.find((action) => action.type === 'task_list')?.tasks || []).map((task) => `- ${task}`).join('\n')
      } else if (normalizedPrompt.includes('reply')) {
        fallbackAnswer = fallback.actions.find((action) => action.type === 'draft_reply')?.body || 'Thanks for your email. I will get back to you shortly.'
      } else {
        fallbackAnswer = fallback.summary.join('\n')
      }

      setAssistantMap((prev) => ({
        ...prev,
        [emailId]: {
          loading: false,
          error: 'AI unavailable, showing fallback answer.',
          prompt,
          answer: fallbackAnswer,
        },
      }))
    }
  }

  const accountInitials = 'MA';

  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Icons.Inbox, count: emails.length },
    { id: 'sent', label: 'Sent Items', icon: Icons.Send, count: 0 },
    { id: 'drafts', label: 'Drafts', icon: Icons.Draft, count: 0 },
    { id: 'junk', label: 'Junk Email', icon: Icons.Junk, count: 0 },
    { id: 'deleted', label: 'Deleted Items', icon: Icons.Delete, count: 0 },
    { id: 'archive', label: 'Archive', icon: Icons.Archive, count: 0 },
  ]

  // Voice Assistant handlers
  const handleVoiceOpenCalendar = () => {
    setActiveNav('calendar');
  };
  const handleVoiceSummarize = () => {
    if (selectedEmail) handleAssistantAsk(selectedEmail.id, 'Summarize this email');
  };
  const handleVoiceNextSteps = () => {
    if (selectedEmail) handleAssistantAsk(selectedEmail.id, 'List the next steps');
  };
  const handleVoiceSuggestReply = () => {
    if (selectedEmail) handleAssistantAsk(selectedEmail.id, 'Suggest a reply');
  };

  return (
    <div className="outlook-app">
      {/* ── Navigation Rail ─────────────────────────────────── */}
      <nav className="nav-rail">
        <div className="nav-rail-top">
          <button
            className={`rail-btn ${activeNav === 'mail' ? 'active' : ''}`}
            onClick={() => setActiveNav('mail')}
            title="Mail"
          >
            <Icons.Mail />
          </button>
          <button
            className={`rail-btn ${activeNav === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveNav('calendar')}
            title="Calendar"
          >
            <Icons.Calendar />
          </button>
          <button
            className={`rail-btn ${activeNav === 'people' ? 'active' : ''}`}
            onClick={() => setActiveNav('people')}
            title="People"
          >
            <Icons.People />
          </button>
        </div>
        <div className="nav-rail-bottom">
          <button className="rail-btn" title="Settings">
            <Icons.Settings />
          </button>
          <div className="rail-avatar" title={'MailAct Ai'}>
            {accountInitials}
          </div>
        </div>
      </nav>

      {/* ── Folder Pane ─────────────────────────────────────── */}
      <aside className="folder-pane">
        <div className="folder-pane-header">
          <span className="folder-pane-title">
            MailAct Ai
          </span>
        </div>
        <div className="folder-section">
          <div className="folder-section-title">Favorites</div>
          {folders.slice(0, 3).map((folder) => {
            const FolderIcon = folder.icon
            return (
              <button
                key={folder.id}
                className={`folder-item ${activeFolder === folder.id ? 'active' : ''}`}
                onClick={() => setActiveFolder(folder.id)}
              >
                <FolderIcon />
                <span className="folder-item-label">{folder.label}</span>
                {folder.count > 0 && <span className="folder-item-count">{folder.count}</span>}
              </button>
            )
          })}
        </div>
        <div className="folder-section">
          <div className="folder-section-title">Folders</div>
          {folders.slice(3).map((folder) => {
            const FolderIcon = folder.icon
            return (
              <button
                key={folder.id}
                className={`folder-item ${activeFolder === folder.id ? 'active' : ''}`}
                onClick={() => setActiveFolder(folder.id)}
              >
                <FolderIcon />
                <span className="folder-item-label">{folder.label}</span>
                {folder.count > 0 && <span className="folder-item-count">{folder.count}</span>}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="main-content">
        {activeNav === 'calendar' ? (
          /* ── Calendar View ──────────────────────────────────── */
          <CalendarView events={calendarEvents} />
        ) : (
          /* ── Mail View ──────────────────────────────────────── */
          <>
            {/* Command Bar / Ribbon */}
            <div className="command-bar">
              <button className="cmd-btn-primary" onClick={connectGmail} title="Connect Gmail">
                <Icons.NewMail />
                <span>Connect</span>
              </button>

              <div className="cmd-divider" />

              <button className="cmd-btn" onClick={refreshGmailStatus} title="Refresh Inbox">
                <Icons.Reply />
                <span>Refresh</span>
              </button>

              <div className="cmd-divider" />

              <button className="cmd-btn" title="Delete">
                <Icons.Delete />
                <span>Delete</span>
              </button>
              <button className="cmd-btn" title="Archive">
                <Icons.Archive />
                <span>Archive</span>
              </button>

              <div className="cmd-spacer" />

              <span className="account-chip">
                <Icons.Person />
                {gmailAccount || 'Not connected'}
              </span>
            </div>

            {error && (
              <div className="error-banner">
                <Icons.Warning />
                {error}
              </div>
            )}

            {/* Workspace: Email List + Reading Pane */}
            <div className="workspace-grid">
              <EmailList
                emails={emails}
                selectedId={selectedEmail?.id}
                onSelect={(email) => {
                  setSelectedEmail(email)
                  setApprovalMessage('')
                }}
                getAvatarColor={getAvatarColor}
                aiPriorityMap={aiPriorityMap}
                aiPriorityLoading={aiPriorityLoading}
              />
              <TriagePanel
                selectedEmail={selectedEmail}
                triageData={selectedTriage}
                onRunTriage={runTriage}
                onApproveAction={handleApprove}
                onAskAssistant={handleAssistantAsk}
                assistantData={selectedAssistant}
                loading={loading}
                approvalMessage={approvalMessage}
                getAvatarColor={getAvatarColor}
                Icons={Icons}
              />
            </div>
          </>
        )}

        {/* Calendar Modal */}
        {showCalendarPanel && (
          <div className="calendar-modal-backdrop" onClick={() => setShowCalendarPanel(false)}>
            <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
              <div className="calendar-modal-header">
                <h2>
                  <Icons.Calendar />
                  Calendar Events
                </h2>
                <button type="button" onClick={() => setShowCalendarPanel(false)}>Close</button>
              </div>
              <CalendarEventsPanel events={calendarEvents} />
            </div>
          </div>
        )}
      </div>
      {/* Voice Assistant Floating Button */}
      <VoiceAssistant
        onOpenCalendar={handleVoiceOpenCalendar}
        onSummarize={handleVoiceSummarize}
        onNextSteps={handleVoiceNextSteps}
        onSuggestReply={handleVoiceSuggestReply}
      />
    </div>
  )
}
