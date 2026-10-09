const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const sharp = require('../node_modules/sharp');
const originalLoad = Module._load;
let uploaded, uploadFailure;
Module._load = function(name, parent, ...rest) {
    if (parent?.filename.endsWith('/offerController.js') && name === '../utils/s3Upload') return { uploadFile: async (file, folder) => { if (uploadFailure) throw new Error('S3 unavailable'); uploaded = { file, folder }; return { key: 'offers/1234-abcd.webp' }; } };
    return originalLoad.call(this, name, parent, ...rest);
};
const controller = require('../src/controllers/offerController');
Module._load = originalLoad;
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
beforeEach(() => { uploaded = null; uploadFailure = false; });
test('processes the image, uploads WebP to S3, and returns the persisted image key', async () => {
    const buffer = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#a7732c' } }).png().toBuffer();
    const res = response();
    await controller.upload({ file: { buffer } }, res, error => { throw error; });
    assert.equal(res.code, 201); assert.equal(res.body.data.image, 'offers/1234-abcd.webp');
    assert.equal(uploaded.folder, 'offers'); assert.equal(uploaded.file.mimetype, 'image/webp');
    const image = await sharp(uploaded.file.buffer).metadata();
    assert.equal(image.format, 'webp'); assert.equal(image.width, 1600); assert.equal(image.height, 800);
});
test('rejects missing and corrupt images before attempting S3 upload', async () => {
    for (const request of [{}, { file: { buffer: Buffer.from('not an image') } }]) {
        let error;
        await controller.upload(request, response(), value => { error = value; });
        assert.equal(error.statusCode, 400); assert.equal(uploaded, null);
    }
});
test('reports failed storage without returning a successful image key', async () => {
    uploadFailure = true;
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();
    let error; const res = response();
    await controller.upload({ file: { buffer } }, res, value => { error = value; });
    assert.equal(error.statusCode, 500); assert.match(error.message, /Unable to upload/); assert.equal(res.body, undefined);
});
