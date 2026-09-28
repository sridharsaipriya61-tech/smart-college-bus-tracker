import express from 'express';
import { env } from '../config/env.js';
import { supabaseAdmin, q, HttpError } from '../services/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { str } from '../middleware/validate.js';
import { publicUser } from './auth.js';

const router = express.Router();
router.use(requireAuth);

/* Model preference order — newest first. Resolved against the key's real
   catalogue at runtime, because Google retires and renames models regularly. */
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter(Boolean);

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const modelCache = new Map();

/** Ask Google which models this key can actually call, then use them in order. */
async function resolveModels() {
  const cached = modelCache.get(env.geminiApiKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.list;
  const list = [...MODELS];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${env.geminiApiKey}`
    );
    if (res.ok) {
      const json = await res.json();
      const available = (json.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => !/tts|image|embedding|robotics|computer-use/i.test(n));
      for (const n of available) if (!list.includes(n)) list.push(n);
    }
  } catch {
    /* keep the static list */
  }
  modelCache.set(env.geminiApiKey, { list, at: Date.now() });
  return list;
}

async function callOnce({ system, prompt }) {
  if (!env.geminiApiKey) {
    throw new HttpError(503, 'AI is not configured on the server yet. Add GEMINI_API_KEY to server/.env');
  }
  let lastError;
  for (const model of await resolveModels()) {
    try {
      const res = await fetch(ENDPOINT(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
        body: JSON.stringify({
          // The role guidance is inlined into the user turn: some Gemini
          // generations echo a systemInstruction back instead of following it.
          contents: [
            {
              role: 'user',
              parts: [{ text: `${system}\n\n----------\n${prompt}` }],
            },
          ],
          generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const parts = json?.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text).join('').trim();
        if (text) return { text, model };
        // The model answered but with nothing usable — no point retrying others.
        throw new HttpError(502, 'Gemini returned an empty answer. Please try again.');
      }
      const body = await res.text();
      if (res.status === 429) throw new HttpError(429, 'Gemini rate limit reached. Please try again in a moment.');
      if ([400, 403, 404, 429, 500, 502, 503, 504].includes(res.status)) {
        lastError = new HttpError(res.status, `Gemini error (${res.status})`);
        continue; // retired, blocked or momentarily overloaded — try the next model
      }
      lastError = new HttpError(502, `Gemini error (${res.status}): ${body.slice(0, 200)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) throw e;
      lastError = e;
    }
  }
  if (lastError?.status === 403)
    throw new HttpError(403, 'This Gemini API key cannot use the available models. Check GEMINI_API_KEY.');
  if ([429, 503].includes(lastError?.status))
    throw new HttpError(503, 'Google Gemini is busy right now. Please try again in a moment.');
  throw new HttpError(502, lastError?.message || 'AI is temporarily unavailable');
}

/** Google throttles bursts — give the whole model list one more go. */
async function callGemini(args) {
  try {
    return await callOnce(args);
  } catch (e) {
    if (![429, 502, 503].includes(e.status)) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return callOnce(args);
  }
}

const SYSTEM = `You are the Smart College Bus Tracker assistant for a college in Andhra Pradesh, India.
Be friendly, practical and concise. Use short paragraphs or tight bullet points.
Never invent bus schedules, driver names, or timings that were not given to you — if data is missing, say what is missing.`;

const clean = (s) => s.replace(/```[a-z]*\n?/g, '').trim();

/* ------------------------------------------------------------------ *
 *  POST /api/ai/generate  { prompt }  — the single public AI entry   *
 * ------------------------------------------------------------------ */
router.post(
  '/generate',
  asyncRoute(async (req, res) => {
    const prompt = str(req.body.prompt);
    if (!prompt) throw new HttpError(400, 'Ask the assistant something first');
    if (prompt.length > 4000) throw new HttpError(400, 'Please keep your message under 4000 characters');

    const { text, model } = await callGemini({
      system: SYSTEM,
      prompt: `${req.user.full_name} (role: ${req.user.role}) asks: ${prompt}`,
    });
    res.json({ reply: clean(text), model });
  })
);

/* ------------------------------------------------------------------ *
 *  POST /api/ai/summarize-note — creates/updates a note with AI help  *
 * ------------------------------------------------------------------ */
router.post(
  '/summarize-note',
  asyncRoute(async (req, res) => {
    const title = str(req.body.title);
    const description = str(req.body.description);
    if (!title) throw new HttpError(400, 'Please fix the highlighted fields', { title: 'Give your note a title' });
    if (!description) throw new HttpError(400, 'Please fix the highlighted fields', { description: 'Write something first' });

    const { text, model } = await callGemini({
      system: SYSTEM,
      prompt: `Summarise this ${req.user.role} note for a college bus app in at most 3 short bullet points, then one actionable next step.\n\nTitle: ${title}\nNote: ${description}`,
    });

    let item = null;
    if (str(req.body.save) !== 'false') {
      const row = {
        user_id: req.user.id,
        title,
        description,
        ai_summary: clean(text),
      };
      if (str(req.body.item_id)) {
        const { data, error } = await supabaseAdmin
          .from('items')
          .update({ ...row, description: undefined })
          .eq('id', str(req.body.item_id))
          .eq('user_id', req.user.id)
          .select('*')
          .single();
        if (error) throw new HttpError(404, 'Note not found');
        item = data;
      } else {
        const { data, error } = await supabaseAdmin.from('items').insert(row).select('*').single();
        if (error) throw new HttpError(400, error.message);
        item = data;
      }
    }
    res.json({ summary: clean(text), model, item });
  })
);

/* ------------------------------------------------------------------ *
 *  POST /api/ai/trip-summary — admin/driver daily operations digest   *
 * ------------------------------------------------------------------ */
router.post(
  '/trip-summary',
  asyncRoute(async (req, res) => {
    if (req.user.role === 'student')
      throw new HttpError(403, 'Trip reports are available to drivers and admins');

    let busQuery = supabaseAdmin.from('buses').select('*');
    if (req.user.role === 'driver') busQuery = busQuery.eq('driver_id', req.user.id);
    const buses = await q(busQuery);
    const busIds = buses.map((b) => b.id);

    const [events, locations] = await Promise.all([
      busIds.length
        ? q(
            supabaseAdmin
              .from('trip_events')
              .select('*')
              .in('bus_id', busIds)
              .gte('created_at', new Date(Date.now() - 864e5).toISOString())
              .order('created_at', { ascending: false })
              .limit(120)
          )
        : [],
      busIds.length ? q(supabaseAdmin.from('bus_locations').select('*').in('bus_id', busIds)) : [],
    ]);

    const busLines = buses
      .map((b) => {
        const loc = locations.find((l) => l.bus_id === b.id);
        return `- ${b.bus_number} (${b.name}), status ${b.status}, last ping ${
          loc ? loc.updated_at : 'never'
        } at ${loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'unknown'}`;
      })
      .join('\n');
    const eventLines = events
      .slice(0, 40)
      .map((e) => `- [${e.event_type}] ${e.note || ''} (${e.created_at})`)
      .join('\n');

    const { text, model } = await callGemini({
      system: SYSTEM,
      prompt: `Write a short daily operations digest for the bus fleet manager.
Structure: 1) Status overview, 2) Issues that need attention, 3) Recommended actions (max 4 bullets).
Use only the data below.

FLEET (${buses.length} buses):
${busLines || '- none'}

RECENT EVENTS (last 24h, ${events.length}):
${eventLines || '- none'}`,
    });

    let item = null;
    if (str(req.body.save) !== 'false') {
      const { data } = await supabaseAdmin
        .from('items')
        .insert({
          user_id: req.user.id,
          title: `Fleet report — ${new Date().toLocaleDateString('en-IN')}`,
          description: `${buses.length} buses · ${events.length} events in the last 24h`,
          ai_summary: clean(text),
        })
        .select('*')
        .single();
      item = data;
    }
    res.json({ summary: clean(text), model, item });
  })
);

/* ------------------------------------------------------------------ *
 *  POST /api/ai/ask-about-route — grounded answers from live fleet  *
 * ------------------------------------------------------------------ */
router.post(
  '/ask-about-route',
  asyncRoute(async (req, res) => {
    const question = str(req.body.question);
    if (!question) throw new HttpError(400, 'Ask a question first');

    const [buses, stops] = await Promise.all([
      q(supabaseAdmin.from('buses').select('bus_number, name, status').limit(30)),
      q(supabaseAdmin.from('bus_stops').select('name, landmark').limit(40)),
    ]);

    const { text, model } = await callGemini({
      system: SYSTEM,
      prompt: `Answer the question using the fleet information below. If the data does not cover it, say so and suggest contacting the admin.

Buses: ${buses.map((b) => `${b.bus_number} ${b.name} (${b.status})`).join(', ') || 'none'}
Stops: ${stops.map((s) => s.name).join(', ') || 'none'}

Question: ${question}`,
    });
    res.json({ reply: clean(text), model });
  })
);

/** GET /api/ai/status */
router.get('/status', (req, res) => {
  res.json({ enabled: !!env.geminiApiKey, user: publicUser(req.user) });
});

export default router;
