/**
 * Thin API client. The base URL comes from VITE_API_BASE_URL (set at build
 * time on the host) and falls back to the dev proxy. No secret ever lives here.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const API_BASE = BASE;

const TOKEN_KEY = 'scbt_token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
};

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || {};
    this.fieldErrors = details && !Array.isArray(details) ? details : {};
  }
}

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(
      'Cannot reach the server. Check your internet connection and try again.',
      0
    );
  }

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError('The server sent an unreadable response.', res.status);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized?.();
    throw new ApiError(json?.error || `Request failed (${res.status})`, res.status, json?.details);
  }
  return json;
}

const qs = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const api = {
  health: () => request('/api/health', { auth: false }),

  auth: {
    signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload, auth: false }),
    login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
    me: () => request('/api/auth/me'),
  },

  profile: {
    get: () => request('/api/profile'),
    update: (patch) => request('/api/profile', { method: 'PATCH', body: patch }),
    changeUsername: (username) => request('/api/profile/username', { method: 'PATCH', body: { username } }),
    changePassword: (currentPassword, newPassword) =>
      request('/api/profile/password', { method: 'POST', body: { currentPassword, newPassword } }),
  },

  fleet: {
    stops: () => request('/api/fleet/stops'),
    createStop: (b) => request('/api/fleet/stops', { method: 'POST', body: b }),
    updateStop: (id, b) => request(`/api/fleet/stops/${id}`, { method: 'PATCH', body: b }),
    deleteStop: (id) => request(`/api/fleet/stops/${id}`, { method: 'DELETE' }),

    routes: (params) => request(`/api/fleet/routes${qs(params)}`),
    route: (id) => request(`/api/fleet/routes/${id}`),
    createRoute: (b) => request('/api/fleet/routes', { method: 'POST', body: b }),
    updateRoute: (id, b) => request(`/api/fleet/routes/${id}`, { method: 'PATCH', body: b }),
    deleteRoute: (id) => request(`/api/fleet/routes/${id}`, { method: 'DELETE' }),
    setRouteStops: (id, stops) => request(`/api/fleet/routes/${id}/stops`, { method: 'PUT', body: { stops } }),

    buses: (params) => request(`/api/fleet/buses${qs(params)}`),
    createBus: (b) => request('/api/fleet/buses', { method: 'POST', body: b }),
    updateBus: (id, b) => request(`/api/fleet/buses/${id}`, { method: 'PATCH', body: b }),
    deleteBus: (id) => request(`/api/fleet/buses/${id}`, { method: 'DELETE' }),
  },

  live: {
    map: () => request('/api/live/map'),
    bus: (id) => request(`/api/live/buses/${id}`),
    shareLocation: (payload) => request('/api/live/location', { method: 'POST', body: payload }),
    addEvent: (payload) => request('/api/live/events', { method: 'POST', body: payload }),
    events: (params) => request(`/api/live/events${qs(params)}`),
  },

  admin: {
    users: (params) => request(`/api/admin/users${qs(params)}`),
    overview: () => request('/api/admin/overview'),
    createUser: (b) => request('/api/admin/users', { method: 'POST', body: b }),
    updateUser: (id, b) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: b }),
    deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
    resetPassword: (id, password) =>
      request(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: { password } }),
  },

  items: {
    list: () => request('/api/items'),
    create: (b) => request('/api/items', { method: 'POST', body: b }),
    update: (id, b) => request(`/api/items/${id}`, { method: 'PATCH', body: b }),
    remove: (id) => request(`/api/items/${id}`, { method: 'DELETE' }),
  },

  ai: {
    generate: (prompt) => request('/api/ai/generate', { method: 'POST', body: { prompt } }),
    summarizeNote: (b) => request('/api/ai/summarize-note', { method: 'POST', body: b }),
    tripSummary: (b) => request('/api/ai/trip-summary', { method: 'POST', body: b }),
    askAboutRoute: (question) => request('/api/ai/ask-about-route', { method: 'POST', body: { question } }),
    status: () => request('/api/ai/status'),
  },
};

export default api;
