const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/product/:productId — 获取产品评价
router.get('/product/:productId', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name, u.avatar as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.productId);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        ROUND(AVG(rating), 1) as avg_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star1
      FROM reviews
      WHERE product_id = ?
    `).get(req.params.productId);

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          total: stats.total,
          avgRating: stats.avg_rating || 0,
          distribution: {
            star5: stats.star5 || 0,
            star4: stats.star4 || 0,
            star3: stats.star3 || 0,
            star2: stats.star2 || 0,
            star1: stats.star1 || 0,
          }
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取评价失败', error: err.message });
  }
});

// POST /api/reviews — 创建评价（需登录）
router.post('/', authMiddleware, (req, res) => {
  try {
    const { productId, rating, content } = req.body;
    if (!productId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: '请提供有效的评分（1-5）' });
    }

    // 检查产品是否存在
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }

    // 检查是否已评价过
    const existing = db.prepare(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?'
    ).get(req.user.id, productId);
    if (existing) {
      return res.status(400).json({ success: false, message: '您已对该商品发表过评价' });
    }

    const result = db.prepare(
      'INSERT INTO reviews (user_id, product_id, rating, content) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, productId, rating, content || '');

    const review = db.prepare(`
      SELECT r.*, u.name as user_name, u.avatar as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, data: review, message: '评价发表成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: '发表评价失败', error: err.message });
  }
});

module.exports = router;
