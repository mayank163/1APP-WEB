const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const Admin = require('../models/Admin');
const SubCategory = require('../models/SubCategory');
const { uploadFile } = require('../utils/s3Upload');
const { parsePayload, slugify } = require('../utils/blogPayload');
const populate = { path: 'subcategory', select: 'name category', populate: { path: 'category', select: 'name' } };
const { publishDue } = require('../utils/blogPublication');
const handleError = (err, res, next) => {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'This URL slug is already in use. Choose another slug.' });
    if (err.statusCode === 400 || err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ success: false, message: err.message });
    next(err);
};
exports.getAllBlogs = async (req, res, next) => {
    try {
        await publishDue();
        const blogs = await Blog.find(req.user ? {} : { isPublished: true, isArchived: { $ne: true }, $or: [{ scheduledAt: null }, { scheduledAt: { $lte: new Date() } }] }).populate(populate).sort('-createdAt');
        res.json({ success: true, data: { blogs } });
    } catch (err) { handleError(err, res, next); }
};
exports.getBlogById = async (req, res, next) => {
    try {
        await publishDue();
        const query = mongoose.isValidObjectId(req.params.id) ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id };
        if (!req.user) Object.assign(query, { isPublished: true, isArchived: { $ne: true }, $and: [{ $or: [{ scheduledAt: null }, { scheduledAt: { $lte: new Date() } }] }] });
        const blog = await Blog.findOne(query).populate(populate);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, data: { blog } });
    } catch (err) { handleError(err, res, next); }
};
async function saveBlog(req, res, next, create) {
    try {
        const blog = create ? new Blog({ isPublished: false }) : await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        const { values, blocks } = parsePayload(req.body, blog.toObject(), req.files?.blockImages?.length || 0);
        if (values.subcategory && !await SubCategory.exists({ _id: values.subcategory })) return res.status(400).json({ success: false, message: 'Subcategory does not exist' });
        if (values.slug) {
            // Auto-generated slugs receive a suffix; explicit slugs report a collision.
            if (!req.body.slug) {
                const base = slugify(values.slug); let suffix = 1;
                while (await Blog.exists({ slug: values.slug, _id: { $ne: blog._id } })) values.slug = `${base.slice(0, 190)}-${suffix++}`;
            } else if (await Blog.exists({ slug: values.slug, _id: { $ne: blog._id } })) return res.status(409).json({ success: false, message: 'This URL slug is already in use. Choose another slug.' });
        }
        Object.assign(blog, values);
        if (create && !blog.author) blog.author = req.user?.name || 'Admin';
        if (req.files?.featuredImage?.[0]) blog.featuredImage = (await uploadFile(req.files.featuredImage[0], 'blogs/featured')).key;
        else if (req.body.removeFeaturedImage === 'true') blog.featuredImage = null;
        else if (create && req.body.copyFrom) {
            const source = await Blog.findById(req.body.copyFrom);
            if (!source) return res.status(400).json({ success: false, message: 'Source blog does not exist' });
            blog.featuredImage = source.featuredImage;
        }
        if (blocks) {
            blog.contentBlocks = await Promise.all(blocks.map(async block => {
                const { imageUploadIndex, ...data } = block;
                if (imageUploadIndex !== undefined) data.image = (await uploadFile(req.files.blockImages[imageUploadIndex], 'blogs/blocks')).key;
                return data;
            }));
        }
        // Images can be shared by duplicated posts; do not delete S3 objects while saving.
        await blog.save();
        await blog.populate(populate);
        res.status(create ? 201 : 200).json({ success: true, data: { blog } });
    } catch (err) { handleError(err, res, next); }
}
exports.createBlog = (req, res, next) => saveBlog(req, res, next, true);
exports.updateBlog = (req, res, next) => saveBlog(req, res, next, false);
exports.deleteBlog = async (req, res, next) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, message: 'Blog deleted' });
    } catch (err) { handleError(err, res, next); }
};

exports.getAuthors = async (req, res, next) => {
    try {
        const authors = await Admin.find({ isActive: true }).select('name').sort('name');
        res.json({ success: true, data: { authors } });
    } catch (err) { next(err); }
};
