/**
//  * Run once: node backend/src/seeders/makeSuperAdmin.js <email>
//  * Marks an existing admin as isSuperAdmin=true
//  */
// require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
// const mongoose = require('mongoose');
// const Admin = require('../models/Admin');

// const email = process.argv[2];
// if (!email) { console.error('Usage: node makeSuperAdmin.js <email>'); process.exit(1); }

// mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
//     const admin = await Admin.findOne({ email });
//     if (!admin) { console.error('Admin not found:', email); process.exit(1); }
//     admin.isSuperAdmin = true;
//     admin.isActive = true;
//     admin.permissions = [];
//     await admin.save();
//     console.log(`✅ ${email} is now a Super Admin.`);
//     process.exit(0);
// }).catch(err => { console.error(err); process.exit(1); });
