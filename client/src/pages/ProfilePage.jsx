import { useEffect, useState } from 'react';
import {
  User,
  Mail,
  AtSign,
  Bus,
  MapPin,
  Lock,
  Save,
  ShieldCheck,
  Phone,
  GraduationCap,
  IdCard,
} from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import { Card, Button, Badge, Spinner, Field, Input, Select, Tabs } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, dayLabel } from '../lib/utils.js';

const TABS = [
  { value: 'details', label: 'Details', icon: User },
  { value: 'assignment', label: 'My bus & stop', icon: Bus },
  { value: 'security', label: 'Security', icon: Lock },
];

export default function ProfilePage() {
  const { user, setUser, isAdmin, isDriver } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    roll_no: user.roll_no || '',
    department: user.department || '',
    year: user.year || '',
    license_no: user.license_no || '',
  });
  const [username, setUsername] = useState(user.username || '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [assignment, setAssignment] = useState({ bus_id: user.bus_id || '', stop_id: user.stop_id || '' });
  const { run, busy } = useAction();
  const { data: map } = useApi('/api/live/map', { poll: 0 });

  useEffect(() => {
    setAssignment({ bus_id: user.bus_id || '', stop_id: user.stop_id || '' });
  }, [user.bus_id, user.stop_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveDetails = async () => {
    try {
      const res = await run(() => api.profile.update(form));
      setUser(res.user);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saveUsername = async () => {
    try {
      const res = await run(() => api.profile.changeUsername(username.trim()));
      setUser(res.user);
      toast.success('Username updated — use it to log in next time');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const savePassword = async () => {
    if (pw.newPassword !== pw.confirmPassword) return toast.error('New passwords do not match');
    try {
      await run(() => api.profile.changePassword(pw.currentPassword, pw.newPassword));
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saveAssignment = async () => {
    try {
      const res = await run(() =>
        api.profile.update({ bus_id: assignment.bus_id || null, stop_id: assignment.stop_id || null })
      );
      setUser(res.user);
      toast.success('Assignment saved');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (busy && !map) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* header */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 p-6 text-white shadow-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(460px 240px at 90% 0%, rgba(255,255,255,.45), transparent 60%), radial-gradient(400px 260px at 5% 100%, rgba(56,189,248,.5), transparent 60%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-extrabold ring-1 ring-white/25 backdrop-blur">
            {(user.full_name || '?')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{user.full_name}</h1>
            <p className="truncate text-[13.5px] text-white/75">
              @{user.username} · {user.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="chip bg-white/20 text-white ring-1 ring-white/25">
                {isAdmin ? 'Administrator' : isDriver ? 'Bus driver' : 'Student'}
              </span>
              <span className="chip bg-white/15 text-white/80">Joined {dayLabel(user.created_at)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="max-w-md" />

      {/* ---------------- details ---------------- */}
      {tab === 'details' && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-tight text-ink">Personal details</h2>
          <p className="mt-0.5 text-[13px] text-ink-mute">Visible to the admin when they manage your account.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.full_name} onChange={set('full_name')} />
            </Field>
            <Field label="Phone">
              <Input inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
            </Field>

            {isDriver ? (
              <Field label="Licence number" className="sm:col-span-2">
                <Input value={form.license_no} onChange={set('license_no')} placeholder="AP-DL-2021-778812" />
              </Field>
            ) : (
              <>
                <Field label="Roll number">
                  <Input value={form.roll_no} onChange={set('roll_no')} placeholder="21CS045" />
                </Field>
                <Field label="Department">
                  <Input value={form.department} onChange={set('department')} placeholder="CSE" />
                </Field>
                <Field label="Year">
                  <Input value={form.year} onChange={set('year')} placeholder="3rd Year" />
                </Field>
              </>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveDetails} loading={busy}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </Card>
      )}

      {/* ---------------- assignment ---------------- */}
      {tab === 'assignment' && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-tight text-ink">My bus & pickup stop</h2>
          <p className="mt-0.5 text-[13px] text-ink-mute">
            The admin can also assign these for you from the Users page.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Bus">
              <Select value={assignment.bus_id} onChange={(e) => setAssignment((a) => ({ ...a, bus_id: e.target.value }))}>
                <option value="">No bus assigned</option>
                {(map?.buses || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bus_number} — {b.route?.name || b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pickup stop">
              <Select value={assignment.stop_id} onChange={(e) => setAssignment((a) => ({ ...a, stop_id: e.target.value }))}>
                <option value="">No stop selected</option>
                {(map?.stops || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveAssignment} loading={busy}>
              <Save className="h-4 w-4" /> Save assignment
            </Button>
          </div>
        </Card>
      )}

      {/* ---------------- security ---------------- */}
      {tab === 'security' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Change username</h2>
            <p className="mt-0.5 text-[13px] text-ink-mute">This is what you type to log in.</p>
            <Field label="Username" className="mt-4">
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" />
              </div>
            </Field>
            <Button className="mt-4" onClick={saveUsername} loading={busy} disabled={username === user.username}>
              Update username
            </Button>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Change password</h2>
            <p className="mt-0.5 text-[13px] text-ink-mute">Minimum 8 characters with a letter and a number.</p>
            <div className="mt-4 space-y-3.5">
              <Field label="Current password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={pw.currentPassword}
                  onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </Field>
              <Field label="New password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pw.newPassword}
                  onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pw.confirmPassword}
                  onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </Field>
            </div>
            <Button className="mt-4" onClick={savePassword} loading={busy}>
              <Lock className="h-4 w-4" /> Update password
            </Button>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Account information
            </h3>
            <div className="mt-3 grid gap-2.5 text-[13px] sm:grid-cols-2">
              {[
                { icon: Mail, label: 'Email', value: user.email },
                { icon: AtSign, label: 'Username', value: `@${user.username}` },
                { icon: IdCard, label: 'Role', value: user.role },
                { icon: GraduationCap, label: 'Status', value: user.active === false ? 'Deactivated' : 'Active' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-ink-mute" />
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-ink-mute">{label}</p>
                    <p className="truncate font-bold capitalize text-ink">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
