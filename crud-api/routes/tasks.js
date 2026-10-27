const { Router } = require('express');
const { z } = require('zod');
const store = require('../lib/store');

const router = Router();

const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

const taskUpdateSchema = taskCreateSchema.partial();

// Centralized handler — emits 400 with a flat error list instead of
// dumping the zod issue tree, which is easier for non-TS clients to
// consume.
function badRequest(res, error) {
  const details = error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
  res.status(400).json({ error: 'validation_failed', details });
}

// GET /api/tasks?limit=20&offset=0&status=todo
router.get('/', (req, res) => {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json(store.list({ limit, offset, status }));
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const task = store.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not_found' });
  res.json(task);
});

// POST /api/tasks
router.post('/', (req, res) => {
  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const task = store.create(parsed.data);
  res.status(201).json(task);
});

// PUT/PATCH /api/tasks/:id
// PUT is intentionally lenient here: it applies a partial merge rather than
// requiring a full-resource replacement, so it behaves the same as PATCH.
// Both verbs share this handler for convenience.
router.put('/:id', updateHandler);
router.patch('/:id', updateHandler);

function updateHandler(req, res) {
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const updated = store.update(req.params.id, parsed.data);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
}

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const ok = store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

module.exports = router;
