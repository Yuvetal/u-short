const express = require('express');
const router = express.Router();
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const Url = require('../models/Url');
const VisitLog = require('../models/VisitLog');

// Premium CSS & HTML templates for redirect fallback errors
const getNotFoundHtml = (code) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Not Found - URL Shortener</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0f14;
      --card-bg: rgba(25, 28, 36, 0.4);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #ff4757;
      --text: #f5f6fa;
      --text-muted: #a4b0be;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 10% 20%, rgba(255, 71, 87, 0.1) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(46, 134, 222, 0.1) 0px, transparent 50%);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 48px;
      width: 90%;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    .icon {
      font-size: 72px;
      margin-bottom: 24px;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    h1 { font-size: 32px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px; }
    p { font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      background: rgba(255, 71, 87, 0.15);
      border: 1px solid rgba(255, 71, 87, 0.3);
      color: var(--primary);
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 8px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #ff4757, #ff6b81);
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 8px 16px rgba(255, 71, 87, 0.2);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(255, 71, 87, 0.35);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔍</div>
    <h1>Link Not Found</h1>
    <p>We searched our network but couldn't find a shortened reference matching your code: <br>
      <span class="badge">/${code}</span>
    </p>
    <a href="http://localhost:5173/login" class="btn">Create Your Own Short Links</a>
  </div>
</body>
</html>
`;

const getExpiredHtml = (code) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Expired - URL Shortener</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0f14;
      --card-bg: rgba(25, 28, 36, 0.4);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #ffa502;
      --text: #f5f6fa;
      --text-muted: #a4b0be;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 10% 20%, rgba(255, 165, 2, 0.08) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(46, 134, 222, 0.1) 0px, transparent 50%);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 48px;
      width: 90%;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    .icon {
      font-size: 72px;
      margin-bottom: 24px;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    h1 { font-size: 32px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px; }
    p { font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      background: rgba(255, 165, 2, 0.15);
      border: 1px solid rgba(255, 165, 2, 0.3);
      color: var(--primary);
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 8px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #ffa502, #ff7f50);
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 8px 16px rgba(255, 165, 2, 0.2);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(255, 165, 2, 0.35);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⌛</div>
    <h1>Link Has Expired</h1>
    <p>This shortened link was scheduled with a temporary expiration window which has lapsed: <br>
      <span class="badge">/${code}</span>
    </p>
    <a href="http://localhost:5173/login" class="btn">Create Your Own Short Links</a>
  </div>
</body>
</html>
`;

router.get('/:shortCode', async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    // Skip redirect lookups for reserved system path namespaces or file patterns
    const reservedNames = ['api', 'static', 'assets', 'favicon.ico'];
    if (reservedNames.includes(shortCode.toLowerCase()) || shortCode.includes('.')) {
      return next(); // Bypass redirection and hand over to static resource handlers
    }

    const url = await Url.findOne({ shortCode });
    if (!url) {
      return res.status(404).send(getNotFoundHtml(shortCode));
    }

    // Evaluate URL lifetime validation
    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).send(getExpiredHtml(shortCode));
    }

    // TELEMETRY AGGREGATION: Log analytics completely in background (async non-blocking)
    (async () => {
      try {
        // Increment URL clicks atomically
        await Url.updateOne({ _id: url._id }, { $inc: { clicks: 1 } });

        // Parse visitor system metadata details
        const userAgent = req.headers['user-agent'] || '';
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        const browserName = result.browser.name || 'Unknown Browser';
        const osName = result.os.name || 'Unknown OS';

        // Retrieve visitor client IP address
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes(',')) {
          ip = ip.split(',')[0].trim();
        }
        // Normalize localhost loops to real IP for realistic geo charting demo
        if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1')) {
          ip = '103.241.12.89'; // Realistic Indian public IP
        }

        // Perform IP country geolocation lookup
        let countryName = 'Unknown';
        try {
          const geo = geoip.lookup(ip);
          if (geo && geo.country) {
            countryName = geo.country;
          }
        } catch (geoErr) {
          console.warn(`[Redirection Engine] Telemetry GeoIP skipped: ${geoErr.message}`);
        }

        // Record visit event document in MongoDB
        await VisitLog.create({
          urlId: url._id,
          ipAddress: ip,
          browser: browserName,
          os: osName,
          country: countryName
        });

      } catch (analyticsErr) {
        console.error(`[Redirection Engine] Asynchronous telemetry logging failed: ${analyticsErr.message}`);
      }
    })();

    // SUB-50MS HIGHSPEED REDIRECTION: Return HTTP 302 redirect header instantly!
    return res.redirect(302, url.originalUrl);

  } catch (error) {
    console.error(`[Redirection Engine] Critical runtime interception error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Redirection interceptor error'
    });
  }
});

module.exports = router;
