const User = require('../models/User');
const Service = require('../models/Service');

const resolveCartVariant = (service, variantId) => {
    if (!service.hasVariants) {
        if (variantId) throw Object.assign(new Error('This service does not have variants.'), { statusCode: 400 });
        return null;
    }
    const activeVariants = (service.variants || []).filter(variant => variant.isActive !== false);
    if (!activeVariants.length) {
        if (variantId) throw Object.assign(new Error('This service has no active variants.'), { statusCode: 400 });
        return null;
    }

    const variant = variantId
        ? activeVariants.find(item => String(item._id) === String(variantId))
        : activeVariants[0];
    if (!variant) throw Object.assign(new Error('Select an active variant for this service.'), { statusCode: 400 });
    return variant;
};

const resolveCartAddons = (service, addonIds) => {
    if (addonIds === undefined) return null;
    if (!Array.isArray(addonIds)) throw Object.assign(new Error('Add-ons must be provided as a list.'), { statusCode: 400 });

    const uniqueIds = [...new Set(addonIds.map(String))];
    return uniqueIds.map(addonId => {
        const addon = (service.addons || []).find(item => String(item._id) === addonId && item.isActive !== false);
        if (!addon) throw Object.assign(new Error('One or more selected add-ons are unavailable.'), { statusCode: 400 });
        return { addonId: addon._id, name: addon.name, price: addon.price };
    });
};

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
        const { serviceId, quantity = 1, variantId, addonIds } = req.body;
        if (!serviceId) {
            return res.status(400).json({ success: false, message: 'serviceId is required' });
        }

        const user = await User.findById(req.user.id);
        const service = await Service.findById(serviceId);
        if (!service || !service.isActive) {
            return res.status(404).json({ success: false, message: 'Service not found or inactive.' });
        }
        const variant = resolveCartVariant(service, variantId);
        const selectedAddons = resolveCartAddons(service, addonIds);
        const existing = user.cart.find(i => i.service.toString() === serviceId);

        if (existing) {
            const variantChanged = String(existing.variantId || '') !== String(variant?._id || '');
            const addonsChanged = selectedAddons !== null && JSON.stringify((existing.selectedAddons || []).map(addon => String(addon.addonId))) !== JSON.stringify(selectedAddons.map(addon => String(addon.addonId)));
            if (variantChanged || addonsChanged) {
                existing.variantId = variant?._id || null;
                existing.variantName = variant?.name || '';
                existing.variantPrice = variant ? (variant.offerPrice || variant.actualPrice) : null;
                if (selectedAddons !== null) existing.selectedAddons = selectedAddons;
                await user.save();
                await user.populate('cart.service');
                return res.status(200).json({ success: true, duplicate: false, data: { cart: user.cart } });
            }
            // Item already in cart — return without modifying (mirrors current behaviour)
            await user.populate('cart.service');
            return res.status(200).json({ success: true, duplicate: true, data: { cart: user.cart } });
        }

        user.cart.push({
            service: serviceId,
            quantity: parseInt(quantity),
            variantId: variant?._id || null,
            variantName: variant?.name || '',
            variantPrice: variant ? (variant.offerPrice || variant.actualPrice) : null,
            selectedAddons: selectedAddons || []
        });
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

        for (const { serviceId, quantity, variantId, addonIds } of items) {
            if (!serviceId) continue;
            const already = user.cart.find(i => i.service.toString() === serviceId);
            if (!already) {
                const service = await Service.findById(serviceId);
                if (!service || !service.isActive) continue;
                const variant = resolveCartVariant(service, variantId);
                const selectedAddons = resolveCartAddons(service, addonIds);
                user.cart.push({
                    service: serviceId,
                    quantity: parseInt(quantity) || 1,
                    variantId: variant?._id || null,
                    variantName: variant?.name || '',
                    variantPrice: variant ? (variant.offerPrice || variant.actualPrice) : null,
                    selectedAddons: selectedAddons || []
                });
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
