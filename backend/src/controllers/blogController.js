const Blog = require('../models/Blog');
const { uploadFile, deleteFile } = require("../utils/s3Upload");

exports.getAllBlogs = async (req, res, next) => {
    try {
        const blogs = await Blog.find()
            .populate({ path: 'subcategory', select: 'name category', populate: { path: 'category', select: 'name' } })
            .sort('-createdAt');
        res.json({ success: true, data: { blogs } });
    } catch (err) {next(err);}
};

exports.getBlogById = async (req, res, next) => {
    try {
        const blog = await Blog.findById(req.params.id)
            .populate({ path: 'subcategory', select: 'name category', populate: { path: 'category', select: 'name' } });
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, data: { blog } });
    } catch (err) { next(err); }
};

exports.createBlog = async (req, res, next) => {
    try {
        const { title, subtitle, description, subcategory, contentBlocks: blocksJson, isPublished, metaTitle, metaDescription } = req.body;

        // Upload featured image to S3
        let featuredImage = null;
        if (req.files?.featuredImage?.[0]) {
            const uploaded = await uploadFile(req.files.featuredImage[0], "blogs/featured");
            featuredImage = uploaded.key;
        }

        let contentBlocks = [];
        if (blocksJson) {
            const parsed = JSON.parse(blocksJson);
            const blockImageFiles = req.files?.blockImages || [];

            let imageIndex = 0;
            contentBlocks = await Promise.all(parsed.map(async (block, i) => {
                let blockImage = block.image;
                if (block.image === null && imageIndex < blockImageFiles.length) {
                    const uploaded = await uploadFile(blockImageFiles[imageIndex], "blogs/blocks");
                    blockImage = uploaded.key;
                    imageIndex++;
                }
                return {
                    title: block.title || '',
                    text: block.text || '',
                    order: block.order ?? i,
                    image: blockImage
                };
            }));
        }

        const blog = await Blog.create({
            title, subtitle: subtitle || '', description, featuredImage, subcategory,
            contentBlocks,
            isPublished: isPublished !== undefined ? isPublished : true,
            metaTitle: metaTitle || '',
            metaDescription: metaDescription || ''
        });

        res.status(201).json({ success: true, data: { blog } });
    } catch (err) { next(err); }
};

exports.updateBlog = async (req, res, next) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

        const { title, subtitle, description, subcategory, contentBlocks: blocksJson, isPublished, metaTitle, metaDescription } = req.body;

        if (title) blog.title = title;
        if (subtitle !== undefined) blog.subtitle = subtitle;
        if (description) blog.description = description;
        if (subcategory) blog.subcategory = subcategory;
        if (isPublished !== undefined) blog.isPublished = isPublished;
        if (metaTitle !== undefined) blog.metaTitle = metaTitle;
        if (metaDescription !== undefined) blog.metaDescription = metaDescription;

        if (req.files?.featuredImage?.[0]) {
            // Delete old featured image from S3 if one exists
            if (blog.featuredImage) {
                await deleteFile(blog.featuredImage);
            }
            const uploaded = await uploadFile(req.files.featuredImage[0], "blogs/featured");
            blog.featuredImage = uploaded.key;
        }

        if (blocksJson) {
            const parsed = JSON.parse(blocksJson);
            const blockImageFiles = req.files?.blockImages || [];

            let imageIndex = 0;
            blog.contentBlocks = await Promise.all(parsed.map(async (block, i) => {
                let blockImage = block.image;
                if (block.image === null && imageIndex < blockImageFiles.length) {
                    const uploaded = await uploadFile(blockImageFiles[imageIndex], "blogs/blocks");
                    blockImage = uploaded.key;
                    imageIndex++;
                }
                return {
                    title: block.title || '',
                    text: block.text || '',
                    order: block.order ?? i,
                    image: blockImage
                };
            }));
        }

        await blog.save();
        res.json({ success: true, data: { blog } });
    } catch (err) { next(err); }
};

exports.deleteBlog = async (req, res, next) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, message: 'Blog deleted' });
    } catch (err) { next(err); }
};
