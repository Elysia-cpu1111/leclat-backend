const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// List user addresses
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);
  res.json({ success: true, data: rows });
});

// Add address
router.post('/', (req, res) => {
  const { name, phone, province, city, district, detail, is_default } = req.body;
  if (!name || !phone || !detail) return res.status(400).json({ success: false, message: '请填写完整信息' });
  
  if (is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  const result = db.prepare('INSERT INTO addresses (user_id, name, phone, province, city, district, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.user.id, name, phone, province, city, district, detail, is_default ? 1 : 0);
  res.json({ success: true, data: { id: result.lastInsertRowid }, message: '地址添加成功' });
});

// Update address
router.put('/:id', (req, res) => {
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!addr) return res.status(404).json({ success: false, message: '地址不存在' });
  
  const { name, phone, province, city, district, detail, is_default } = req.body;
  if (is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET name=?, phone=?, province=?, city=?, district=?, detail=?, is_default=? WHERE id=? AND user_id=?').run(name||addr.name, phone||addr.phone, province||addr.province, city||addr.city, district||addr.district, detail||addr.detail, is_default?1:addr.is_default, req.params.id, req.user.id);
  res.json({ success: true, message: '地址更新成功' });
});

// Delete address
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true, message: '地址已删除' });
});

module.exports = router;
