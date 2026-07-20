const multer = require('multer');

const storage = multer.memoryStorage();

const imageOnly = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'), false);
};

const imageOrVideo = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return cb(null, true);
    cb(new Error('Only image or video files are allowed'), false);
};

const limits = { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 }; // 50MB

// Default: single image (categories, subcategories)
const upload = multer({ storage, fileFilter: imageOnly, limits });

// Subcategory/Category: image + icon
const uploadCategoryMedia = multer({ storage, fileFilter: imageOnly, limits }).fields([
    { name: 'image', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]);

// Service: multiple fields
const uploadServiceMedia = multer({ storage, fileFilter: imageOrVideo, limits }).fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 20 },
    { name: 'requirementImages', maxCount: 20 },
    { name: 'toolImages', maxCount: 20 },
    { name: 'processStepImages', maxCount: 20 }
]);

module.exports = upload;
module.exports.uploadServiceMedia = uploadServiceMedia;
module.exports.uploadCategoryMedia = uploadCategoryMedia;
