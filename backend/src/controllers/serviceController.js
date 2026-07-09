const Service = require('../models/Service');

const POPULATE = [
    { path: 'category', select: 'name image' },
    { path: 'subcategory', select: 'name image category' }
];

const parseJSON = (val, fallback) => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const buildServiceData = (body, files = {}) => {
    // Parse shortDescription - handle both array and string
    let shortDescription = [];
    if (body.shortDescription) {
        if (typeof body.shortDescription === 'string') {
            try {
                shortDescription = JSON.parse(body.shortDescription);
            } catch {
                shortDescription = [body.shortDescription];
            }
        } else if (Array.isArray(body.shortDescription)) {
            shortDescription = body.shortDescription;
        }
    }

    const data = {
        name: body.name,
        shortDescription: shortDescription,
        longDescription: body.longDescription || '',
        category: body.category,
        subcategory: body.subcategory,
        serviceType: body.serviceType || '',
        status: body.status || 'active',
        isFeatured: body.isFeatured === 'true' || body.isFeatured === true,
        serviceDuration: parseFloat(body.serviceDuration) || 0,
        hasVariants: body.hasVariants === 'true' || body.hasVariants === true,
        actualPrice: parseFloat(body.actualPrice) || 0,
        discountPercentage: parseFloat(body.discountPercentage) || 0,
        offerPrice: parseFloat(body.offerPrice) || 0,
        variants: parseJSON(body.variants, []),
        addons: parseJSON(body.addons, []),
        includedItems: parseJSON(body.includedItems, []),
        excludedItems: parseJSON(body.excludedItems, []),
        faqs: parseJSON(body.faqs, []),
        gallery: parseJSON(body.gallery, []),
        requirements: parseJSON(body.requirements, []),
        tools: parseJSON(body.tools, []),
        isActive: true
    };

    // Featured image
    if (files.featuredImage?.[0]) {
        data.featuredImage = files.featuredImage[0].filename;
    } else if (body.featuredImageUrl && !body.featuredImageUrl.startsWith('blob:')) {
        data.featuredImage = body.featuredImageUrl;
    }

    // If clearFeaturedImage is true, remove the image
    if (body.clearFeaturedImage === 'true' || body.clearFeaturedImage === true) {
        data.featuredImage = '';
    }

    // Gallery: merge uploaded files into gallery array by index
    let uploadIdx = 0;
    data.gallery = data.gallery.map(item => {
        if (item.type === 'image' && (!item.url || item.url.startsWith('blob:'))) {
            const file = files.galleryImages?.[uploadIdx++];
            if (file) return { ...item, url: file.filename };
            return null; // no file uploaded for this slot, drop it
        }
        return item;
    }).filter(Boolean);

    // Tools: attach uploaded images by index
    let toolUploadIdx = 0;
    data.tools = data.tools.map(tool => {
        if (!tool.image || tool.image.startsWith('blob:')) {
            const file = files.toolImages?.[toolUploadIdx++];
            if (file) return { ...tool, image: file.filename };
            return { ...tool, image: '' };
        }
        return tool;
    });

    // Requirements: attach uploaded images by index
    let reqUploadIdx = 0;
    data.requirements = data.requirements.map(req => {
        if (!req.image || req.image.startsWith('blob:')) {
            const file = files.requirementImages?.[reqUploadIdx++];
            if (file) return { ...req, image: file.filename };
            return { ...req, image: '' };
        }
        return req;
    });

    return data;
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAllServices = async (req, res, next) => {
    try {
        const { category, subcategory, status, search } = req.query;
        const query = {};
        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;
        if (status) query.status = status;

        let services = await Service.find(query).populate(POPULATE).sort({ createdAt: -1 });

        if (search) {
            const s = search.toLowerCase();
            services = services.filter(sv =>
                sv.name?.toLowerCase().includes(s) ||
                (sv.shortDescription && sv.shortDescription.some(p => p.toLowerCase().includes(s))) ||
                sv.category?.name?.toLowerCase().includes(s)
            );
        }

        res.json({ success: true, count: services.length, data: { services } });
    } catch (err) { next(err); }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────────
exports.getServiceById = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.id).populate(POPULATE);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, data: { service } });
    } catch (err) { next(err); }
};

// ─── GET FEATURED SERVICES (MAX 4) ───────────────────────────────────────────
exports.getFeaturedServices = async (req, res, next) => {
    try {
        const services = await Service.find({
            status: 'active',
            isFeatured: true
        })
        .select('name offerPrice actualPrice rating featuredImage')
        .sort({ createdAt: -1 })
        .limit(4);

        const formattedServices = services.map(service => ({
            id: service._id,
            name: service.name,
            price: service.offerPrice || service.actualPrice,
            rating: service.rating || 0,
            featuredImage: service.featuredImage || ''
        }));

        res.json({
            success: true,
            count: formattedServices.length,
            data: {
                services: formattedServices
            }
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET LATEST 4 SERVICES BY SUBCATEGORY NAME ───────────────────────────────
exports.getServicesBySubcategory = async (req, res, next) => {
    try {
        const { subcategory } = req.params;

        const services = await Service.find({ status: 'active' })
            .populate({
                path: 'subcategory',
                match: { name: subcategory },
                select: 'name'
            })
            .sort({ createdAt: -1 });

        // Keep only services whose populated subcategory matched
        const filteredServices = services
            .filter(service => service.subcategory)
            .slice(0, 4)
            .map(service => ({
                id: service._id,
                name: service.name,
                price: service.offerPrice || service.actualPrice,
                duration: service.serviceDuration,
                featuredImage: service.featuredImage
            }));

        res.json({
            success: true,
            count: filteredServices.length,
            data: {
                services: filteredServices
            }
        });

    } catch (err) {
        next(err);
    }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
exports.createService = async (req, res, next) => {
    try {
        const data = buildServiceData(req.body, req.files || {});
        const service = await Service.create(data);
        await service.populate(POPULATE);
        res.status(201).json({ success: true, data: { service } });
    } catch (err) { 
        console.error('Create service error:', err);
        next(err); 
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
exports.updateService = async (req, res, next) => {
    try {
        const existing = await Service.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Service not found' });

        const data = buildServiceData(req.body, req.files || {});

        // Keep existing featured image if no new one provided and not clearing
        if (!data.featuredImage && !req.body.clearFeaturedImage) {
            data.featuredImage = existing.featuredImage;
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id, 
            data, 
            { new: true, runValidators: true }
        ).populate(POPULATE);
        
        res.json({ success: true, data: { service } });
    } catch (err) { 
        console.error('Update service error:', err);
        next(err); 
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteService = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        service.status = 'inactive';
        service.isActive = false;
        await service.save();
        res.json({ success: true, message: 'Service deactivated' });
    } catch (err) { next(err); }
};

// ─── HIERARCHY (for frontend nav) ─────────────────────────────────────────────
exports.getServiceHierarchy = async (req, res, next) => {
    try {
        const services = await Service.find({ status: 'active' })
            .sort({ createdAt: -1 }) // Latest services first
            .populate(POPULATE);

        const hierarchy = {};

        services.forEach(sv => {
            const cat = sv.category?.name || 'General';
            const sub = sv.subcategory?.name || 'General';

            if (!hierarchy[cat]) hierarchy[cat] = {};
            if (!hierarchy[cat][sub]) hierarchy[cat][sub] = [];

            // Only keep maximum 4 services per subcategory
            if (hierarchy[cat][sub].length < 4) {
                hierarchy[cat][sub].push({
                    id: sv._id,
                    name: sv.name,
                    price: sv.offerPrice || sv.actualPrice,
                    duration: sv.serviceDuration
                });
            }
        });

        res.json({
            success: true,
            data: { hierarchy }
        });

    } catch (err) {
        next(err);
    }
};

// ─── LEGACY: categories endpoint used by old frontend ─────────────────────────
exports.getCategories = async (req, res, next) => {
    try {
        const Category = require('../models/Category');
        const SubCategory = require('../models/SubCategory');
        const [categories, subcategories] = await Promise.all([
            Category.find({ isActive: true }).sort({ name: 1 }),
            SubCategory.find({ isActive: true })
                .populate('category', 'name')
                .sort({ name: 1 })
        ]);
        res.json({ success: true, data: { categories, subcategories } });
    } catch (err) { next(err); }
};