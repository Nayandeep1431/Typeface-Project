const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';
  
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not found in environment variables. Using fallback secret.');
  }
  
  return jwt.sign(
    { id: user._id, username: user.username }, 
    secret, 
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }

    // Password length check
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email or username already exists' 
      });
    }

    // Create user
    const user = new User({ username, email, password });
    await user.save();

    // Generate token with error handling
    let token;
    try {
      token = generateToken(user);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate authentication token'
      });
    }
    
    console.log('✅ User registered successfully:', username);
    
    res.status(201).json({ 
      success: true,
      message: 'User registered successfully',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Generate token with error handling
    let token;
    try {
      token = generateToken(user);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate authentication token'
      });
    }
    
    console.log('✅ User logged in successfully:', user.username);
    
    res.json({ 
      success: true,
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};
