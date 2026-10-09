const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let saved, uploads, listQuery, detailQuery, existing, collision;
class FakeBlog {
    constructor(values = {}) { Object.assign(this, { _id: '507f1f77bcf86cd799439011', contentBlocks: [] }, values); }
    toObject() { return { ...this }; }
    async save() { saved = this; }
    async populate() { return this; }
    static async exists() { return collision; }
    static async findById() { return existing; }
    static async updateMany() { return {}; }
    static find(query) { listQuery = query; return { populate: () => ({ sort: async () => [] }) }; }
    static findOne(query) { detailQuery = query; return { populate: async () => existing }; }
}
Module._load = function(name, parent, ...rest) {
    if (parent?.filename.endsWith('/blogController.js') || parent?.filename.endsWith('/blogPublication.js')) {
        if (name === '../models/Blog') return FakeBlog;
        if (name === '../models/SubCategory') return { exists: async () => true };
        if (name === '../utils/s3Upload') return { uploadFile: async file => { uploads.push(file.name); return { key: `${file.name}.png` }; } };
    }
    return originalLoad.call(this, name, parent, ...rest);
};
const controller = require('../src/controllers/blogController');
Module._load = originalLoad;
const base = { title: 'Guide', description: 'Description', subcategory: '507f1f77bcf86cd799439011' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } });
beforeEach(() => { saved = null; uploads = []; existing = new FakeBlog({ ...base, isPublished: true, slug: 'guide', contentBlocks: [{ type: 'text', text: 'Content' }] }); collision = false; });
const next = err => { throw err; };
test('create persists draft settings, typed blocks and the correctly indexed image', async () => {
    const res = response();
    await controller.createBlog({ body: { ...base, isPublished: 'false', isFeatured: 'true', author: 'Writer', metaTitle: 'Search', contentBlocks: JSON.stringify([{ type: 'text', text: 'Paragraph' }, { type: 'image', imageUploadIndex: 0, altText: 'Cover' }]) }, files: { blockImages: [{ name: 'block' }] }, user: { name: 'Admin' } }, res, next);
    assert.equal(res.statusCode, 201); assert.equal(saved.isFeatured, true); assert.equal(saved.author, 'Writer'); assert.equal(saved.contentBlocks[0].image, null); assert.equal(saved.contentBlocks[1].image, 'block.png'); assert.deepEqual(uploads, ['block']);
});
test('update removes the featured image and preserves all fields on partial status change', async () => {
    existing.featuredImage = 'old.png';
    const res = response();
    await controller.updateBlog({ params: { id: existing._id }, body: { removeFeaturedImage: 'true', isFeatured: 'true' } }, res, next);
    assert.equal(res.statusCode, 200); assert.equal(saved.featuredImage, null); assert.equal(saved.title, 'Guide'); assert.equal(saved.contentBlocks[0].text, 'Content');
});
test('explicit slug collision is rejected before uploading files', async () => {
    collision = true; const res = response();
    await controller.createBlog({ body: { ...base, slug: 'guide', isPublished: 'false' }, files: { featuredImage: [{ name: 'unused' }] } }, res, next);
    assert.equal(res.statusCode, 409); assert.equal(saved, null); assert.deepEqual(uploads, []);
});
test('public lists filter private posts; authenticated admin lists include all states', async () => {
    await controller.getAllBlogs({}, response(), next);
    assert.equal(listQuery.isPublished, true); assert.deepEqual(listQuery.isArchived, { $ne: true });
    await controller.getAllBlogs({ user: { name: 'Admin' } }, response(), next);
    assert.deepEqual(listQuery, {});
});
test('public detail supports slug lookup with publication filters', async () => {
    await controller.getBlogById({ params: { id: 'guide' } }, response(), next);
    assert.equal(detailQuery.slug, 'guide'); assert.equal(detailQuery.isPublished, true);
});
