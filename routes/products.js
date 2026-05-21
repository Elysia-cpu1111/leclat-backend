const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/products/categories/list
router.get('/categories/list', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.json({ success: true, data: categories, message: '获取成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, page: p, limit: l } = req.query;
    const page = parseInt(p) || 1;
    const limit = parseInt(l) || 12;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }
    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (minPrice) {
      where.push('p.price >= ?');
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      where.push('p.price <= ?');
      params.push(parseFloat(maxPrice));
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    let orderBy = 'ORDER BY p.created_at DESC';
    switch (sort) {
      case 'price_asc': orderBy = 'ORDER BY p.price ASC'; break;
      case 'price_desc': orderBy = 'ORDER BY p.price DESC'; break;
      case 'newest': orderBy = 'ORDER BY p.created_at DESC'; break;
      case 'name': orderBy = 'ORDER BY p.name ASC'; break;
    }

    const countSql = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;
    const pages = Math.ceil(total / limit);

    const sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const products = db.prepare(sql).all(...params, limit, offset);

    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();

    res.json({
      success: true,
      data: { products, total, page, pages, categories },
      message: '获取成功'
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, data: null, message: '产品不存在', error: 'Not found' });
    }

    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name, u.avatar as user_avatar
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.id);

    const avgRating = db.prepare(`
      SELECT COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating, COUNT(*) as review_count
      FROM reviews WHERE product_id = ?
    `).get(req.params.id);

    res.json({
      success: true,
      data: {
        ...product,
        reviews,
        avg_rating: avgRating.avg_rating,
        review_count: avgRating.review_count
      },
      message: '获取成功'
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

module.exports = router;
