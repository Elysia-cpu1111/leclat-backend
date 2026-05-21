const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get all available coupons
router.get('/available', (req, res) => {
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT c.* FROM coupons c 
    WHERE (c.start_date IS NULL OR c.start_date <= ?) 
    AND (c.end_date IS NULL OR c.end_date >= ?)
    AND c.used_count < c.usage_limit
    ORDER BY c.value DESC
  `).all(now, now);
  res.json({ success: true, data: rows });
});

// Get user's coupons
router.get('/my', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, uc.id as user_coupon_id, uc.used, uc.used_at
    FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id
    WHERE uc.user_id = ? ORDER BY uc.used ASC, c.value DESC
  `).all(req.user.id);
  res.json({ success: true, data: rows });
});

// Claim a coupon
router.post('/claim', authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: '请输入优惠券码' });
  
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code);
  if (!coupon) return res.status(404).json({ success: false, message: '优惠券不存在' });
  if (coupon.used_count >= coupon.usage_limit) return res.status(400).json({ success: false, message: '优惠券已被领完' });
  
  const existing = db.prepare('SELECT * FROM user_coupons WHERE user_id = ? AND coupon_id = ?').get(req.user.id, coupon.id);
  if (existing) return res.status(400).json({ success: false, message: '您已领取过该优惠券' });
  
  db.prepare('INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)').run(req.user.id, coupon.id);
  db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
  
  res.json({ success: true, data: coupon, message: '优惠券领取成功' });
});

// Get applicable coupons for cart total
router.post('/applicable', authMiddleware, (req, res) => {
  const { total } = req.body;
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT c.*, uc.id as user_coupon_id
    FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id
    WHERE uc.user_id = ? AND uc.used = 0
    AND c.min_order <= ?
    AND (c.start_date IS NULL OR c.start_date <= ?)
    AND (c.end_date IS NULL OR c.end_date >= ?)
    ORDER BY 
      CASE WHEN c.type='fixed' THEN c.value ELSE c.value/100.0 * ? END DESC
  `).all(req.user.id, total, now, now, total);
  
  // Calculate discount for each
  const result = rows.map(c => {
    let discount = c.type === 'fixed' ? c.value : Math.floor(total * c.value / 100);
    if (c.max_discount) discount = Math.min(discount, c.max_discount);
    return { ...c, discount };
  });
  
  res.json({ success: true, data: result });
});

module.exports = router;
