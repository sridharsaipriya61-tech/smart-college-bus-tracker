import { useState } from 'react';
import { NotebookPen, Plus, Sparkles, Pencil, Trash2, X, Save, Loader2, Radio } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import api from '../lib/api.js';
import { Card, Button, Badge, EmptyState, Spinner, Modal, Field, Input, Textarea, ConfirmDialog } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, dayLabel, clockTime } from '../lib/utils.js';

const blank = { title: '', description: '', ai_summary: '' };

export default function NotesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/api/items');
  const [editing, setEditing] = useState(null); // note object or 'new'
  const [form, setForm] = useState(blank);
  const [deleting, setDeleting] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const { run, busy } = useAction();

  const items = data?.items || [];

  const openNew = () => {
    setForm(blank);
    setEditing('new');
  };
  const openEdit = (item) => {
    setForm({ title: item.title, description: item.description || '', ai_summary: item.ai_summary || '' });
    setEditing(item);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error('Give your note a title');
    try {
      if (editing === 'new') {
        await run(() => api.items.create({ title: form.title, description: form.description }));
        toast.success('Note saved');
      } else {
        await run(() =>
          api.items.update(editing.id, {
            title: form.title,
            description: form.description,
            ...(form.ai_summary ? { ai_summary: form.ai_summary } : {}),
          })
        );
        toast.success('Note updated');
      }
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const summarize = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      return toast.error('Write a title and some text first, then ask the AI to summarise');
    }
    setAiBusy(true);
    try {
      const res = await api.ai.summarizeNote({
        title: form.title,
        description: form.description,
        item_id: editing === 'new' ? null : editing.id,
        save: editing === 'new' ? false : true,
      });
      setForm((f) => ({ ...f, ai_summary: res.summary }));
      toast.success('AI summary ready — save to keep it');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const remove = async () => {
    try {
      await run(() => api.items.remove(deleting.id));
      toast.success('Note deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">My notes</h1>
          <p className="text-[13px] text-ink-mute">
            {items.length} note{items.length === 1 ? '' : 's'} · private to your account, saved in Supabase
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New note
        </Button>
      </div>

      {loading ? (
        <Spinner label="Loading your notes" />
      ) : error ? (
        <EmptyState icon={Radio} title="Cannot load notes" message={error.message} action={<Button onClick={reload}>Retry</Button>} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="No notes yet"
            message="Keep track of delays, complaints or anything the AI assistant should know. Add your first note."
            action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Create a note</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <Card key={n.id} className="flex flex-col p-5 card-hover">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{n.title}</h3>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(n)}
                    className="rounded-lg p-1.5 text-ink-mute transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Edit note"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleting(n)}
                    className="rounded-lg p-1.5 text-ink-mute transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {n.description && (
                <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-ink-soft">{n.description}</p>
              )}

              {n.ai_summary && (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-violet-700">
                    <Sparkles className="h-3 w-3" /> AI summary
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-violet-900/80">
                    {n.ai_summary}
                  </p>
                </div>
              )}

              <p className="mt-auto pt-3 text-[11.5px] text-ink-mute">
                {dayLabel(n.created_at)} · {clockTime(n.created_at)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* editor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New note' : 'Edit note'}
        subtitle="Saved to your account in Supabase"
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="soft"
              onClick={summarize}
              disabled={aiBusy}
              className={cx(aiBusy && 'opacity-70')}
            >
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiBusy ? 'Asking Gemini…' : 'Summarise with AI'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={save} loading={busy}>
                <Save className="h-4 w-4" /> Save note
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bus AP-16-AB-1234 delayed at Benz Circle"
              maxLength={120}
            />
          </Field>
          <Field label="Note" hint="Anything you want to remember or ask the AI about.">
            <Textarea
              rows={6}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Today the bus was 15 minutes late because of traffic near the flyover…"
            />
          </Field>
          {form.ai_summary && (
            <Field label="AI summary">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-violet-900/85">{form.ai_summary}</p>
              </div>
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this note?"
        message={`"${deleting?.title || ''}" will be permanently removed. This cannot be undone.`}
      />
    </div>
  );
}
