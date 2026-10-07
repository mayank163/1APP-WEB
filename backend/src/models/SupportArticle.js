const mongoose = require('mongoose');
module.exports = mongoose.model('SupportArticle', new mongoose.Schema({
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    category: { type: String, required: true, maxlength: 80 },
    audience: { type: String, enum: ['all', 'user', 'technician'], default: 'all' },
    published: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }));
