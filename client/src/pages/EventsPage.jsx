import { useState } from 'react';
import { Radio, Clock, Bus, Users, Filter } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { Card, EmptyState, Spinner, Button, Badge, Tabs } from '../components/ui.jsx';
import { cx, timeAgo, dayLabel, clockTime } from '../lib/utils.js';

const TYPE_TONE = {
  note: 'slate',
  delay: 'amber',
  breakdown: 'rose',
  boarded: 'green',
  return: 'blue',
  location_ping: 'sky',
};

export default function EventsPage() {
  const { data, loading, error, reload } = useApi('/api/live/events', { poll: 20000 });
  const [filter, setFilter] = useState('all');

  if (loading) return <Spinner label="Loading trip log" />;
  if (error)
    return <EmptyState icon={Radio} title="Cannot load trip log" message={error.message} action={<Button onClick={reload}>Retry</Button>} />;

  const events = data?.events || [];
  const filtered = filter === 'all' ? events : events.filter((e) => e.event_type === filter);
  const types = ['all', ...new Set(events.map((e) => e.event_type))];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Trip log</h1>
        <p className="text-[13px] text-ink-mute">
          Every update you or your buses have reported · {events.length} entries
        </p>
      </div>

      {types.length > 2 && (
        <Tabs
          value={filter}
          onChange={setFilter}
          className="max-w-2xl"
          tabs={types.map((t) => ({ value: t, label: t === 'all' ? 'All' : t, icon: t === 'all' ? Filter : undefined }))}
        />
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Radio} title="Nothing logged yet" message="Updates you add from the My Bus page will appear here." />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-3 p-4 transition hover:bg-slate-50/70">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-ink-soft">
                  {e.event_type === 'boarded' ? <Users className="h-4 w-4" /> : e.event_type === 'location_ping' ? <Bus className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TYPE_TONE[e.event_type] || 'slate'}>
                      {e.event_type.replace('_', ' ')}
                    </Badge>
                    {e.passengers > 0 && <span className="text-[12px] font-semibold text-ink-mute">{e.passengers} on board</span>}
                  </div>
                  <p className="mt-1.5 break-words text-[13.5px] font-medium text-ink">{e.note || '—'}</p>
                  <p className="mt-1 text-[11.5px] text-ink-mute">
                    {dayLabel(e.created_at)} · {clockTime(e.created_at)} · {timeAgo(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
