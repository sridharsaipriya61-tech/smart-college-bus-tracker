import express from 'express';
import { supabaseAdmin, q, HttpError, notFound } from '../services/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { str } from '../middleware/validate.js';

/**
 * Personal notes / trip observations — the per-user CRUD surface.
 * RLS on `items` mirrors this: a user can only ever touch their own rows.
 */
const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const items = await q(
      supabaseAdmin.from('items').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
    );
    res.json({ items });
  })
);

router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const item = await q(
      supabaseAdmin.from('items').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle()
    );
    if (!item) throw notFound('Note not found');
    res.json({ item });
  })
);

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const title = str(req.body.title);
    if (!title) throw new HttpError(400, 'Please fix the highlighted fields', { title: 'Give your note a title' });
    const { data, error } = await supabaseAdmin
      .from('items')
      .insert({
        user_id: req.user.id,
        title,
        description: str(req.body.description) || null,
        ai_summary: str(req.body.ai_summary) || null,
      })
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ item: data });
  })
);

router.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const patch = {};
    if (req.body.title !== undefined) {
      const t = str(req.body.title);
      if (!t) throw new HttpError(400, 'Please fix the highlighted fields', { title: 'Title cannot be empty' });
      patch.title = t;
    }
    if (req.body.description !== undefined) patch.description = str(req.body.description) || null;
    if (req.body.ai_summary !== undefined) patch.ai_summary = str(req.body.ai_summary) || null;
    const { data, error } = await supabaseAdmin
      .from('items')
      .update(patch)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single();
    if (error) throw new HttpError(404, 'Note not found');
    res.json({ item: data });
  })
);

router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('items')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .single();
    if (error) throw new HttpError(404, 'Note not found');
    res.json({ ok: true, id: data.id });
  })
);

export default router;
