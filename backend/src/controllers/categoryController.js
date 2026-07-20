const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const { uploadFile, deleteFile } = require("../utils/s3Upload");

// ─── CATEGORY ────────────────────────────────────────────────────────────────

exports.getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });
        res.status(200).json({ success: true, count: categories.length, data: { categories } });
    } catch (err) { next(err); }
};

exports.getCategoriesWithRecentSubCategories = async (req, res, next) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });

        const result = await Promise.all(
            categories.map(async (category) => {
                const subcategories = await SubCategory.find({
                    category: category._id,
                    isActive: true
                })
                .select('name image startingFromPrice icon')
                .sort({ createdAt: -1 }) // Latest first
                .limit(4);

                return {
                    id: category._id,
                    name: category.name,
                    image: category.image,
                    icon: category.icon,
                    subcategories
                };
            })
        );

        res.status(200).json({
            success: true,
            count: result.length,
            data: {
                categories: result
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.createCategory = async (req, res, next) => {
    try {
        if (!req.body?.name) return res.status(400).json({ success: false, message: 'Category name is required' });
        console.log('[createCategory] req.body:', req.body);
        console.log('[createCategory] req.file keys:', req.file ? Object.keys(req.file) : 'no file');
        if (req.file) console.log('[createCategory] req.file.location:', req.file.location, '| req.file.key:', req.file.key);
        const data = { name: req.body.name };
        if (req.file) {
            const uploaded = await uploadFile(
                req.file,
                "categories"
            );
            console.log('[createCategory] uploaded result:', uploaded);
            console.log('[createCategory] setting data.image to:', uploaded.key);
            data.image = uploaded.key;
        }
        console.log('[createCategory] final data to save:', data);
        const category = await Category.create(data);
        console.log('[createCategory] saved category.image:', category.image);
        res.status(201).json({ success: true, data: { category } });
    } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
    try {
        const existing = await Category.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });

        const update = {};
        if (req.body.name) update.name = req.body.name;

        if (req.file) {
            // Delete old image from S3 before uploading the new one
            if (existing.image) {
                await deleteFile(existing.image);
            }

            const uploaded = await uploadFile(req.file, "categories");
            update.image = uploaded.key;
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            update,
            { returnDocument: 'after', runValidators: true }
        );
        res.status(200).json({ success: true, data: { category } });
    } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        if (category.image) {
            await deleteFile(category.image);
        }
        category.isActive = false;
        await category.save();
        res.status(200).json({ success: true, message: 'Category deactivated successfully' });
    } catch (err) { next(err); }
};

// ─── SUBCATEGORY ─────────────────────────────────────────────────────────────

exports.getAllSubCategories = async (req, res, next) => {
    try {
        const filter = { isActive: true };
        if (req.query.category) filter.category = req.query.category;
        const subcategories = await SubCategory.find(filter).populate('category', 'name').sort({ name: 1 });
        res.status(200).json({ success: true, count: subcategories.length, data: { subcategories } });
    } catch (err) { next(err); }
};

exports.createSubCategory = async (req, res, next) => {
    try {
        const data = { name: req.body.name, category: req.body.categoryId };
        if (req.files?.image?.[0]) {
            const uploadedImage = await uploadFile(
            req.files.image[0],
            "subcategories"
            );
            data.image = uploadedImage.key;
        }
        if (req.files?.icon?.[0]) {
            const uploadedIcon = await uploadFile(
            req.files.icon[0],
            "subcategories/icons"
            );
            data.icon = uploadedIcon.key;
        };
        if (req.body.startingFromPrice) data.startingFromPrice = parseFloat(req.body.startingFromPrice);
        const created = await SubCategory.create(data);
        const subcategory = await SubCategory.findById(created._id).populate('category', 'name');
        res.status(201).json({ success: true, data: { subcategory } });
    } catch (err) { next(err); }
};

exports.updateSubCategory = async (req, res, next) => {
    try {
        const update = {};
        if (req.body.name) update.name = req.body.name;
        if (req.body.categoryId) update.category = req.body.categoryId;
        if (req.files?.image?.[0]) {
            const uploaded = await uploadFile(
            req.files.image[0],
            "subcategories"
        );

        update.image = uploaded.key;
        }
        if (req.files?.icon?.[0]) {
            const uploaded = await uploadFile(
            req.files.icon[0],
            "subcategories/icons"
            );
            update.icon = uploaded.key;
        }
        if (req.body.startingFromPrice !== undefined) update.startingFromPrice = parseFloat(req.body.startingFromPrice) || 0;
        const subcategory = await SubCategory.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true }).populate('category', 'name');
        if (!subcategory) return res.status(404).json({ success: false, message: 'SubCategory not found' });
        res.status(200).json({ success: true, data: { subcategory } });
    } catch (err) { next(err); }
};

exports.getSubCategoriesByCategory = async (req, res, next) => {
    try {
        const subcategories = await SubCategory.find({ category: req.params.id, isActive: true }).populate('category', 'name').sort({ name: 1 });
        res.status(200).json({ success: true, count: subcategories.length, data: { subcategories } });
    } catch (err) { next(err); }
};

exports.getServicesBySubCategory = async (req, res, next) => {
    try {
        const Service = require('../models/Service');
        const services = await Service.find({ subcategory: req.params.id, isActive: true })
            .populate([{ path: 'category', select: 'name' }, { path: 'subcategory', select: 'name' }])
            .sort({ name: 1 });
        res.status(200).json({ success: true, count: services.length, data: { services } });
    } catch (err) { next(err); }
};

exports.deleteSubCategory = async (req, res, next) => {
    
    try {
        const subcategory = await SubCategory.findByIdAndDelete(req.params.id);
        if (subcategory.icon) {
            await deleteFile(subcategory.icon);
        }
        if (subcategory.image) {
            await deleteFile(subcategory.image);
        }
        if (!subcategory) return res.status(404).json({ success: false, message: 'SubCategory not found' });
        res.status(200).json({ success: true, message: 'SubCategory deleted successfully' });
    } catch (err) { next(err); }
};

exports.toggleSubCategoryStatus = async (req, res, next) => {
    try {
        const subcategory = await SubCategory.findById(req.params.id);
        if (!subcategory) return res.status(404).json({ success: false, message: 'SubCategory not found' });
        subcategory.isActive = req.body.isActive;
        await subcategory.save();
        res.status(200).json({ success: true, data: { subcategory } });
    } catch (err) { next(err); }
};
