const multer = require('multer');

const storage = multer.memoryStorage();

const imageOnly = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'), false);
};

const imageOrVideo = (req, file, cb) => {
    const fileName = String(file.originalname || '').toLowerCase();
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || isHeic) return cb(null, true);
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
    { name: 'drivingLicenseFront',    maxCount: 1 },
    { name: 'drivingLicenseBack',     maxCount: 1 },
    { name: 'residentialProof',       maxCount: 1 },
    { name: 'taxInformationW9',       maxCount: 1 },
    { name: 'taxInformation1099',     maxCount: 1 },
    { name: 'cvResume',               maxCount: 1 },
    { name: 'backgroundVerification', maxCount: 1 },
    { name: 'profilePhoto',           maxCount: 1 },
]);

// Single profile image upload for technician signup
const uploadProfileImage = multer({
    storage,
    fileFilter: imageOnly,
    limits,
}).single('profileImage');

// Evidence submitted by a technician while completing a task.
const uploadTaskCompletion = multer({ storage, fileFilter: imageOnly, limits }).fields([
    { name: 'completionImage', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
]);

// Complete profile: certificates (multi), portfolio photos (multi)
const uploadCompleteProfile = multer({
    storage,
    limits,
    fileFilter: technicianDocumentFilter,
}).fields([
    { name: 'certificateImages', maxCount: 10 },
    { name: 'portfolioPhotos',   maxCount: 10 },
]);

// Bank details: blank cheque (single image or PDF)
const uploadBankDetails = multer({
    storage,
    limits,
    fileFilter: technicianDocumentFilter,
}).single('blankCheque');

// Single document re-upload (any field name 'file')
const uploadSingleDocument = multer({
    storage,
    limits,
    fileFilter: technicianDocumentFilter,
}).single('file');

const uploadChatMedia = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: imageOrVideo
}).single('file');

module.exports = upload;
module.exports.uploadServiceMedia = uploadServiceMedia;
module.exports.uploadCategoryMedia = uploadCategoryMedia;
module.exports.uploadTechnicianDocuments = uploadTechnicianDocuments;
module.exports.uploadProfileImage = uploadProfileImage;
module.exports.uploadTaskCompletion = uploadTaskCompletion;
module.exports.uploadCompleteProfile = uploadCompleteProfile;
module.exports.uploadBankDetails = uploadBankDetails;
module.exports.uploadSingleDocument = uploadSingleDocument;
module.exports.uploadChatMedia = uploadChatMedia;

module.exports.uploadAdminTechnicianDocuments = multer({
    storage, limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', ...(file.fieldname === 'profilePhoto' ? [] : ['application/pdf'])];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(Object.assign(new Error('Use JPG, PNG, WebP or PDF documents (photos must be images).'), { statusCode: 400 }));
    },
}).fields(['profilePhoto', 'drivingLicenseFront', 'residentialProof', 'cvResume'].map(name => ({ name, maxCount: 1 })));
