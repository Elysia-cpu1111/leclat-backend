const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All cart routes require auth
router.use(authMiddleware);

// GET /api/cart
router.get('/', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT ci.*, p.name as product_name, p.price as product_price, 
             p.image as product_image, p.stock as product_stock
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.id DESC
    `).all(req.user.id);

    const total = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);

    res.json({ success: true, data: { items, total }, message: '获取成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// POST /api/cart
router.post('/', (req, res) => {
  try {
    const { productId, size, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, data: null, message: '请提供产品ID', error: 'Missing productId' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, data: null, message: '产品不存在', error: 'Product not found' });
    }

    const qty = quantity || 1;

    // Check if already in cart
    const existing = db.prepare(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND COALESCE(size, \'\') = ?'
    ).get(req.user.id, productId, size || '');

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(
        req.user.id, productId, size || null, qty
      );
    }

    // Return updated cart
    const items = db.prepare(`
      SELECT ci.*, p.name as product_name, p.price as product_price,
             p.image as product_image, p.stock as product_stock
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.id DESC
    `).all(req.user.id);

    const total = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);

    res.json({ success: true, data: { items, total }, message: '已添加到购物车' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// PUT /api/cart/:id
router.put('/:id', (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, data: null, message: '数量必须大于0', error: 'Invalid quantity' });
    }

    const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ success: false, data: null, message: '购物车项不存在', error: 'Not found' });
    }

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, req.params.id);

    const items = db.prepare(`
      SELECT ci.*, p.name as product_name, p.price as product_price,
             p.image as product_image, p.stock as product_stock
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.id DESC
    `).all(req.user.id);

    const total = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);

    res.json({ success: true, data: { items, total }, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// DELETE /api/cart/:id
router.delete('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ success: false, data: null, message: '购物车项不存在', error: 'Not found' });
    }

    db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);

    const items = db.prepare(`
      SELECT ci.*, p.name as product_name, p.price as product_price,
             p.image as product_image, p.stock as product_stock
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.id DESC
    `).all(req.user.id);

    const total = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);

    res.json({ success: true, data: { items, total }, message: '已从购物车移除' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// DELETE /api/cart (clear all)
router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, data: { items: [], total: 0 }, message: '购物车已清空' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

module.exports = router;
