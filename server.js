const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');

const app = express();
const path = require('path');
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const fs = require('fs');

// Serve frontend static files (only if dist/ exists — local dev has it, Render doesn't)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontend = fs.existsSync(frontendDist);
if (hasFrontend) {
  app.use(express.static(frontendDist));
  console.log('Serving frontend from:', frontendDist);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: "L'ÉCLAT API is running" });
});

// SPA fallback: all non-API routes serve index.html (only when frontend exists)
if (hasFrontend) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

// Async start
(async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`✅ L'ÉCLAT API server running on http://localhost:${PORT}`);
  });
})();
