const express = require('express');
const router = express.Router();
const Url = require('../models/Url');
const VisitLog = require('../models/VisitLog');
const { protect } = require('../middleware/auth');

// Base62 generator for random unique 6-character short codes
const generateShortCode = (length = 6) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// URL normalization helper (prepends https:// if protocol is missing)
const normalizeUrl = (urlString) => {
  if (!urlString) return '';
  let url = urlString.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
};

// URL validation helper (standard URL pattern check)
const isValidUrl = (urlString) => {
  try {
    const url = new URL(normalizeUrl(urlString));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
};


// @route   POST /api/urls
// @desc    Shorten a long URL
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;

    // Validate original URL presence
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the original URL target'
      });
    }

    const normalizedUrl = normalizeUrl(originalUrl);

    // Validate original URL format
    if (!isValidUrl(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid original URL'
      });
    }

    let finalShortCode;

    // If custom alias is provided
    if (customAlias) {
      const trimmedAlias = customAlias.trim();
      
      // Validate custom alias charset (alphanumeric and hyphens only)
      const aliasRegex = /^[a-zA-Z0-9-]+$/;
      if (!aliasRegex.test(trimmedAlias)) {
        return res.status(400).json({
          success: false,
          message: 'Custom alias must only contain alphanumeric characters and hyphens'
        });
      }

      if (trimmedAlias.length < 3 || trimmedAlias.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Custom alias must be between 3 and 30 characters in length'
        });
      }

      // Check if custom alias conflicts with standard reserved words
      const reservedWords = ['api', 'auth', 'urls', 'static', 'assets', 'favicon.ico', 'public', 'dashboard', 'login', 'signup'];
      if (reservedWords.includes(trimmedAlias.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'This custom alias is a system reserved keyword and cannot be used'
        });
      }

      // Check for alias uniqueness/collision
      const aliasExists = await Url.findOne({ shortCode: trimmedAlias });
      if (aliasExists) {
        return res.status(409).json({
          success: false,
          message: 'This custom alias is already in use by another link'
        });
      }

      finalShortCode = trimmedAlias;
    } else {
      // Auto-generate random unique 6-character Base62 code with a retry loop
      let attempts = 0;
      let isUnique = false;
      while (!isUnique && attempts < 5) {
        finalShortCode = generateShortCode();
        const codeExists = await Url.findOne({ shortCode: finalShortCode });
        if (!codeExists) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({
          success: false,
          message: 'Error generating a unique short code. Please try again'
        });
      }
    }

    // Process expiration date if provided
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expiration date format'
        });
      }
      if (expirationDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be in the future'
        });
      }
    }

    // Insert new URL into database
    const newUrl = await Url.create({
      userId: req.user.id,
      originalUrl: normalizedUrl,
      shortCode: finalShortCode,
      customAlias: customAlias ? finalShortCode : null,
      expiresAt: expirationDate
    });

    res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: newUrl
    });

  } catch (error) {
    console.error(`[URLs POST] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during URL shortening'
    });
  }
});

// @route   POST /api/urls/bulk
// @desc    Bulk shorten multiple URLs (CSV support)
// @access  Private
router.post('/bulk', protect, async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of URLs to shorten'
      });
    }

    if (urls.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Bulk shortening is limited to 100 links per request'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < urls.length; i++) {
      const { originalUrl, customAlias, expiresAt } = urls[i];

      // Validate URL presence
      if (!originalUrl) {
        errors.push({ index: i, error: 'Destination URL is required' });
        continue;
      }

      const normalizedUrl = normalizeUrl(originalUrl);

      // Validate URL format
      if (!isValidUrl(normalizedUrl)) {
        errors.push({ index: i, url: originalUrl, error: 'Invalid URL format' });
        continue;
      }

      let finalShortCode;

      // Handle custom alias
      if (customAlias) {
        const trimmedAlias = customAlias.trim();
        const aliasRegex = /^[a-zA-Z0-9-]+$/;
        
        if (!aliasRegex.test(trimmedAlias) || trimmedAlias.length < 3 || trimmedAlias.length > 30) {
          errors.push({ index: i, url: originalUrl, error: 'Custom alias must be 3-30 alphanumeric characters/hyphens' });
          continue;
        }

        const reservedWords = ['api', 'auth', 'urls', 'static', 'assets', 'favicon.ico', 'public', 'dashboard', 'login', 'signup'];
        if (reservedWords.includes(trimmedAlias.toLowerCase())) {
          errors.push({ index: i, url: originalUrl, error: 'Alias is a reserved keyword' });
          continue;
        }

        const aliasExists = await Url.findOne({ shortCode: trimmedAlias });
        if (aliasExists) {
          errors.push({ index: i, url: originalUrl, error: 'Alias is already in use by another link' });
          continue;
        }

        finalShortCode = trimmedAlias;
      } else {
        // Auto-generate code
        let attempts = 0;
        let isUnique = false;
        while (!isUnique && attempts < 5) {
          finalShortCode = generateShortCode();
          const codeExists = await Url.findOne({ shortCode: finalShortCode });
          if (!codeExists) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          errors.push({ index: i, url: originalUrl, error: 'Failed to generate a unique short code' });
          continue;
        }
      }

      // Handle expiration
      let expirationDate = null;
      if (expiresAt) {
        expirationDate = new Date(expiresAt);
        if (isNaN(expirationDate.getTime())) {
          errors.push({ index: i, url: originalUrl, error: 'Invalid expiration date format' });
          continue;
        }
        if (expirationDate <= new Date()) {
          errors.push({ index: i, url: originalUrl, error: 'Expiration date must be in the future' });
          continue;
        }
      }

      // Create URL document
      const newUrl = await Url.create({
        userId: req.user.id,
        originalUrl: normalizedUrl,
        shortCode: finalShortCode,
        customAlias: customAlias ? finalShortCode : null,
        expiresAt: expirationDate
      });

      results.push(newUrl);
    }

    res.status(201).json({
      success: true,
      message: `Bulk URL processing completed. Created: ${results.length}, Failed: ${errors.length}`,
      data: results,
      errors
    });

  } catch (error) {
    console.error(`[URLs POST bulk] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during bulk URL shortening'
    });
  }
});

// @route   GET /api/urls
// @desc    Fetch catalog of all short links created by the user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const urls = await Url.find({ userId: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: urls.length,
      data: urls
    });
  } catch (error) {
    console.error(`[URLs GET] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered while retrieving URLs'
    });
  }
});

// @route   PATCH /api/urls/:id
// @desc    Edit the original target destination of an active short URL (Bonus Feature)
// @access  Private
router.patch('/:id', protect, async (req, res) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the new target destination URL'
      });
    }

    if (!isValidUrl(originalUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid destination URL (starting with http:// or https://)'
      });
    }

    // Find the URL document
    const url = await Url.findById(req.targetUrlId || req.params.id);
    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL resource not found'
      });
    }

    // Verify ownership boundary
    if (url.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this URL resource'
      });
    }

    // Update field
    url.originalUrl = originalUrl;
    await url.save();

    res.status(200).json({
      success: true,
      message: 'Destination URL updated successfully',
      data: url
    });

  } catch (error) {
    console.error(`[URLs PATCH] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during URL update'
    });
  }
});

// @route   DELETE /api/urls/:id
// @desc    Permanently delete a short link and its click metrics logs
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL resource not found'
      });
    }

    // Verify ownership boundary
    if (url.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this URL resource'
      });
    }

    // Delete URL document
    await Url.deleteOne({ _id: url._id });

    // Asynchronously delete all associated visitor telemetry logs
    VisitLog.deleteMany({ urlId: url._id }).exec();

    res.status(200).json({
      success: true,
      message: 'Short link reference and analytics logs permanently deleted'
    });

  } catch (error) {
    console.error(`[URLs DELETE] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during URL deletion'
    });
  }
});

// @route   GET /api/urls/:id/analytics
// @desc    Retrieve structured visitor analytics for a specific shortened link
// @access  Private
router.get('/:id/analytics', protect, async (req, res) => {
  try {
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL resource not found'
      });
    }

    // Verify ownership boundary
    if (url.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this resource'
      });
    }

    // Fetch the latest 50 raw logs chronologically
    const recentLogs = await VisitLog.find({ urlId: url._id })
      .sort({ timestamp: -1 })
      .limit(50);

    // Get latest visited timestamp
    const latestLog = recentLogs[0] ? recentLogs[0].timestamp : null;

    // Aggregate daily click trends for the last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const trendAggregation = await VisitLog.aggregate([
      {
        $match: {
          urlId: url._id,
          timestamp: { $gte: fourteenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format trend data so every date has a record (even if 0 clicks)
    const dailyTrends = [];
    const trendMap = new Map(trendAggregation.map(item => [item._id, item.count]));
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyTrends.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0
      });
    }

    // Aggregate browser distribution
    const browserAggregation = await VisitLog.aggregate([
      { $match: { urlId: url._id } },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Aggregate operating system distribution
    const osAggregation = await VisitLog.aggregate([
      { $match: { urlId: url._id } },
      { $group: { _id: '$os', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Aggregate country distribution
    const countryAggregation = await VisitLog.aggregate([
      { $match: { urlId: url._id } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalClicks: url.clicks,
        lastVisited: latestLog,
        originalUrl: url.originalUrl,
        shortCode: url.shortCode,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
        recentHistory: recentLogs.map(log => ({
          timestamp: log.timestamp,
          ipAddress: log.ipAddress,
          browser: log.browser,
          os: log.os,
          country: log.country
        })),
        dailyTrends,
        browserShare: browserAggregation.map(item => ({ browser: item._id, count: item.count })),
        osShare: osAggregation.map(item => ({ os: item._id, count: item.count })),
        countryShare: countryAggregation.map(item => ({ country: item._id, count: item.count }))
      }
    });

  } catch (error) {
    console.error(`[URLs Analytics] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during analytics aggregation'
    });
  }
});

// @route   POST /api/urls/bulk-delete
// @desc    Bulk delete multiple shortened links and logs
// @access  Private
router.post('/bulk-delete', protect, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of URL IDs to delete'
      });
    }

    // Delete matching URL documents owned by user
    const deleteResult = await Url.deleteMany({
      _id: { $in: ids },
      userId: req.user.id
    });

    // Delete associated logs
    await VisitLog.deleteMany({ urlId: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} links and their analytics logs.`
    });

  } catch (error) {
    console.error(`[URLs POST bulk-delete] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during bulk deletion'
    });
  }
});

module.exports = router;

