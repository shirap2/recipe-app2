const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async(req, res, next) => {
  // try {
  //   // Get token from header
  //   // const token = req.header('Authorization')?.replace('Bearer ', '');
  //   const authHeader = req.headers.authorization || req.headers.Authorization;
  //   if (!token) {
  //     return res.status(401).json({ message: 'No token, authorization denied' });
  //   }

  //   // Verify token
  //   // const decoded = jwt.verify(
  //   //   token, 
  //   //   process.env.JWT_SECRET || 'fallback_secret'
  //   // );
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   const user = await User.findById(decoded.userId).populate('role');
  //   if (!user) {
  //     return res.status(401).json({ message: 'Invalid token' });
  //   }
  //   // Add user to request object
  //   req.user = decoded;
  //   next();
  // } catch (error) {
  //   res.status(401).json({ message: 'Token is not valid' });
  // }
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
    const token = authHeader.split(' ')[1];
    console.log(token)
    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
            if (err) return res.sendStatus(403); //invalid token
            req.user = decoded.UserInfo.username;
            req.roles = decoded.UserInfo.roles;
            next();
        }
    );

};

module.exports = auth;
