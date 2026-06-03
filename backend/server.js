const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Pre-warm geoip-lite database into RAM to eliminate cold-start redirect delay
try { require('geoip-lite').lookup('8.8.8.8'); } catch(e) {}

// Establish Mongoose Database Connection
connectDB();

const app = express();

// Enable CORS configurations with origin rules
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiting configurations (Defense in depth)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

// Strict authentication limits (15 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Redirection capacity limits (200 requests per minute)
const redirectLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many redirection requests. Please slow down.'
});

// Register routers
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/urls', apiLimiter, require('./routes/urls'));
app.use('/api/public/urls', apiLimiter, require('./routes/public'));

// Wildcard redirection engine interceptor registered LAST
app.use('/', redirectLimiter, require('./routes/redirect'));

// Configure server port listener
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`[Server] URL Shortener API engine running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (err, promise) => {
  console.error(`[Server Crash Safe] Unhandled Rejection: ${err.message}`);
  // Close server and exit process
  // server.close(() => process.exit(1));
});
