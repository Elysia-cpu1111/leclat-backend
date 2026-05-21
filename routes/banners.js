const express = require('express');
const { db } = require('../db');
const router = express.Router();

// Get active banners (public)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order ASC').all();
  res.json({ success: true, data: rows });
});

module.exports = router;
