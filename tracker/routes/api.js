const express = require('express');
const items = require('../lib/items');

const router = express.Router();

// GET /api/items → all items (active first, then completed)
router.get('/items', (req, res) => {
  res.json({ items: items.list(), stats: items.stats() });
});

// GET /api/stats → live counts + amount rollup
router.get('/stats', (req, res) => {
  res.json(items.stats());
});

// POST /api/items { title, note?, amount? }
router.post('/items', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const item = items.add({ title, note: req.body.note, amount: req.body.amount });
  res.status(201).json({ item, stats: items.stats() });
});

// PATCH /api/items/:id { title?, note?, amount?, done? }
router.patch('/items/:id', (req, res) => {
  const item = items.update(req.params.id, req.body || {});
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json({ item, stats: items.stats() });
});

// DELETE /api/items/:id
router.delete('/items/:id', (req, res) => {
  const ok = items.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, stats: items.stats() });
});

module.exports = router;
