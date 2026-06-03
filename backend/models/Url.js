const mongoose = require('mongoose');

const UrlSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalUrl: {
    type: String,
    required: [true, 'Please provide the original URL'],
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  customAlias: {
    type: String,
    trim: true,
    default: null
  },
  clicks: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Url', UrlSchema);
