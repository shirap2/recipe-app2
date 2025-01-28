const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Generate tokens
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '5m',
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '1d',
  });
};

// Register
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    // const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({username});
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: `Invalid credentials password ${password} db password: ${user.password}` });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh Token
const refresh = async (req, res) => {
  try {
    const cookies = req.cookies;
    console.log("Cookies:", cookies);

    if (!cookies?.refreshToken) return res.sendStatus(401); // Unauthorized
    const refreshToken = cookies.refreshToken;

    const foundUser = await User.findOne({ refreshToken }).exec();
    console.log("Found User:", foundUser);
    if (!foundUser) return res.sendStatus(403); // Forbidden

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) {
          console.error("JWT Verification Error:", err.message);
          return res.sendStatus(403); // Forbidden
        }
        console.log("Decoded Token:", decoded);

        if (foundUser._id.toString() !== decoded.userId) {
          console.log("User ID mismatch:", foundUser._id, decoded.userId);
          return res.sendStatus(403); // Forbidden
        }

        const roles = foundUser.roles ? Object.values(foundUser.roles) : [];
        const accessToken = jwt.sign(
          {
            UserInfo: {
              username: foundUser.username,
              roles,
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: '10m' } // Example expiration time
        );

        res.json({ roles, accessToken });
      }
    );
  } catch (error) {
    console.error("Refresh Token Error:", error.message);
    res.sendStatus(500); // Internal Server Error
  }
};



// Logout
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      // Find user and remove refresh token
      const user = await User.findOne({ refreshToken }).exec();
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken',{httpOnly:true,
      sameSite: 'strict',
    });

    // const token = req.headers.authorization?.split(' ')[1];
   
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
//   try {
//     const token = req.headers['authorization']?.split(' ')[1]; // Bearer token
    
//     if (!token) {
//       return res.status(400).json({ message: 'Access token required' });
//     }

//     // Decode the token to extract user ID
//     const decoded = jwt.decode(token);

//     if (!decoded) {
//       return res.status(401).json({ message: 'Invalid token' });
//     }

//     const userId = decoded.userId;

//     // Find the user and remove the refresh token (if applicable)
//     const user = await User.findById(userId);

//     if (user) {
//       user.refreshToken = null; // Remove refresh token
//       await user.save();
//     }

//     // Clear the refresh token cookie (if used)
//     res.clearCookie('refreshToken');
    
//     // Send successful logout response
//     res.json({ message: 'Logged out successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
};