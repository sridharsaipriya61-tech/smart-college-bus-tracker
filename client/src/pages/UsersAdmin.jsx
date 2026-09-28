import { useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  KeyRound,
  ShieldCheck,
  Bus,
  MapPin,
  UserCheck,
  UserX,
  Radio,
  Save,
  X,
} from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import api from '../lib/api.js';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  Spinner,
  Modal,
  Field,
  Input,
  Select,
  Tabs,
  ConfirmDialog,
  Avatar,
} from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, dayLabel, initials } from '../lib/utils.js';

const ROLE_TABS = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'driver', label: 'Drivers' },
  { value: 'admin', label: 'Admins' },
];

const empty = {
  email: '',
  username: '',
  password: '',
  full_name: '',
  role: 'student',
  phone: '',
  bus_id: '',
  stop_id: '',
};

const ROLE_TONE = { student: 'blue', driver: 'sky', admin: 'violet' };

export default function UsersAdmin() {
  const toast = useToast();
  const overview = useApi('/api/admin/overview', { poll: 0 });
  const fleet = useApi('/api/live/map', { poll: 0 });
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [errors, setErrors] = useState({});
  const { run, busy } = useAction();

  const list = useApi(`/api/admin/users${tab !== 'all' ? `?role=${tab}` : ''}`, {
    poll: 0,
    deps: [tab],
  });

  const users = (list.data?.users || []).filter((u) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return `${u.full_name} ${u.email} ${u.username} ${u.roll_no || ''}`.toLowerCase().includes(t);
  });
  const buses = fleet.data?.buses || [];
  const stops = fleet.data?.stops || [];

  const open = (item) => {
    setErrors({});
    setForm(
      item
        ? {
            email: item.email,
            username: item.username,
            password: '',
            full_name: item.full_name,
            role: item.role,
            phone: item.phone || '',
            bus_id: item.bus_id || '',
            stop_id: item.stop_id || '',
          }
        : empty
    );
    setEditing(item || 'new');
  };

  const setF = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));
  };

  const save = async () => {
    try {
      if (editing === 'new') {
        await run(() => api.admin.createUser(form));
        toast.success(`${form.full_name} can now log in with @${form.username}`);
      } else {
        await run(() =>
          api.admin.updateUser(editing.id, {
            full_name: form.full_name,
            role: form.role,
            phone: form.phone,
            bus_id: form.bus_id || null,
            stop_id: form.stop_id || null,
            email: form.email,
          })
        );
        toast.success('User updated');
      }
      setEditing(null);
      list.reload();
    } catch (e) {
      setErrors(e.fieldErrors || {});
      toast.error(e.message);
    }
  };

  const toggleActive = async (u) => {
    try {
      await run(() => api.admin.updateUser(u.id, { active: !u.active }));
      toast.success(u.active ? `${u.full_name} deactivated` : `${u.full_name} reactivated`);
      list.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async () => {
    try {
      await run(() => api.admin.deleteUser(deleting.id));
      toast.success('Account deleted');
      setDeleting(null);
      list.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doReset = async () => {
    try {
      await run(() => api.admin.resetPassword(resetting.id, newPassword));
      toast.success(`Password reset for @${resetting.username}`);
      setResetting(null);
      setNewPassword('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">People</h1>
          <p className="text-[13px] text-ink-mute">
            {overview.data?.stats?.students || 0} students · {overview.data?.stats?.drivers || 0} drivers ·{' '}
            {overview.data?.stats?.admins || 0} admins
          </p>
        </div>
        <Button onClick={() => open()}>
          <Plus className="h-4 w-4" /> Add person
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Users, label: 'Students', value: overview.data?.stats?.students || 0, tone: 'blue' },
          { icon: Bus, label: 'Drivers', value: overview.data?.stats?.drivers || 0, tone: 'sky' },
          { icon: ShieldCheck, label: 'Admins', value: overview.data?.stats?.admins || 0, tone: 'violet' },
        ].map(({ icon: Icon, label, value, tone }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <div
              className={cx(
                'grid h-10 w-10 place-items-center rounded-xl',
                tone === 'blue' ? 'bg-brand-50 text-brand-600' : tone === 'sky' ? 'bg-sky-50 text-sky-600' : 'bg-violet-50 text-violet-600'
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-ink">{value}</p>
              <p className="text-[12.5px] font-semibold text-ink-mute">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={ROLE_TABS} className="max-w-md flex-1" />
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="pl-9" />
        </div>
      </div>

      {list.loading ? (
        <Spinner label="Loading people" />
      ) : list.error ? (
        <EmptyState icon={Radio} title="Cannot load people" message={list.error.message} action={<Button onClick={list.reload}>Retry</Button>} />
      ) : users.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No one here yet" message="Add students, drivers or admins to get started." action={<Button onClick={() => open()}>Add person</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.id} className={cx('p-4', u.active === false && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <Avatar name={u.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{u.full_name}</p>
                  <p className="truncate text-[12.5px] text-ink-mute">@{u.username}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                    {u.active === false && <Badge tone="rose">Inactive</Badge>}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-[12.5px]">
                {u.roll_no && (
                  <p className="flex items-center gap-1.5 text-ink-soft">
                    <span className="font-semibold text-ink-mute">Roll</span> {u.roll_no} {u.department && `· ${u.department}`} {u.year && `· ${u.year}`}
                  </p>
                )}
                {u.bus && (
                  <p className="flex items-center gap-1.5 text-ink-soft">
                    <Bus className="h-3.5 w-3.5 shrink-0 text-ink-mute" /> {u.bus.bus_number}
                  </p>
                )}
                {u.stop && (
                  <p className="flex items-center gap-1.5 text-ink-soft">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-mute" /> {u.stop.name}
                  </p>
                )}
                <p className="text-[11.5px] text-ink-mute">Joined {dayLabel(u.created_at)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                <Button size="sm" variant="outline" onClick={() => open(u)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>
                  <KeyRound className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} loading={busy}>
                  {u.active === false ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-rose-600" onClick={() => setDeleting(u)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* add / edit */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing === 'new' ? 'Add a person' : `Edit ${editing?.full_name || ''}`}
        subtitle={editing === 'new' ? 'They can log in immediately with this username and password' : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.full_name}>
            <Input value={form.full_name} onChange={setF('full_name')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={setF('email')} />
          </Field>
          {editing === 'new' ? (
            <>
              <Field label="Username" error={errors.username}>
                <Input value={form.username} onChange={setF('username')} placeholder="rahul123" />
              </Field>
              <Field label="Password" error={errors.password} hint="At least 8 characters">
                <Input type="text" value={form.password} onChange={setF('password')} />
              </Field>
            </>
          ) : (
            <Field label="Username" hint="Usernames can only be changed by the user">
              <Input value={form.username} disabled />
            </Field>
          )}
          <Field label="Role" error={errors.role}>
            <Select value={form.role} onChange={setF('role')}>
              <option value="student">Student</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Phone">
            <Input inputMode="tel" value={form.phone} onChange={setF('phone')} />
          </Field>
          <Field label="Assign bus">
            <Select value={form.bus_id} onChange={setF('bus_id')}>
              <option value="">No bus</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>{b.bus_number} — {b.route?.name || b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assign stop">
            <Select value={form.stop_id} onChange={setF('stop_id')}>
              <option value="">No stop</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      {/* reset password */}
      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        size="sm"
        title="Reset password"
        subtitle={resetting ? `Set a new password for @${resetting.username}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetting(null)}>Cancel</Button>
            <Button onClick={doReset} loading={busy} disabled={newPassword.length < 8}>
              Reset password
            </Button>
          </div>
        }
      >
        <Field label="New password" hint="Share it with the user — they can change it later in their profile.">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this account?"
        message={`@${deleting?.username} (${deleting?.full_name}) will lose access immediately. Their notes will be deleted too.`}
      />
    </div>
  );
}
