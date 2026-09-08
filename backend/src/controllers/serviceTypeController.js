const ServiceType = require('../models/ServiceType');

/**
 * GET /api/service-types
 */
exports.getAllServiceTypes = async (req, res, next) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const filter = includeInactive ? {} : { isActive: true };
        const serviceTypes = await ServiceType.find(filter).sort({ name: 1 });
        res.status(200).json({ success: true, count: serviceTypes.length, data: { serviceTypes } });
    } catch (err) { next(err); }
};

/**
 * POST /api/service-types
 */
exports.createServiceType = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'Service type name is required' });
        const serviceType = await ServiceType.create({ name: name.trim(), description: description?.trim() || '' });
        res.status(201).json({ success: true, data: { serviceType } });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'A service type with this name already exists' });
        next(err);
    }
};

/**
 * PUT /api/service-types/:id
 */
exports.updateServiceType = async (req, res, next) => {
    try {
        const { name, description, isActive } = req.body;
        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (description !== undefined) update.description = description.trim();
        if (isActive !== undefined) update.isActive = isActive;

        const serviceType = await ServiceType.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!serviceType) return res.status(404).json({ success: false, message: 'Service type not found' });
        res.status(200).json({ success: true, data: { serviceType } });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'A service type with this name already exists' });
        next(err);
    }
};

/**
 * DELETE /api/service-types/:id
 */
exports.deleteServiceType = async (req, res, next) => {
    try {
        const serviceType = await ServiceType.findByIdAndDelete(req.params.id);
        if (!serviceType) return res.status(404).json({ success: false, message: 'Service type not found' });
        res.status(200).json({ success: true, message: 'Service type deleted successfully' });
    } catch (err) { next(err); }
};

/**
 * PATCH /api/service-types/:id/status
 */
exports.toggleServiceTypeStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body;
        const serviceType = await ServiceType.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true, runValidators: true }
        );
        if (!serviceType) return res.status(404).json({ success: false, message: 'Service type not found' });
        res.status(200).json({ success: true, data: { serviceType } });
    } catch (err) { next(err); }
};
