import { useState } from 'react';
import {
  Bus,
  MapPinned,
  Sparkles,
  ShieldCheck,
  Users,
  Route as RouteIcon,
  ArrowRight,
  CheckCircle2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Field, Input, Badge } from '../components/ui.jsx';
import { cx } from '../lib/utils.js';
import api from '../lib/api.js';

const FEATURES = [
  { icon: MapPinned, title: 'Live map tracking', text: 'See every college bus moving in real time.' },
  { icon: RouteIcon, title: 'Routes & bus stops', text: 'Pick your stop and see the full route line.' },
  { icon: Users, title: 'Three profiles', text: 'Student, driver and admin — each with its own console.' },
  { icon: Sparkles, title: 'AI assistant', text: 'Gemini summarises your notes and trip reports.' },
];

export default function AuthPage() {
  const { login, signup } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    email: '',
    username: '',
    full_name: '',
    phone: '',
    role: 'student',
    password: '',
    confirmPassword: '',
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (mode === 'login') {
        const user = await login(form.email.trim(), form.password);
        toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      } else {
        const user = await signup({
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        });
        toast.success(`Account created — welcome, ${user.full_name.split(' ')[0]}!`);
      }
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- brand panel ---------------- */}
      <section className="relative hidden overflow-hidden bg-brand-700 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(700px 380px at 10% 5%, rgba(255,255,255,.22), transparent 60%), radial-gradient(600px 400px at 90% 20%, rgba(167,139,250,.45), transparent 60%), radial-gradient(700px 500px at 50% 100%, rgba(56,189,248,.35), transparent 60%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-tight tracking-tight">Smart College</p>
            <p className="text-[13px] font-medium text-white/70">Bus Tracker</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-lg pt-12">
          <Badge className="bg-white/15 text-white ring-1 ring-white/25">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Google Gemini
          </Badge>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
            Never miss your bus.
            <span className="block text-white/65">Know exactly where it is.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/75">
            One place for students, drivers and admins to follow every college bus — live location, route,
            stops and arrival times.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                <f.icon className="h-5 w-5 text-white/90" />
                <p className="mt-2.5 text-sm font-bold">{f.title}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-white/65">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-10 text-[12.5px] text-white/55">
          Built for students of Andhra Pradesh colleges · Vijayawada &amp; Guntur corridors
        </p>
      </section>

      {/* ---------------- form panel ---------------- */}
      <section className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px]">
          {/* mobile brand */}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-glow">
              <Bus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-extrabold leading-tight tracking-tight text-ink">
                Smart College Bus Tracker
              </p>
              <p className="text-[12.5px] text-ink-mute">Live bus locations &amp; routes</p>
            </div>
          </div>

          <div className="card p-6 shadow-card sm:p-7">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1.5 text-sm text-ink-mute">
                {mode === 'login'
                  ? 'Log in with the username or email you registered.'
                  : 'Pick any username you like — it is yours alone.'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100/90 p-1.5">
              {[
                { id: 'login', label: 'Log in' },
                { id: 'signup', label: 'Sign up' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchMode(t.id)}
                  className={cx(
                    'rounded-xl py-2.5 text-sm font-bold transition',
                    mode === t.id
                      ? 'bg-white text-brand-700 shadow-soft'
                      : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === 'login' ? (
                <Field label="Username or email" error={errors.emailOrUsername || errors.email}>
                  <Input
                    name="emailOrUsername"
                    autoComplete="username"
                    placeholder="rahul123 or you@college.edu"
                    value={form.email}
                    onChange={set('email')}
                    error={errors.emailOrUsername || errors.email}
                    required
                  />
                </Field>
              ) : (
                <>
                  <Field label="Full name" error={errors.full_name}>
                    <Input
                      autoComplete="name"
                      placeholder="Rahul Sharma"
                      value={form.full_name}
                      onChange={set('full_name')}
                      error={errors.full_name}
                      required
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Username" error={errors.username} hint="3–24 characters">
                      <Input
                        autoComplete="username"
                        placeholder="rahul123"
                        value={form.username}
                        onChange={set('username')}
                        error={errors.username}
                        required
                      />
                    </Field>
                    <Field label="Phone" error={errors.phone}>
                      <Input
                        inputMode="tel"
                        placeholder="98765 43210"
                        value={form.phone}
                        onChange={set('phone')}
                        error={errors.phone}
                      />
                    </Field>
                  </div>

                  <Field label="Email" error={errors.email}>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@college.edu"
                      value={form.email}
                      onChange={set('email')}
                      error={errors.email}
                      required
                    />
                  </Field>

                  <Field label="I am joining as">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'student', label: 'Student', icon: Users },
                        { id: 'driver', label: 'Bus driver', icon: Bus },
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                          className={cx(
                            'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition',
                            form.role === r.id
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-slate-200 bg-white text-ink-soft hover:border-slate-300'
                          )}
                        >
                          <r.icon className="h-4 w-4" />
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-ink-mute">
                      Admin accounts are created by an existing admin.
                    </p>
                  </Field>
                </>
              )}

              <Field
                label="Password"
                error={errors.password}
                hint={mode === 'signup' ? 'At least 8 characters with a letter and a number' : undefined}
              >
                <Input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Your password' : 'Create a password'}
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                  required
                />
              </Field>

              {mode === 'signup' && (
                <Field label="Confirm password" error={errors.confirmPassword}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    error={errors.confirmPassword}
                    required
                  />
                </Field>
              )}

              <Button type="submit" size="lg" loading={busy} className="w-full">
                {mode === 'login' ? 'Log in' : 'Create account'}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-[12.5px] leading-snug text-ink-soft">
                Passwords are hashed with <strong className="font-semibold">bcrypt</strong> before they ever touch
                the database. Your session is a signed token, so you stay logged in on any device.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.health();
                  setOnline(true);
                } catch {
                  setOnline(false);
                }
              }}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-mute transition hover:text-ink"
            >
              {online ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-rose-500" />}
              {online ? 'Server connected' : 'Server unreachable'}
            </button>
            <p className="text-[12.5px] text-ink-mute">
              {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
              >
                {mode === 'login' ? 'Create an account' : 'Log in instead'}
              </button>
            </p>
          </div>

          {mode === 'signup' && (
            <div className="mt-4 flex items-start gap-2 px-1">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <p className="text-[12.5px] leading-snug text-ink-mute">
                Every person who opens this link can create their own account — no shared logins, no fixed
                student/1234.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
