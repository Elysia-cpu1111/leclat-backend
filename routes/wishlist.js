const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/wishlist — 获取收藏列表
router.get('/', authMiddleware, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT w.id as wishlist_id, p.*, c.name as category_name
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = ?
      ORDER BY w.id DESC
    `).all(req.user.id);

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取收藏失败', error: err.message });
  }
});

// POST /api/wishlist — 添加收藏
router.post('/', authMiddleware, (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: '请指定商品' });
    }

    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }

    const existing = db.prepare(
      'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?'
    ).get(req.user.id, productId);
    if (existing) {
      return res.json({ success: true, message: '已收藏', data: { inWishlist: true } });
    }

    db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)')
      .run(req.user.id, productId);

    res.json({ success: true, message: '收藏成功', data: { inWishlist: true } });
  } catch (err) {
    res.status(500).json({ success: false, message: '收藏失败', error: err.message });
  }
});

// DELETE /api/wishlist/:productId — 取消收藏
router.delete('/:productId', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?')
      .run(req.user.id, req.params.productId);

    res.json({ success: true, message: '已取消收藏' });
  } catch (err) {
    res.status(500).json({ success: false, message: '取消收藏失败', error: err.message });
  }
});

// GET /api/wishlist/check/:productId — 检查是否收藏
router.get('/check/:productId', authMiddleware, (req, res) => {
  try {
    const item = db.prepare(
      'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?'
    ).get(req.user.id, req.params.productId);

    res.json({ success: true, data: { inWishlist: !!item } });
  } catch (err) {
    res.status(500).json({ success: false, message: '查询失败', error: err.message });
  }
});

module.exports = router;
