const database = require('../config/database');

const dbMiddleware = (req, res, next) => {
    req.db = database;
    next();
};

module.exports = dbMiddleware;