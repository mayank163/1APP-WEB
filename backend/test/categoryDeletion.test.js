const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
let category, services, subcategories, deleted;
const mocks = {
  '../models/Category': { findById: async () => category },
  '../models/SubCategory': { countDocuments: async () => subcategories },
  '../models/Service': { countDocuments: async () => services },
  '../utils/socketInstance': { getIO: () => ({ emit() {} }) },
  '../utils/s3Upload': { deleteFile: async () => { throw new Error('Storage unavailable'); } },
};
const context = { exports: {}, console: { log() {}, warn() {} }, require: name => mocks[name] || {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/categoryController.js'), 'utf8'), context);
async function invoke(serviceCount, subcategoryCount, exists = true) {
  services = serviceCount; subcategories = subcategoryCount; deleted = false;
  category = exists ? { _id: 'category1', image: 'image-key', deleteOne: async () => { deleted = true; } } : null;
  let status, body, failure;
  await context.exports.deleteCategory({ params: { id: 'category1' } }, { status(value) { status = value; return this; }, json(value) { body = value; } }, err => { failure = err; });
  return { status, body, failure };
}
test('empty category is deleted even when image cleanup fails', async () => {
  const response = await invoke(0, 0);
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(deleted, true);
});
test('category with services remains intact', async () => {
  const response = await invoke(2, 0);
  assert.equal(response.status, 409);
  assert.equal(response.body.serviceCount, 2);
  assert.equal(deleted, false);
});
test('category with subcategories remains intact', async () => {
  const response = await invoke(0, 1);
  assert.equal(response.status, 409);
  assert.equal(response.body.subcategoryCount, 1);
  assert.equal(deleted, false);
});
test('missing category returns not found', async () => {
  const response = await invoke(0, 0, false);
  assert.equal(response.status, 404);
  assert.equal(deleted, false);
});
