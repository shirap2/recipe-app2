
// const jwt = require('jsonwebtoken');

// const auth = (req, res, next) => {
//     const authHeader = req.headers.authorization || req.headers.Authorization;
//     if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401); // Unauthorized if no Bearer token
//     const token = authHeader.split(' ')[1];
//     console.log(token); // Debugging - log the token

//     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//         if (err) return res.sendStatus(403); // Invalid token
        
//         // Access userId directly (since you only store userId in the token)
//         req.user = decoded.userId; 

//         // If you want to include roles or other data, ensure they are included in your token payload (e.g., `roles`).
//         // If you included roles when generating the token, you would access them like this:
//         // req.roles = decoded.roles;

//         next();
//     });
// };

// module.exports = auth;
const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate and authorize users using JWT.
 */
const auth = (req, res, next) => {
    try {
        // Retrieve the authorization header
        const authHeader = req.headers.authorization || req.headers.Authorization;

        // Check if the authorization header exists and starts with "Bearer "
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }

        // Extract the token from the header
        const token = authHeader.split(' ')[1];
        console.log("Token extracted:",token);

        // Verify the token
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid or expired token' });
            }

            console.log("Decoded token:",decoded);
            // Attach the userId to the request object for further use
            req.user = { id: decoded.userId };

            // Proceed to the next middleware or route handler
            next();
        });
    } catch (error) {
        console.error('Auth middleware error:',error);
        res.status(500).json({ message: 'An internal server error occurred' });
    }
};

module.exports = auth;
