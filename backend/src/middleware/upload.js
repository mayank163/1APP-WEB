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

const technicianDocumentFilter = (req, file, cb) => {
    const allowed = ['image/', 'application/pdf'];
    const isAllowed = allowed.some(type => file.mimetype.startsWith(type));
    if (isAllowed) return cb(null, true);
    cb(new Error('Only image or PDF files are allowed for technician documents'), false);
};

const uploadTechnicianDocuments = multer({
    storage,
    limits,
    fileFilter: technicianDocumentFilter,
}).fields([
    { name: 'drivingLicenseFront', maxCount: 1 },
    { name: 'drivingLicenseBack', maxCount: 1 },
    { name: 'residentialProof', maxCount: 1 },
    { name: 'taxInformation', maxCount: 1 },
    { name: 'cvResume', maxCount: 1 },
    { name: 'backgroundVerification', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]);

// Single profile image upload for technician signup
const uploadProfileImage = multer({
    storage,
    fileFilter: imageOnly,
    limits,
}).single('profileImage');

module.exports = upload;
module.exports.uploadServiceMedia = uploadServiceMedia;
module.exports.uploadCategoryMedia = uploadCategoryMedia;
module.exports.uploadTechnicianDocuments = uploadTechnicianDocuments;
module.exports.uploadProfileImage = uploadProfileImage;
