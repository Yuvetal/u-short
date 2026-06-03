const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to generate JWT Token
const generateToken = (id, email) => {
  return jwt.sign(
    { id, email },
    process.env.JWT_SECRET || 'katomaran_secret_jwt_hash_key_2026_secure',
    { expiresIn: '30d' }
  );
};

// @route   POST /api/auth/signup
// @desc    Register a new user profile
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for missing inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters in length'
      });
    }

    // Check if email format is standard
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email format'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists'
      });
    }

    // Hash the password with Bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the User profile
    const newUser = await User.create({
      email,
      password: hashedPassword
    });

    // Generate JWT Token
    const token = generateToken(newUser._id, newUser.email);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error(`[Auth Signup] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & retrieve token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for missing inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials provided'
      });
    }

    // Compare credentials via Bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials provided'
      });
    }

    // Generate JWT Token
    const token = generateToken(user._id, user.email);

    res.status(200).json({
      success: true,
      message: 'Authenticated successfully',
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });

  } catch (error) {
    console.error(`[Auth Login] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error encountered during authentication'
    });
  }
});

module.exports = router;
