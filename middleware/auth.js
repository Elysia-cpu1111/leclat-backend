const jwt = require('jsonwebtoken');
JWT_SECRET = process.env.JWT_SECRET || 'leclat_secret_2026';

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        message: '未提供认证令牌',
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      data: null,
      message: '令牌无效或已过期',
      error: err.message
    });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
