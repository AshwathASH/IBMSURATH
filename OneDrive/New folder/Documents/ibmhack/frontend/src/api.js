const API_BASE = 'http://localhost:8000'

async function handleResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.detail || 'Request failed')
  }
  return response.json()
}

export async function fetchEmails(source = 'gmail') {
  const response = await fetch(`${API_BASE}/emails?source=${encodeURIComponent(source)}`)
  return handleResponse(response)
}

export async function gmailStatus() {
  const response = await fetch(`${API_BASE}/gmail/status`)
  return handleResponse(response)
}

export async function getGmailAuthUrl() {
  const response = await fetch(`${API_BASE}/gmail/auth-url`)
  return handleResponse(response)
}

export async function triageEmail(input) {
  const payload = typeof input === 'string'
    ? { email_id: input }
    : {
      from_email: input?.from_email,
      subject: input?.subject,
      body: input?.body,
      thread: Array.isArray(input?.thread) ? input.thread : [],
    }

  const response = await fetch(`${API_BASE}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function askEmailAssistant(input, prompt) {
  const payload = typeof input === 'string'
    ? { email_id: input, prompt }
    : {
      from_email: input?.from_email,
      subject: input?.subject,
      body: input?.body,
      thread: Array.isArray(input?.thread) ? input.thread : [],
      prompt,
    }

  const response = await fetch(`${API_BASE}/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function generateCalendarEvents(source = 'gmail') {
  const response = await fetch(`${API_BASE}/calendar-events/generate?source=${encodeURIComponent(source)}`, {
    method: 'POST',
  })
  return handleResponse(response)
}

export async function fetchCalendarEvents() {
  const response = await fetch(`${API_BASE}/calendar-events`)
  return handleResponse(response)
}

export async function approveAction(emailId, actionType, payload) {
  const response = await fetch(`${API_BASE}/approve-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_id: emailId, action_type: actionType, payload }),
  })
  return handleResponse(response)
}
