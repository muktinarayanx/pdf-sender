const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT and attach user to request
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid token. User not found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

// Check if user is an admin or uploader
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'uploader') {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
};

// uploaderOnly as alias for backward compatibility
const uploaderOnly = adminOnly;

module.exports = { authMiddleware, uploaderOnly, adminOnly };
