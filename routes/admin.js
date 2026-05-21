const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Admin check middleware
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: '无权限' });
  next();
}
router.use(authMiddleware);
router.use(adminOnly);

// Dashboard stats
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const result = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as revenue FROM orders WHERE date(created_at) = ?').get(today);
  const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get();
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role = ?').get('user');
  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
  const pendingOrders = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status = 'pending'").get();
  
  res.json({ success: true, data: {
    todayOrders: result.cnt, todayRevenue: result.revenue,
    totalOrders: totalOrders.cnt, totalUsers: totalUsers.cnt,
    totalProducts: totalProducts.cnt, pendingOrders: pendingOrders.cnt
  }});
});

// === Product Management ===
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC').all();
  res.json({ success: true, data: rows });
});

router.post('/products', (req, res) => {
  const { name, category_id, price, original_price, description, image, images, specs, stock, badge } = req.body;
  const result = db.prepare('INSERT INTO products (name, category_id, price, original_price, description, image, images, specs, stock, badge) VALUES (?,?,?,?,?,?,?,?,?,?)').run(name, category_id, price, original_price, description, image, images, specs, stock||100, badge);
  res.json({ success: true, data: { id: result.lastInsertRowid }, message: '商品已添加' });
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ success: false, message: '商品不存在' });
  const { name, category_id, price, original_price, description, image, images, specs, stock, badge } = req.body;
  db.prepare('UPDATE products SET name=?,category_id=?,price=?,original_price=?,description=?,image=?,images=?,specs=?,stock=?,badge=? WHERE id=?').run(name||p.name, category_id||p.category_id, price||p.price, original_price||p.original_price, description||p.description, image||p.image, images||p.images, specs||p.specs, stock??p.stock, badge||p.badge, req.params.id);
  res.json({ success: true, message: '商品已更新' });
});

router.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '商品已删除' });
});

// === Order Management ===
router.get('/orders', (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, u.name as user_name, u.email 
    FROM orders o JOIN users u ON o.user_id = u.id 
    ORDER BY o.created_at DESC LIMIT 50
  `).all();
  res.json({ success: true, data: rows });
});

router.put('/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: '无效状态' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true, message: `订单已标记为${status}` });
});

// === Banner Management ===
router.get('/banners', (req, res) => {
  const rows = db.prepare('SELECT * FROM banners ORDER BY sort_order').all();
  res.json({ success: true, data: rows });
});

router.post('/banners', (req, res) => {
  const { image, title, subtitle, link, sort_order } = req.body;
  db.prepare('INSERT INTO banners (image, title, subtitle, link, sort_order) VALUES (?,?,?,?,?)').run(image, title, subtitle, link, sort_order||0);
  res.json({ success: true, message: 'Banner已添加' });
});

router.put('/banners/:id', (req, res) => {
  const { image, title, subtitle, link, active, sort_order } = req.body;
  db.prepare('UPDATE banners SET image=COALESCE(?,image), title=COALESCE(?,title), subtitle=COALESCE(?,subtitle), link=COALESCE(?,link), active=COALESCE(?,active), sort_order=COALESCE(?,sort_order) WHERE id=?').run(image, title, subtitle, link, active, sort_order, req.params.id);
  res.json({ success: true, message: 'Banner已更新' });
});

router.delete('/banners/:id', (req, res) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Banner已删除' });
});

// === Coupon Management ===
router.get('/coupons', (req, res) => {
  const rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
  res.json({ success: true, data: rows });
});

router.post('/coupons', (req, res) => {
  const { code, type, value, min_order, max_discount, usage_limit, start_date, end_date } = req.body;
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, usage_limit, start_date, end_date) VALUES (?,?,?,?,?,?,?,?)').run(code, type||'fixed', value, min_order||0, max_discount, usage_limit||999, start_date, end_date);
  res.json({ success: true, message: '优惠券已创建' });
});

router.delete('/coupons/:id', (req, res) => {
  db.prepare('DELETE FROM user_coupons WHERE coupon_id = ?').run(req.params.id);
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '优惠券已删除' });
});

// === User Management ===
router.get('/users', (req, res) => {
  const rows = db.prepare("SELECT id, name, email, role, avatar, avatar_url, created_at FROM users ORDER BY id DESC").all();
  res.json({ success: true, data: rows });
});

module.exports = router;
