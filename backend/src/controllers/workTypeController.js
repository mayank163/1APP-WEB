const WorkType = require('../models/WorkType');

// ─── WORK TYPES ──────────────────────────────────────────────────────────────

/**
 * GET /api/work-types
 * Returns all active work types with their sub-types.
 */
exports.getAllWorkTypes = async (req, res, next) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const filter = includeInactive ? {} : { isActive: true };
        const workTypes = await WorkType.find(filter).sort({ name: 1 });
        res.status(200).json({ success: true, count: workTypes.length, data: { workTypes } });
    } catch (err) { next(err); }
};

/**
 * GET /api/work-types/:id
 */
exports.getWorkTypeById = async (req, res, next) => {
    try {
        const workType = await WorkType.findById(req.params.id);
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });
        res.status(200).json({ success: true, data: { workType } });
    } catch (err) { next(err); }
};

/**
 * POST /api/work-types
 */
exports.createWorkType = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'Work type name is required' });
        const workType = await WorkType.create({ name: name.trim(), description: description?.trim() || '' });
        res.status(201).json({ success: true, data: { workType } });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'A work type with this name already exists' });
        next(err);
    }
};

/**
 * PUT /api/work-types/:id
 */
exports.updateWorkType = async (req, res, next) => {
    try {
        const { name, description, isActive } = req.body;
        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (description !== undefined) update.description = description.trim();
        if (isActive !== undefined) update.isActive = isActive;

        const workType = await WorkType.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });
        res.status(200).json({ success: true, data: { workType } });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'A work type with this name already exists' });
        next(err);
    }
};

/**
 * DELETE /api/work-types/:id
 */
exports.deleteWorkType = async (req, res, next) => {
    try {
        const workType = await WorkType.findByIdAndDelete(req.params.id);
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });
        res.status(200).json({ success: true, message: 'Work type deleted successfully' });
    } catch (err) { next(err); }
};

// ─── SUB-WORK-TYPES ──────────────────────────────────────────────────────────

/**
 * POST /api/work-types/:id/sub-types
 */
exports.addSubType = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'Sub-type name is required' });

        const workType = await WorkType.findById(req.params.id);
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });

        // Prevent duplicates within the same parent
        const exists = workType.subTypes.some(s => s.name.toLowerCase() === name.trim().toLowerCase());
        if (exists) return res.status(400).json({ success: false, message: 'A sub-type with this name already exists in this work type' });

        workType.subTypes.push({ name: name.trim(), description: description?.trim() || '' });
        await workType.save();
        res.status(201).json({ success: true, data: { workType } });
    } catch (err) { next(err); }
};

/**
 * PUT /api/work-types/:id/sub-types/:subId
 */
exports.updateSubType = async (req, res, next) => {
    try {
        const { name, description, isActive } = req.body;
        const workType = await WorkType.findById(req.params.id);
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });

        const subType = workType.subTypes.id(req.params.subId);
        if (!subType) return res.status(404).json({ success: false, message: 'Sub-type not found' });

        if (name !== undefined) subType.name = name.trim();
        if (description !== undefined) subType.description = description.trim();
        if (isActive !== undefined) subType.isActive = isActive;

        await workType.save();
        res.status(200).json({ success: true, data: { workType } });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/work-types/:id/sub-types/:subId
 */
exports.deleteSubType = async (req, res, next) => {
    try {
        const workType = await WorkType.findById(req.params.id);
        if (!workType) return res.status(404).json({ success: false, message: 'Work type not found' });

        const subType = workType.subTypes.id(req.params.subId);
        if (!subType) return res.status(404).json({ success: false, message: 'Sub-type not found' });

        subType.deleteOne();
        await workType.save();
        res.status(200).json({ success: true, message: 'Sub-type deleted successfully', data: { workType } });
    } catch (err) { next(err); }
};
