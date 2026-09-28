/* eslint-disable no-console */
/** End-to-end smoke test against a running API. */
const BASE = process.env.BASE || 'http://localhost:8080';
let pass = 0;
let fail = 0;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

const uniq = Date.now().toString().slice(-6);

async function run() {
  console.log('\n── 1. Health ───────────────────────────────────');
  const h = await call('GET', '/health');
  check('server healthy + db connected', h.status === 200 && h.json.db === true, JSON.stringify(h.json));

  console.log('\n── 2. Sign up (anyone can create an account) ──');
  const su = await call('POST', '/api/auth/signup', {
    body: {
      email: `rahul${uniq}@college.edu`,
      username: `rahul${uniq}`,
      password: 'Secret@123',
      confirmPassword: 'Secret@123',
      full_name: 'Rahul Sharma',
      role: 'student',
    },
  });
  check('signup succeeds', su.status === 201 && su.json.token, JSON.stringify(su.json));
  check('password hash never returned', !JSON.stringify(su.json).includes('password_hash'));
  check('role is student', su.json.user?.role === 'student');
  tokens.student = su.json.token;

  const su2 = await call('POST', '/api/auth/signup', {
    body: {
      email: `lasya${uniq}@college.edu`,
      username: `lasya${uniq}`,
      password: 'Secret@123',
      confirmPassword: 'Secret@123',
      full_name: 'Lasya Reddy',
      role: 'driver',
    },
  });
  check('driver signup succeeds', su2.status === 201 && su2.json.user?.role === 'driver', JSON.stringify(su2.json).slice(0,160));
  tokens.driver = su2.json.token;

  const dupe = await call('POST', '/api/auth/signup', {
    body: { email: `rahul${uniq}@college.edu`, username: `other${uniq}`, password: 'Secret@123', confirmPassword: 'Secret@123', full_name: 'Duplicate Test' },
  });
  check('duplicate email rejected', dupe.status === 409, String(dupe.status));

  const dupe2 = await call('POST', '/api/auth/signup', {
    body: { email: `new${uniq}@college.edu`, username: `rahul${uniq}`, password: 'Secret@123', confirmPassword: 'Secret@123', full_name: 'Duplicate Test' },
  });
  check('duplicate username rejected', dupe2.status === 409, String(dupe2.status));

  const weak = await call('POST', '/api/auth/signup', {
    body: { email: 'x@y.com', username: 'ok', password: 'abc', confirmPassword: 'abc', full_name: '' },
  });
  check('weak signup rejected with field errors', weak.status === 400 && !!weak.json.details);

  const adminSpoof = await call('POST', '/api/auth/signup', {
    body: { email: `hack${uniq}@college.edu`, username: `hack${uniq}`, password: 'Secret@123', confirmPassword: 'Secret@123', full_name: 'Hacker', role: 'admin' },
  });
  check('self-signup cannot become admin', adminSpoof.json.user?.role === 'student');

  console.log('\n── 3. Login ─────────────────────────────────────');
  const byUser = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}`, password: 'Secret@123' } });
  check('login with username works', byUser.status === 200 && !!byUser.json.token);
  const byEmail = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}@college.edu`, password: 'Secret@123' } });
  check('login with email works', byEmail.status === 200);
  const wrong = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}`, password: 'wrongpass1' } });
  check('wrong password rejected', wrong.status === 401);
  const legacy = await call('POST', '/api/auth/login', { body: { emailOrUsername: 'student', password: '1234' } });
  check('old student/1234 no longer works', legacy.status === 401, String(legacy.status));
  const seeded = await call('POST', '/api/auth/login', { body: { emailOrUsername: 'rahul123', password: 'Student@123' } });
  check('seeded demo student can log in', seeded.status === 200);
  const admin = await call('POST', '/api/auth/login', { body: { emailOrUsername: 'admin', password: 'Admin@12345' } });
  check('admin can log in', admin.status === 200);
  tokens.admin = admin.json.token;

  console.log('\n── 4. Session + cross-device restore ─────────────');
  const me = await call('GET', '/api/auth/me', { token: tokens.student });
  check('GET /me restores session from token', me.status === 200 && me.json.user.username === `rahul${uniq}`);
  const noTok = await call('GET', '/api/auth/me');
  check('no token = 401', noTok.status === 401);
  const badTok = await call('GET', '/api/auth/me', { token: 'garbage.token.here' });
  check('bad token = 401', badTok.status === 401);

  console.log('\n── 5. Live map + fleet data ──────────────────────');
  const map = await call('GET', '/api/live/map', { token: tokens.student });
  check('live map returns buses', map.status === 200 && map.json.buses.length >= 4, `n=${map.json.buses?.length}`);
  check('stops + routes joined', map.json.stops.length >= 12 && map.json.routes.length >= 3);
  check('route stops are ordered objects', Array.isArray(map.json.routes[0].stops) && !!map.json.routes[0].stops[0].stop);
  const moving = map.json.buses.filter((b) => b.location);
  check('buses have live coordinates', moving.length > 0, `n=${moving.length}`);

  const stopSet = map.json.stops[0];
  // Give the new student a bus whose route actually serves their stop.
  const liveBuses = map.json.buses;
  const servingBus = liveBuses.find((b) => b.route?.stops?.some((s) => s.stop_id === stopSet.id)) || liveBuses[0];
  const adminTok0 = (await call('POST', '/api/auth/login', { body: { emailOrUsername: 'admin', password: 'Admin@12345' } })).json.token;
  await call('PATCH', `/api/admin/users/${su.json.user.id}`, { token: adminTok0, body: { bus_id: servingBus.id } });
  const patched = await call('PATCH', '/api/profile', {
    token: tokens.student,
    body: { full_name: 'Rahul S.', stop_id: stopSet.id, department: 'CSE' },
  });
  check('student sets own pickup stop', patched.status === 200 && patched.json.user.stop_id === stopSet.id);
  const eta = await call('GET', '/api/live/map', { token: tokens.student });
  check(
    'ETA computed once bus + stop are set',
    !!eta.json.my_bus && !!eta.json.my_bus.eta && eta.json.my_bus.eta.minutes > 0,
    JSON.stringify(eta.json.my_bus?.eta || null)
  );

  const badStop = await call('PATCH', '/api/profile', { token: tokens.student, body: { stop_id: 'not-a-uuid' } });
  check('invalid stop id rejected (server survives)', badStop.status === 400, String(badStop.status));
  const stillAlive = await call('GET', '/health');
  check('server still healthy after bad input', stillAlive.status === 200);

  console.log('\n── 6. Notes CRUD (per user) ─────────────────────');
  const create = await call('POST', '/api/items', { token: tokens.student, body: { title: 'Bus late today', description: '10 min late at Benz Circle.' } });
  check('create note', create.status === 201 && !!create.json.item.id);
  const id = create.json.item.id;
  const read = await call('GET', '/api/items', { token: tokens.student });
  check('list own notes', read.status === 200 && read.json.items.length >= 1);
  const upd = await call('PATCH', `/api/items/${id}`, { token: tokens.student, body: { title: 'Bus late (updated)' } });
  check('update note', upd.status === 200 && upd.json.item.title === 'Bus late (updated)');
  const otherList = await call('GET', '/api/items', { token: tokens.driver });
  check("other user cannot see it", !(otherList.json.items || []).some((i) => i.id === id));
  const cross = await call('PATCH', `/api/items/${id}`, { token: tokens.driver, body: { title: 'hacked' } });
  check('cross-user edit blocked (404)', cross.status === 404, String(cross.status));
  const del = await call('DELETE', `/api/items/${id}`, { token: tokens.student });
  check('delete note', del.status === 200);
  const after = await call('GET', '/api/items', { token: tokens.student });
  check('note is really gone', !(after.json.items || []).some((i) => i.id === id));

  console.log('\n── 7. Driver location sharing ───────────────────');
  const noBus = await call('POST', '/api/live/location', { token: tokens.driver, body: { lat: 16.5, lng: 80.6 } });
  check('driver without a bus is told clearly', noBus.status === 400 && /bus/i.test(noBus.json.error));

  const buses = (await call('GET', '/api/fleet/buses', { token: tokens.admin })).json.buses;
  const assign = await call('PATCH', `/api/admin/users/${su2.json.user.id}`, { token: tokens.admin, body: { bus_id: buses[0].id } });
  check('admin assigns a bus to the driver', assign.status === 200 && assign.json.user.bus_id === buses[0].id);

  const ping = await call('POST', '/api/live/location', { token: tokens.driver, body: { lat: 16.5089, lng: 80.6359, speed: 32, status: 'delayed' } });
  check('driver shares GPS', ping.status === 200);
  const busDetail = await call('GET', `/api/live/buses/${buses[0].id}`, { token: tokens.student });
  check('bus detail lists next stops', busDetail.status === 200 && busDetail.json.next_stops.length > 0);
  check('status persisted', busDetail.json.location.status === 'delayed');

  const badCoords = await call('POST', '/api/live/location', { token: tokens.driver, body: { lat: 999, lng: 80.6 } });
  check('bad coordinates rejected', badCoords.status === 400);

  console.log('\n── 8. Role-based access control ─────────────────');
  const studentUsers = await call('GET', '/api/admin/users', { token: tokens.student });
  check('student blocked from admin API', studentUsers.status === 403, String(studentUsers.status));
  const studentCreateBus = await call('POST', '/api/fleet/buses', { token: tokens.student, body: { bus_number: 'X-1', name: 'Nope' } });
  check('student cannot create buses', studentCreateBus.status === 403);
  const studentLocation = await call('POST', '/api/live/location', { token: tokens.student, body: { lat: 16.5, lng: 80.6 } });
  check('student cannot push GPS', studentLocation.status === 403);
  const adminUsers = await call('GET', '/api/admin/users', { token: tokens.admin });
  check('admin can list users', adminUsers.status === 200 && adminUsers.json.users.length >= 5);
  const overview = await call('GET', '/api/admin/overview', { token: tokens.admin });
  check('admin overview stats', overview.status === 200 && overview.json.stats.students >= 2);

  console.log('\n── 9. Admin fleet CRUD ──────────────────────────');
  const newStop = await call('POST', '/api/fleet/stops', { token: tokens.admin, body: { name: 'Test Junction', lat: 16.51, lng: 80.64, code: 'TJ01' } });
  check('create stop', newStop.status === 201);
  const updStop = await call('PATCH', `/api/fleet/stops/${newStop.json.stop.id}`, { token: tokens.admin, body: { name: 'Test Junction 2' } });
  check('update stop', updStop.status === 200 && updStop.json.stop.name === 'Test Junction 2');
  const newBus = await call('POST', '/api/fleet/buses', { token: tokens.admin, body: { bus_number: 'AP-16-TEST', name: 'Testbus' } });
  check('create bus', newBus.status === 201);
  const delBus = await call('DELETE', `/api/fleet/buses/${newBus.json.bus.id}`, { token: tokens.admin });
  check('delete bus', delBus.status === 200);
  const delStop = await call('DELETE', `/api/fleet/stops/${newStop.json.stop.id}`, { token: tokens.admin });
  check('delete stop', delStop.status === 200);
  const newRoute = await call('POST', '/api/fleet/routes', { token: tokens.admin, body: { name: 'Test Route', code: 'RT-T' } });
  check('create route', newRoute.status === 201);
  const stopsToUse = (await call('GET', '/api/fleet/stops', { token: tokens.admin })).json.stops.slice(0, 2);
  const setStops = await call('PUT', `/api/fleet/routes/${newRoute.json.route.id}/stops`, {
    token: tokens.admin,
    body: { stops: stopsToUse.map((s, i) => ({ stop_id: s.id, time_offset_min: i * 10 })) },
  });
  check('set ordered route stops', setStops.status === 200 && setStops.json.route.stops.length === 2);
  const delRoute = await call('DELETE', `/api/fleet/routes/${newRoute.json.route.id}`, { token: tokens.admin });
  check('delete route', delRoute.status === 200);

  console.log('\n── 10. Data persists across a new session ───────');
  const relog = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}`, password: 'Secret@123' } });
  const fresh = await call('GET', '/api/profile', { token: relog.json.token });
  check('profile edit survived re-login', fresh.json.user.department === 'CSE' && fresh.json.user.stop_id === stopSet.id);

  console.log('\n── 11. Password change ──────────────────────────');
  const wrongPw = await call('POST', '/api/profile/password', { token: tokens.student, body: { currentPassword: 'nope', newPassword: 'NewPass@123' } });
  check('wrong current password rejected', wrongPw.status === 401);
  const changePw = await call('POST', '/api/profile/password', { token: tokens.student, body: { currentPassword: 'Secret@123', newPassword: 'NewPass@123' } });
  check('password changed', changePw.status === 200);
  const loginNewPw = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}`, password: 'NewPass@123' } });
  check('login with new password works', loginNewPw.status === 200);
  const loginOldPw = await call('POST', '/api/auth/login', { body: { emailOrUsername: `rahul${uniq}`, password: 'Secret@123' } });
  check('old password no longer works', loginOldPw.status === 401);

  console.log('\n── 12. CORS ─────────────────────────────────────');
  const cors = await fetch(`${BASE}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  check('allowed origin accepted', cors.headers.get('access-control-allow-origin') === 'http://localhost:5173');

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  PASS ${pass}   FAIL ${fail}`);
  console.log(`═══════════════════════════════════════════════════\n`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error('TEST CRASHED:', e);
  process.exit(1);
});
