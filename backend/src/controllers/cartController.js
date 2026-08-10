const User = require('../models/User');

/**
 * @desc    Get current user's cart (populated with service details)
 * @route   GET /api/cart
 */
exports.getCart = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('cart.service');
        res.status(200).json({ success: true, data: { cart: user.cart } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Add a service to cart (or increment quantity if already present)
 * @route   POST /api/cart
 * @body    { serviceId, quantity? }
 */
exports.addToCart = async (req, res, next) => {
    try {
        const { serviceId, quantity = 1 } = req.body;
        if (!serviceId) {
            return res.status(400).json({ success: false, message: 'serviceId is required' });
        }

        const user = await User.findById(req.user.id);
        const existing = user.cart.find(i => i.service.toString() === serviceId);

        if (existing) {
            // Item already in cart — return without modifying (mirrors current behaviour)
            await user.populate('cart.service');
            return res.status(200).json({ success: true, duplicate: true, data: { cart: user.cart } });
        }

        user.cart.push({ service: serviceId, quantity: parseInt(quantity) });
        await user.save();
        await user.populate('cart.service');

        res.status(201).json({ success: true, duplicate: false, data: { cart: user.cart } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Update quantity of a cart item
 * @route   PUT /api/cart/:serviceId
 * @body    { quantity }
 */
exports.updateCartItem = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const { quantity } = req.body;
        const qty = parseInt(quantity);

        const user = await User.findById(req.user.id);

        if (qty <= 0) {
            // Remove when quantity drops to 0
            user.cart = user.cart.filter(i => i.service.toString() !== serviceId);
        } else {
            const item = user.cart.find(i => i.service.toString() === serviceId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not in cart' });
            }
            item.quantity = qty;
        }

        await user.save();
        await user.populate('cart.service');

        res.status(200).json({ success: true, data: { cart: user.cart } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Remove a single item from cart
 * @route   DELETE /api/cart/:serviceId
 */
exports.removeFromCart = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const user = await User.findById(req.user.id);

        user.cart = user.cart.filter(i => i.service.toString() !== serviceId);
        await user.save();
        await user.populate('cart.service');

        res.status(200).json({ success: true, data: { cart: user.cart } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 */
exports.clearCart = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        user.cart = [];
        await user.save();

        res.status(200).json({ success: true, data: { cart: [] } });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Merge a guest cart (array of { serviceId, quantity }) into the DB cart
 * @route   POST /api/cart/merge
 * @body    { items: [{ serviceId, quantity }] }
 */
exports.mergeCart = async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            // Nothing to merge — just return current cart
            const user = await User.findById(req.user.id).populate('cart.service');
            return res.status(200).json({ success: true, data: { cart: user.cart } });
        }

        const user = await User.findById(req.user.id);

        for (const { serviceId, quantity } of items) {
            if (!serviceId) continue;
            const already = user.cart.find(i => i.service.toString() === serviceId);
            if (!already) {
                user.cart.push({ service: serviceId, quantity: parseInt(quantity) || 1 });
            }
            // If already in DB cart, keep existing — don't double-add
        }

        await user.save();
        await user.populate('cart.service');

        res.status(200).json({ success: true, data: { cart: user.cart } });
    } catch (err) {
        next(err);
    }
};
