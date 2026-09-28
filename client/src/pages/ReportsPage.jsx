import { useState } from 'react';
import { Sparkles, FileText, Trash2, Loader2, ClipboardList, Gauge, Radio, RefreshCw } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import api from '../lib/api.js';
import { Card, Button, Badge, EmptyState, Spinner, StatTile, ConfirmDialog } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { dayLabel, clockTime } from '../lib/utils.js';

const QUICK = [
  'Which buses have not shared a location in the last hour, and what should I do?',
  'Write a short message I can send to all drivers about the new timing policy.',
  'Suggest three ways to reduce waiting time at Benz Circle.',
  'Summarise student complaints from the last week and rank the issues.',
];

export default function ReportsPage() {
  const toast = useToast();
  const overview = useApi('/api/admin/overview', { poll: 60000 });
  const notes = useApi('/api/items', { poll: 0 });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { run, busy: delBusy } = useAction();

  const stats = overview.data?.stats || {};
  const reports = (notes.data?.items || []).filter((n) => n.title.startsWith('Fleet report'));

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.ai.tripSummary({ save: true });
      setReport(res.summary);
      notes.reload();
      toast.success('Report generated and saved to your notes');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ask = async (q) => {
    if (!q.trim()) return;
    setAskBusy(true);
    setAnswer('');
    try {
      const res = await api.ai.askAboutRoute(q);
      setAnswer(res.reply);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAskBusy(false);
    }
  };

  const remove = async () => {
    try {
      await run(() => api.items.remove(deleting.id));
      toast.success('Report deleted');
      setDeleting(null);
      notes.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">AI reports</h1>
          <p className="text-[13px] text-ink-mute">Gemini turns live fleet data into an operations digest</p>
        </div>
        <Button onClick={generate} loading={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Generating…' : 'Generate fleet report'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Gauge} label="Live buses" value={stats.live_buses || 0} tone="green" sub={`${stats.active_buses || 0} in service`} />
        <StatTile icon={ClipboardList} label="Total buses" value={stats.buses || 0} tone="blue" />
        <StatTile icon={Radio} label="Trip events" value={stats.trip_events || 0} tone="violet" sub="all time" />
        <StatTile icon={FileText} label="Saved reports" value={reports.length} tone="amber" />
      </div>

      <Card className="p-5">
        <h2 className="text-base font-bold text-ink">Ask about the fleet</h2>
        <p className="mt-0.5 text-[13px] text-ink-mute">Answers are grounded in the live bus and stop list.</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={askBusy}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {askBusy && <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-mute"><Loader2 className="h-4 w-4 animate-spin" /> Asking Gemini…</p>}
        {answer && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-950/85">{answer}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                navigator.clipboard?.writeText(answer);
                toast.success('Copied to clipboard');
              }}
            >
              Copy
            </Button>
          </div>
        )}
      </Card>

      {report && (
        <Card className="border-emerald-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Sparkles className="h-4 w-4 text-emerald-600" /> Latest fleet report
            </h2>
            <Badge tone="green">Generated now</Badge>
          </div>
          <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{report}</p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(report);
                toast.success('Copied to clipboard');
              }}
            >
              Copy report
            </Button>
            <Button size="sm" variant="ghost" onClick={generate} loading={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-ink">Saved reports</h2>
        </div>
        {overview.loading || notes.loading ? (
          <Spinner />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            message="Generate a fleet report above — every report is stored in your account."
            action={<Button onClick={generate}>Generate now</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((r) => (
              <li key={r.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{r.title}</p>
                  {r.description && <p className="text-[12.5px] text-ink-mute">{r.description}</p>}
                  {r.ai_summary && (
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-soft">
                      {r.ai_summary}
                    </p>
                  )}
                  <p className="mt-2 text-[11.5px] text-ink-mute">
                    {dayLabel(r.created_at)} · {clockTime(r.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setDeleting(r)}
                  className="rounded-lg p-2 text-ink-mute transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete report"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={delBusy}
        title="Delete this report?"
        message="This saved report will be permanently removed from your account."
      />
    </div>
  );
}
