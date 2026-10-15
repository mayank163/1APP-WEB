const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const places = require('../services/googlePlaces');

const router = express.Router();
router.use(protect);
router.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    keyGenerator: req => String(req.user._id),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many address searches. Please try again shortly.' },
}));
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

for (const action of ['autocomplete', 'details']) {
    router.post(`/${action}`, async (req, res) => {
        try {
            const data = await places[action](req.body || {});
            res.json({ success: true, data });
        } catch (error) {
            res.status(error.status || 500).json({
                success: false,
                message: error.status ? error.message : 'Address search is temporarily unavailable.',
            });
        }
    });
}

module.exports = router;
