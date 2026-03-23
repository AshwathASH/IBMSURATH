import React, { useRef, useState } from "react";

const commands = [
  {
    keywords: ["open calendar", "show calendar"],
    action: (props) => {
      if (props.onOpenCalendar) props.onOpenCalendar();
    },
  },
  {
    keywords: ["summarize this email", "summarize email"],
    action: (props) => {
      if (props.onSummarize) props.onSummarize();
    },
  },
  {
    keywords: ["list the next steps", "next steps"],
    action: (props) => {
      if (props.onNextSteps) props.onNextSteps();
    },
  },
  {
    keywords: ["suggest a reply", "suggest reply"],
    action: (props) => {
      if (props.onSuggestReply) props.onSuggestReply();
    },
  },
];

export default function VoiceAssistant(props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      for (const cmd of commands) {
        if (cmd.keywords.some(k => transcript.includes(k))) {
          cmd.action(props);
          break;
        }
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div style={{ position: 'fixed', left: 24, bottom: 24, zIndex: 1000 }}>
      <button
        onClick={startListening}
        style={{
          background: listening ? '#1976d2' : '#fff',
          color: listening ? '#fff' : '#1976d2',
          border: '2px solid #1976d2',
          borderRadius: '50%',
          width: 56,
          height: 56,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          outline: 'none',
          fontSize: 28,
        }}
        aria-label="Voice Assistant"
      >
        <span role="img" aria-label="mic">🎤</span>
      </button>
      {listening && (
        <div style={{ marginTop: 8, color: '#1976d2', fontWeight: 'bold' }}>Listening...</div>
      )}
    </div>
  );
}
