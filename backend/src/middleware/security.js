const xss = require('xss');

const clean = (data) => {
    if (typeof data === 'string') {
        return xss(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => clean(item));
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const key in data) {
            sanitized[key] = clean(data[key]);
        }
        return sanitized;
    }
    return data;
};

const xssProtection = (req, res, next) => {
    if (req.body) req.body = clean(req.body);
    if (req.query) req.query = clean(req.query);
    if (req.params) req.params = clean(req.params);
    next();
};

module.exports = {
    xssProtection
};
