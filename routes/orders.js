const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/orders — 创建订单
router.post('/', authMiddleware, (req, res) => {
  try {
    const { address, paymentMethod, items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: '订单商品不能为空' });
    }

    const orderNo = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    let total = 0;
    const orderItems = [];

    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

    for (const item of items) {
      const product = getProduct.get(item.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `商品 ${item.productId} 不存在` });
      }
      const qty = item.quantity || 1;
      if (product.stock < qty) {
        return res.status(400).json({ success: false, message: `「${product.name}」库存不足` });
      }
      const subtotal = product.price * qty;
      total += subtotal;
      orderItems.push({
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        size: item.size || '均码',
        price: product.price,
        quantity: qty
      });
    }

    const insertOrder = db.prepare(
      'INSERT INTO orders (user_id, order_no, status, total, address, payment_method) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, product_image, size, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const createOrder = db.transaction(() => {
      const result = insertOrder.run(req.user.id, orderNo, 'pending', total, address || '', paymentMethod || '在线支付');

      for (const oi of orderItems) {
        insertItem.run(result.lastInsertRowid, oi.productId, oi.productName, oi.productImage, oi.size, oi.price, oi.quantity);
        updateStock.run(oi.quantity, oi.productId, oi.quantity);
      }

      return result.lastInsertRowid;
    });

    const orderId = createOrder();

    // 清空购物车中已下单的商品
    const deleteCartItems = db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?');
    for (const item of items) {
      deleteCartItems.run(req.user.id, item.productId, item.size || '均码');
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItemsList = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.json({
      success: true,
      data: { ...order, items: orderItemsList },
      message: '订单创建成功'
    });
  } catch (err) {
    console.error('创建订单错误:', err);
    res.status(500).json({ success: false, message: '创建订单失败', error: err.message });
  }
});

// GET /api/orders — 用户订单列表
router.get('/', authMiddleware, (req, res) => {
  try {
    const orders = db.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);

    // 为每个订单附加商品列表
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const result = orders.map(order => ({
      ...order,
      items: getItems.all(order.id)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取订单失败', error: err.message });
  }
});

// GET /api/orders/:id — 订单详情
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const order = db.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取订单详情失败', error: err.message });
  }
});

module.exports = router;
