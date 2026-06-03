const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  let token;

  // Check for JWT token in the Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (split "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'katomaran_secret_jwt_hash_key_2026_secure');

      // Attach decoded user info to request object
      req.user = {
        id: decoded.id,
        email: decoded.email
      };

      return next();
    } catch (error) {
      console.error(`[Auth Middleware] JWT validation failed: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  // Fallback: Check if JWT is set in signed/standard cookies
  if (req.cookies && req.cookies.token) {
    try {
      token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'katomaran_secret_jwt_hash_key_2026_secure');
      req.user = {
        id: decoded.id,
        email: decoded.email
      };
      return next();
    } catch (error) {
      console.error(`[Auth Middleware] Cookie validation failed: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, cookie token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
};

module.exports = { protect };
