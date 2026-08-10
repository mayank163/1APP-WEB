const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

// All cart routes require authentication
router.use(protect);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.post('/merge', cartController.mergeCart);
router.put('/:serviceId', cartController.updateCartItem);
router.delete('/:serviceId', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

module.exports = router;
