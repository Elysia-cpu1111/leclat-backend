const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, data: null, message: '请填写所有必填字段', error: 'Missing fields' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ success: false, data: null, message: '该邮箱已被注册', error: 'Email exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hashedPassword);

    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, data: { token, user }, message: '注册成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, data: null, message: '请输入邮箱和密码', error: 'Missing fields' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ success: false, data: null, message: '邮箱或密码错误', error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, data: null, message: '邮箱或密码错误', error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userData } = user;

    res.json({ success: true, data: { token, user: userData }, message: '登录成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, avatar, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, data: null, message: '用户不存在', error: 'Not found' });
    }
    res.json({ success: true, data: user, message: '获取成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, avatar, avatar_url } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, data: null, message: '没有要更新的字段', error: 'No fields' });
    }

    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT id, name, email, role, avatar, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, data: user, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: '服务器错误', error: err.message });
  }
});

// POST /api/auth/forgot-password — send reset code
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: '请输入邮箱' });
  
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ success: true, message: '如果该邮箱已注册，验证码已发送' });
  
  // Generate 6-digit code, expire in 10 minutes
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expires);
  
  // In production, send email. For demo, return code directly
  console.log(`Password reset code for ${email}: ${code}`);
  res.json({ success: true, data: { code }, message: `验证码已生成（演示模式直接返回：${code}）` });
});

// POST /api/auth/reset-password — verify code and reset
router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ success: false, message: '请填写完整信息' });
  if (newPassword.length < 6) return res.status(400).json({ success: false, message: '密码至少6位' });
  
  const now = new Date().toISOString();
  const reset = db.prepare('SELECT * FROM password_resets WHERE email = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1').get(email, code, now);
  if (!reset) return res.status(400).json({ success: false, message: '验证码无效或已过期' });
  
  const hashed = require('bcryptjs').hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashed, email);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);
  
  res.json({ success: true, message: '密码重置成功，请登录' });
});

module.exports = router;
