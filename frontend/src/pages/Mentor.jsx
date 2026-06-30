import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Send, Bot, User, Loader2 } from 'lucide-react';

const SUGGESTIONS = [
  'How should I prepare for coding interviews?',
  'What should I improve on my resume?',
  'Am I ready for placement season?',
  'How do I balance DSA and core subjects?',
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="mx-auto w-full max-w-3xl flex flex-col flex-1 px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-center gap-4">
          <Link
            to="/dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 transition hover:border-slate-600 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">AI Mentor</p>
            <h1 className="text-2xl font-semibold text-white">Career guidance</h1>
          </div>
        </div>

        <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/40 flex flex-col min-h-[60vh]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/10 text-violet-300 mb-4">
                  <Bot className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Ask me anything about placements</h2>
                <p className="text-sm text-slate-400 mb-6">I know your profile and goals to give personalized advice.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-500/50 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === 'user'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-950 border border-slate-800 text-slate-200'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="border-t border-slate-800 p-4 flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about interviews, resume, DSA, companies..."
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
