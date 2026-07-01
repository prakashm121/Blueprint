import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Send, Bot, User, Loader2, Search } from 'lucide-react';

const SUGGESTIONS = [
  'How is my Google readiness?',
  'Explain DBMS B-Trees',
  'Help me with Amazon LP',
  'Suggest system design topics',
];

export default function Mentor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const res = await api.post('/api/v1/mentor/message', {
        message: trimmed,
        conversation_id: conversationId,
      });
      setConversationId(res.data.conversation_id);
      setMessages((prev) => [...prev, res.data.assistant_message]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not respond right now. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-deep text-on-surface font-sans flex flex-col">
      
      {/* Global Top Navigation Bar */}
      <div className="w-full border-b border-border-subtle/50 px-6 py-4 flex items-center gap-4 bg-background-deep/80 backdrop-blur sticky top-0 z-50">
        <Link
          to="/dashboard"
          className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-lg hover:bg-surface-container"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 flex flex-col h-full">
        <div className="flex-1 bg-surface-card border border-border-subtle rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          
          {/* Chat Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle/40 bg-surface-container-low/30">
            <div className="flex items-center gap-3">
              <Bot className="w-7 h-7 text-primary-fixed-dim" />
              <div>
                <h2 className="text-base font-bold text-on-surface tracking-tight">AI Career Coach</h2>
                <p className="text-[11px] text-success font-medium flex items-center gap-1.5 mt-0.5 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                  Active and Grounded in Google Rubrics
                </p>
              </div>
            </div>
            <span className="text-[10px] text-on-surface-variant border border-border-subtle bg-surface-container-high px-3 py-1 rounded-full font-bold tracking-wider">
              MODEL: GEMINI-3.5-FLASH
            </span>
          </div>

          {/* Message History Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-linear-to-b from-transparent to-surface-container-low/10">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60 mt-12">
                <Bot className="w-12 h-12 text-on-surface-variant mb-4" />
                <h3 className="text-lg font-semibold text-on-surface">How can I assist your prep today?</h3>
                <p className="text-sm text-on-surface-variant mt-2 max-w-sm leading-relaxed">
                  Ask for detailed system design breakdowns, algorithm hints, or resume optimizations tailored to your target role.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' ? (
                  <div className="w-full border-l-2 border-primary-container/30 pl-4 py-1">
                    <div className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap font-mono">
                      {msg.content}
                    </div>
                    <div className="text-[10px] text-on-surface-variant/40 text-right mt-4 font-mono uppercase">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary-container/20 border border-primary-container/30 px-5 py-3 text-sm leading-relaxed text-primary-fixed-dim">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="w-full border-l-2 border-primary-container/30 pl-4 py-1 flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary-fixed-dim" />
                <span className="text-sm text-on-surface-variant font-mono">Synthesizing response...</span>
              </div>
            )}
            <div ref={bottomRef} className="h-4" />
          </div>

          {/* Bottom Action Area (Suggestions & Input) */}
          <div className="p-5 border-t border-border-subtle/40 bg-surface-container-low/30">
            
            {/* Suggestion Chips */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2.5 mb-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-border-subtle bg-surface-container-low px-4 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-primary-fixed-dim/50 hover:text-on-surface hover:bg-surface-container cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Pill */}
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Ask anything (e.g. "Draft an evaluation strategy for Google...")'
                className="w-full bg-background-deep border border-border-subtle rounded-full py-3.5 pl-6 pr-14 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all focus:border-primary-fixed-dim/60 focus:bg-surface-container-low"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition hover:text-primary-fixed-dim hover:bg-surface-container disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-4 w-4 -ml-0.5" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}