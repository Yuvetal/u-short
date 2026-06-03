const express = require('express');
const router = express.Router();
const Url = require('../models/Url');
const VisitLog = require('../models/VisitLog');

// @route   GET /api/public/urls/:shortCode/stats
// @desc    Retrieve unauthenticated aggregate metrics for a single short code
// @access  Public
router.get('/:shortCode/stats', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const url = await Url.findOne({ shortCode });
    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL resource not found'
      });
    }

    // Check if link has expired
    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).json({
        success: false,
        message: 'Short URL has expired'
      });
    }

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

    res.status(200).json({
      success: true,
      data: {
        totalClicks: url.clicks,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
        shortCode: url.shortCode,
        dailyTrends,
        browserShare: browserAggregation.map(item => ({ browser: item._id, count: item.count })),
        osShare: osAggregation.map(item => ({ os: item._id, count: item.count }))
      }
    });

  } catch (error) {
    console.error(`[Public URLs Stats] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during public stats aggregation'
    });
  }
});

module.exports = router;
