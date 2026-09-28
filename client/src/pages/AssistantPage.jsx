import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  User,
  Bot,
  Trash2,
  Wand2,
  MessageSquareText,
  FileText,
} from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import { Card, Button, Badge, Spinner } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, clockTime } from '../lib/utils.js';

const SUGGESTIONS = {
  student: [
    'Which bus should I take to reach the college before 9 AM?',
    'My bus often gets delayed near Benz Circle. Any suggestions?',
    'How do I change my pickup stop?',
    'Summarise the bus rules and timings for me.',
  ],
  driver: [
    'Summarise my trip so far today.',
    'What should I do if a student is waiting at a stop I already passed?',
    'Give me a checklist before starting the morning route.',
  ],
  admin: [
    'Give me a daily fleet operations report.',
    'Which routes have the most stops and may need splitting?',
    'How can I reduce student complaints about delays?',
  ],
};

const Bubble = ({ msg }) => {
  const mine = msg.role === 'user';
  return (
    <div className={cx('flex gap-2.5', mine && 'flex-row-reverse')}>
      <div
        className={cx(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full',
          mine ? 'bg-slate-200 text-ink-soft' : 'bg-gradient-to-br from-brand-600 to-violet-600 text-white'
        )}
      >
        {mine ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cx(
          'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-soft sm:max-w-[70%]',
          mine
            ? 'rounded-tr-md bg-brand-600 text-white'
            : 'rounded-tl-md border border-slate-200/80 bg-white text-ink-soft'
        )}
      >
        {msg.text}
        <p className={cx('mt-1.5 text-[10.5px]', mine ? 'text-white/60' : 'text-ink-mute')}>
          {clockTime(msg.at)}
        </p>
      </div>
    </div>
  );
};

export default function AssistantPage() {
  const { user, isAdmin, isDriver } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: `Hi ${user.full_name.split(' ')[0]}! I can summarise your notes, answer questions about routes and stops, or help you draft a message to the admin. What would you like to know?`,
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [report, setReport] = useState(null);
  const endRef = useRef(null);
  const status = useApi('/api/ai/status');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const prompt = (text ?? input).trim();
    if (!prompt || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: prompt, at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const res = await api.ai.generate(prompt);
      setMessages((m) => [...m, { role: 'bot', text: res.reply, at: new Date().toISOString() }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: `I could not answer that right now. ${e.message}`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const runReport = async () => {
    setReportBusy(true);
    try {
      const res = await api.ai.tripSummary({ save: true });
      setReport(res);
      toast.success('Fleet report generated and saved to your notes');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReportBusy(false);
    }
  };

  const suggestions = SUGGESTIONS[user.role] || SUGGESTIONS.student;
  const aiReady = status.data?.enabled !== false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">AI assistant</h1>
          <p className="text-[13px] text-ink-mute">Powered by Google Gemini · runs securely on the server</p>
        </div>
        <Badge tone={aiReady ? 'green' : 'amber'}>
          <Sparkles className="h-3 w-3" /> {aiReady ? 'AI online' : 'AI not configured'}
        </Badge>
      </div>

      {!isAdmin && (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Wand2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Need a written summary?</p>
            <p className="truncate text-[12.5px] text-ink-mute">Create a note and tap “Summarise with AI”.</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => (window.location.href = '/notes')}>
            <FileText className="h-3.5 w-3.5" /> My notes
          </Button>
        </Card>
      )}

      {isAdmin && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Daily fleet report</p>
              <p className="truncate text-[12.5px] text-ink-mute">
                Gemini reads live bus pings and trip events, then writes an operations digest.
              </p>
            </div>
            <Button size="sm" onClick={runReport} loading={reportBusy}>
              <Sparkles className="h-3.5 w-3.5" /> {reportBusy ? 'Generating…' : 'Generate report'}
            </Button>
          </div>
          {report && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-emerald-950/85">{report.summary}</p>
            </div>
          )}
        </Card>
      )}

      {/* chat */}
      <Card className="flex h-[calc(100vh-19rem)] min-h-[420px] flex-col overflow-hidden p-0 lg:h-[calc(100vh-15rem)]">
        <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4 sm:p-5">
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
          {busy && (
            <div className="flex gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3.5">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length < 4 && (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-3 no-scrollbar">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-slate-100 p-3 safe-bottom"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your bus, route, stops or timings…"
            className="field flex-1"
            maxLength={4000}
            disabled={busy}
          />
          {messages.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMessages((m) => m.slice(0, 1))}
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" loading={busy} disabled={!input.trim()}>
            <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </Card>

      <p className="px-1 text-center text-[12px] text-ink-mute">
        {isDriver ? 'Tip: ask “summarise my trip so far” for a shift digest.' : isAdmin ? 'Tip: generate a fleet report every evening.' : 'Tip: ask about the nearest stop to your college.'}
      </p>
    </div>
  );
}
