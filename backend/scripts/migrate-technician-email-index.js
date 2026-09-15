// Run once before allowing technicians without email addresses.
// Schedule this with registration writes paused: MongoDB cannot change sparse in place.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function migrate() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const users = mongoose.connection.collection('users');
    const indexes = await users.indexes();
    const emailIndex = indexes.find(index => index.key.email === 1 && Object.keys(index.key).length === 1);
    if (emailIndex?.unique && emailIndex?.sparse) {
      console.log('Email index already allows omitted email addresses.');
      return;
    }
    if (await users.countDocuments({ email: { $exists: true, $in: ['', null] } })) {
      throw new Error('Resolve existing blank/null email fields first; optional emails must be omitted, not blank or null.');
    }
    if (emailIndex) await users.dropIndex(emailIndex.name);
    await users.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });
    console.log('Updated email_1 to unique + sparse.');
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
