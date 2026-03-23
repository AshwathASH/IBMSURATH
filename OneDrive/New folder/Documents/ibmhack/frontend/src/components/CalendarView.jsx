import { useState, useMemo } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function normalizeUrl(raw) {
  if (!raw) return ''
  let url = String(raw).trim().replace(/&amp;/g, '&').replace(/[),.;]+$/g, '')
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  return url
}

function parseHourFromEventTime(timeValue) {
  if (!timeValue || String(timeValue).toUpperCase() === 'TBD') return null

  const text = String(timeValue).trim()
  const twelveHour = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (twelveHour) {
    const rawHour = Number(twelveHour[1])
    const meridiem = twelveHour[3].toUpperCase()
    if (rawHour < 1 || rawHour > 12) return null
    let hour = rawHour % 12
    if (meridiem === 'PM') hour += 12
    return hour
  }

  const twentyFourHour = text.match(/^(\d{1,2})(?::(\d{2}))$/)
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1])
    if (hour < 0 || hour > 23) return null
    return hour
  }

  return null
}

function getPrimaryMeetingLink(event) {
  if (Array.isArray(event.online_meetings) && event.online_meetings.length > 0 && event.online_meetings[0].link) {
    return normalizeUrl(event.online_meetings[0].link)
  }
  if (event.meeting_link) {
    return normalizeUrl(event.meeting_link)
  }
  return ''
}

function ChevronLeft() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
}
function ChevronRight() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
}

export default function CalendarView({ events = [] }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        isOtherMonth: true,
      })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        month,
        year,
        isOtherMonth: false,
      })
    }

    // Next month leading days
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        isOtherMonth: true,
      })
    }

    return days
  }, [year, month])

  // Compute event indicators from events prop
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(ev => {
      if (ev.date) {
        const key = ev.date // e.g. "2026-03-25"
        if (!map[key]) map[key] = []
        map[key].push(ev)
      }
    })
    return map
  }, [events])

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }
  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  function isToday(d) {
    return d.day === today.getDate() && d.month === today.getMonth() && d.year === today.getFullYear()
  }
  function isSelected(d) {
    return d.day === selectedDate.getDate() && d.month === selectedDate.getMonth() && d.year === selectedDate.getFullYear()
  }

  function getDateKey(d) {
    const m = String(d.month + 1).padStart(2, '0')
    const dd = String(d.day).padStart(2, '0')
    return `${d.year}-${m}-${dd}`
  }

  // Events for selected date
  const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  const selectedEvents = eventsByDate[selectedDateKey] || []

  const { eventsByHour, unscheduledEvents } = useMemo(() => {
    const byHour = {}
    const unscheduled = []

    selectedEvents.forEach((event) => {
      const hour = parseHourFromEventTime(event.time)
      if (hour === null) {
        unscheduled.push(event)
        return
      }
      if (!byHour[hour]) byHour[hour] = []
      byHour[hour].push(event)
    })

    return { eventsByHour: byHour, unscheduledEvents: unscheduled }
  }, [selectedEvents])

  // Hours for day view
  const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM - 7 PM

  return (
    <div className="cal-view">
      {/* Calendar Sidebar (mini calendar + today) */}
      <div className="cal-sidebar">
        <div className="cal-mini">
          <div className="cal-mini-header">
            <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft /></button>
            <span className="cal-mini-title">{MONTHS[month]} {year}</span>
            <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight /></button>
          </div>
          <div className="cal-mini-grid">
            {DAYS.map(d => (
              <div key={d} className="cal-mini-day-label">{d[0]}</div>
            ))}
            {calendarDays.map((d, i) => {
              const dateKey = getDateKey(d)
              const hasEvents = eventsByDate[dateKey]?.length > 0
              return (
                <button
                  key={i}
                  className={`cal-mini-day ${d.isOtherMonth ? 'other' : ''} ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDate(new Date(d.year, d.month, d.day))
                    if (d.isOtherMonth) setViewDate(new Date(d.year, d.month, 1))
                  }}
                >
                  {d.day}
                  {hasEvents && <span className="cal-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        <button className="cal-today-btn" onClick={goToday}>
          Today
        </button>

        {/* Upcoming events list */}
        <div className="cal-upcoming">
          <div className="cal-upcoming-title">Upcoming Events</div>
          {events.length === 0 ? (
            <p className="cal-upcoming-empty">No events scheduled</p>
          ) : (
            <div className="cal-upcoming-list">
              {events.slice(0, 6).map((ev, i) => (
                <div key={i} className="cal-upcoming-item">
                  <div className="cal-upcoming-color" />
                  <div className="cal-upcoming-info">
                    <div className="cal-upcoming-name">{ev.title || 'Meeting'}</div>
                    <div className="cal-upcoming-time">
                      {ev.date || 'TBD'} · {ev.time || 'TBD'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Day View */}
      <div className="cal-main">
        <div className="cal-main-header">
          <h2 className="cal-main-date">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </h2>
          <div className="cal-main-nav">
            <button className="cal-nav-btn" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}>
              <ChevronLeft />
            </button>
            <button className="cal-nav-btn" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}>
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className="cal-day-grid">
          {/* All day events bar */}
          {unscheduledEvents.length > 0 && (
            <div className="cal-all-day">
              <span className="cal-all-day-label">Unscheduled</span>
              <div className="cal-all-day-events">
                {unscheduledEvents.map((ev, i) => {
                  const meetingLink = getPrimaryMeetingLink(ev)
                  return (
                  <div key={i} className="cal-all-day-event">
                    <span className="cal-event-title">{ev.title || 'Meeting'}</span>
                    {ev.time && <span className="cal-event-time">{ev.time}</span>}
                    {meetingLink && (
                      <a className="cal-event-link" href={meetingLink} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time slots */}
          <div className="cal-time-slots">
            {hours.map(hour => {
              const label = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`
              const isNow = today.getHours() === hour &&
                selectedDate.getDate() === today.getDate() &&
                selectedDate.getMonth() === today.getMonth()
              const hourEvents = eventsByHour[hour] || []
              return (
                <div key={hour} className={`cal-time-slot ${isNow ? 'now' : ''}`}>
                  <span className="cal-time-label">{label}</span>
                  <div className="cal-time-row">
                    {isNow && <div className="cal-now-line" />}
                    {hourEvents.length > 0 && (
                      <div className="cal-slot-events">
                        {hourEvents.map((event, idx) => {
                          const meetingLink = getPrimaryMeetingLink(event)
                          return (
                            <article key={`${event.source_email_id || event.title || 'meeting'}-${idx}`} className="cal-slot-event">
                              <div className="cal-slot-event-top">
                                <span className="cal-slot-event-title">{event.title || 'Meeting'}</span>
                                <span className="cal-slot-event-time">{event.time || 'TBD'}</span>
                              </div>
                              {meetingLink ? (
                                <a className="cal-slot-event-link" href={meetingLink} target="_blank" rel="noreferrer">
                                  Join meeting
                                </a>
                              ) : (
                                <span className="cal-slot-event-link muted">Link not available</span>
                              )}
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
