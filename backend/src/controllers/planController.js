const Plan = require('../models/Plan');
const PlanPurchase = require('../models/PlanPurchase');
const stripe = require('../config/stripe');
const getCurrency = () => String(process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

const addMonths = (date, months) => {
    const result = new Date(date);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
};

const normalizedPlanData = (input) => ({
    name: String(input.name || '').trim(),
    category: String(input.category || 'Residential').trim(),
    tagline: String(input.tagline || '').trim(),
    description: String(input.description || '').trim(),
    price: Number(input.price),
    durationMonths: Number(input.durationMonths),
    features: (Array.isArray(input.features) ? input.features : String(input.features || '').split('\n'))
        .map(feature => String(feature).trim())
        .filter(Boolean)
        .slice(0, 30),
    isFeatured: Boolean(input.isFeatured),
    isActive: input.isActive !== false
});

const validatePlan = (plan) => {
    if (!plan.name) return 'Plan name is required.';
    if (!['Residential', 'Business'].includes(plan.category)) return 'Category must be Residential or Business.';
    if (!Number.isFinite(plan.price) || plan.price <= 0) return 'Price must be greater than zero.';
    if (!Number.isInteger(plan.durationMonths) || plan.durationMonths < 1 || plan.durationMonths > 120) {
        return 'Duration must be between 1 and 120 whole months.';
    }
    return null;
};

const presentPurchase = (purchase) => {
    const item = purchase.toObject ? purchase.toObject() : { ...purchase };
    if (item.status === 'active' && item.expiresAt && new Date(item.expiresAt) <= new Date()) item.status = 'expired';
    return item;
};

exports.getActivePlans = async (req, res, next) => {
    try {
        const filters = { isActive: true };
        if (req.query.category !== undefined) {
            if (!['Residential', 'Business'].includes(req.query.category)) {
                return res.status(400).json({ success: false, message: 'Category must be Residential or Business.' });
            }
            filters.category = req.query.category;
        }
        if (req.query.durationYears !== undefined) {
            const durationYears = Number(req.query.durationYears);
            if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 10) {
                return res.status(400).json({ success: false, message: 'Duration must be a whole number of years between 1 and 10.' });
            }
            filters.durationMonths = durationYears * 12;
        }

        const plans = await Plan.find(filters).sort({ isFeatured: -1, price: 1, createdAt: -1 });
        const currency = getCurrency();
        res.json({ success: true, count: plans.length, data: { plans: plans.map(plan => ({ ...plan.toObject(), category: plan.category || 'Residential', currency })) } });
    } catch (err) { next(err); }
};

exports.createPurchase = async (req, res, next) => {
    let purchase;
    try {
        if (!stripe) return res.status(503).json({ success: false, message: 'Stripe payments are not configured.' });
        const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
        if (!publishableKey.startsWith('pk_')) {
            return res.status(503).json({ success: false, message: 'Stripe publishable key is not configured.' });
        }

        const plan = await Plan.findOne({ _id: req.body.planId, isActive: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found or no longer available.' });

        const currentPlan = await PlanPurchase.findOne({
            user: req.user._id,
            plan: plan._id,
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        if (currentPlan) {
            return res.status(409).json({ success: false, message: 'This plan is already active on your account.' });
        }

        const currency = getCurrency();
        purchase = new PlanPurchase({
            user: req.user._id,
            plan: plan._id,
            planName: plan.name,
            category: plan.category || 'Residential',
            price: plan.price,
            currency,
            durationMonths: plan.durationMonths,
            features: plan.features,
            status: 'pending'
        });
        await purchase.save();

        const intent = await stripe.paymentIntents.create({
            amount: Math.round(plan.price * 100),
            currency,
            payment_method_types: ['card'],
            metadata: {
                userId: String(req.user._id),
                planId: String(plan._id),
                planPurchaseId: String(purchase._id)
            }
        });

        purchase.paymentIntentId = intent.id;
        await purchase.save();
        return res.status(201).json({
            success: true,
            data: {
                planPurchase: presentPurchase(purchase),
                paymentOrder: {
                    provider: 'stripe',
                    id: intent.id,
                    clientSecret: intent.client_secret,
                    amount: intent.amount,
                    currency: intent.currency,
                    publishableKey
                }
            }
        });
    } catch (err) {
        if (purchase?._id) await PlanPurchase.deleteOne({ _id: purchase._id, status: 'pending', paymentIntentId: '' }).catch(() => {});
        if (err.type === 'StripeAuthenticationError' || err.type === 'StripeConnectionError') return next(err);
        next(err);
    }
};

exports.verifyPurchase = async (req, res, next) => {
    try {
        const { planPurchaseId, stripePaymentIntentId } = req.body;
        if (!planPurchaseId || !stripePaymentIntentId) {
            return res.status(400).json({ success: false, message: 'Plan purchase ID and Stripe PaymentIntent ID are required.' });
        }

        const purchase = await PlanPurchase.findOne({ _id: planPurchaseId, user: req.user._id });
        if (!purchase) return res.status(404).json({ success: false, message: 'Plan purchase not found.' });
        if (purchase.paymentIntentId !== stripePaymentIntentId) {
            return res.status(400).json({ success: false, message: 'Payment does not match this plan purchase.' });
        }
        if (['active', 'expired', 'replaced'].includes(purchase.status)) {
            return res.json({ success: true, message: 'Plan purchase was already verified.', data: { planPurchase: presentPurchase(purchase) } });
        }
        if (!stripe) return res.status(503).json({ success: false, message: 'Stripe is not configured.' });

        const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
        if (
            intent.metadata?.planPurchaseId !== String(purchase._id) ||
            intent.metadata?.userId !== String(req.user._id) ||
            intent.metadata?.planId !== String(purchase.plan)
        ) return res.status(400).json({ success: false, message: 'Payment does not match this plan purchase.' });

        const expectedAmount = Math.round(purchase.price * 100);
        if (
            intent.status !== 'succeeded' || intent.amount !== expectedAmount ||
            intent.amount_received !== expectedAmount || intent.currency !== purchase.currency
        ) return res.status(409).json({ success: false, message: 'Payment is not completed. No plan has been activated.' });

        const now = new Date();
        const expiresAt = addMonths(now, purchase.durationMonths);
        await PlanPurchase.updateMany(
            { user: req.user._id, status: 'active', expiresAt: { $gt: now } },
            { $set: { status: 'replaced', replacedAt: now } }
        );
        purchase.status = 'active';
        purchase.paidAt = now;
        purchase.startsAt = now;
        purchase.expiresAt = expiresAt;
        await purchase.save();

        return res.status(201).json({
            success: true,
            message: 'Payment verified and plan activated.',
            data: { planPurchase: presentPurchase(purchase) }
        });
    } catch (err) { next(err); }
};

exports.getMyPurchases = async (req, res, next) => {
    try {
        const purchases = await PlanPurchase.find({
            user: req.user._id,
            status: 'active',
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).limit(1);
        res.json({ success: true, count: purchases.length, data: { planPurchases: purchases.map(presentPurchase) } });
    } catch (err) { next(err); }
};

exports.getAdminPlans = async (req, res, next) => {
    try {
        const plans = await Plan.find().sort({ createdAt: -1 });
        const currency = getCurrency();
        res.json({ success: true, count: plans.length, data: { plans: plans.map(plan => ({ ...plan.toObject(), category: plan.category || 'Residential', currency })) } });
    } catch (err) { next(err); }
};

exports.createPlan = async (req, res, next) => {
    try {
        const data = normalizedPlanData(req.body);
        const validationError = validatePlan(data);
        if (validationError) return res.status(400).json({ success: false, message: validationError });
        const plan = await Plan.create(data);
        res.status(201).json({ success: true, data: { plan } });
    } catch (err) { next(err); }
};

exports.updatePlan = async (req, res, next) => {
    try {
        const data = normalizedPlanData(req.body);
        const validationError = validatePlan(data);
        if (validationError) return res.status(400).json({ success: false, message: validationError });
        const plan = await Plan.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
        res.json({ success: true, data: { plan } });
    } catch (err) { next(err); }
};

exports.updatePlanStatus = async (req, res, next) => {
    try {
        if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
        const plan = await Plan.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
        res.json({ success: true, data: { plan } });
    } catch (err) { next(err); }
};

exports.getAdminPurchases = async (req, res, next) => {
    try {
        const purchases = await PlanPurchase.find()
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(500);
        res.json({ success: true, count: purchases.length, data: { planPurchases: purchases.map(presentPurchase) } });
    } catch (err) { next(err); }
};