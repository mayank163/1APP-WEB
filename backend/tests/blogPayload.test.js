const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePayload, zonedDate } = require('../src/utils/blogPayload');
const Blog = require('../src/models/Blog');
const base = { title: 'Budget guide', description: 'A useful guide', subcategory: '507f1f77bcf86cd799439011' };
test('drafts can be saved without content, while publish requires content', () => {
    assert.equal(parsePayload({ ...base, isPublished: 'false', contentBlocks: '[]' }).values.isPublished, false);
    assert.throws(() => parsePayload({ ...base, isPublished: 'true', contentBlocks: '[]' }), /Add content/);
});
test('all eight block types and their metadata survive schema serialization', async () => {
    const types = ['text', 'heading', 'image', 'text-image', 'quote', 'bullet-list', 'numbered-list', 'callout'];
    const { values, blocks } = parsePayload({ ...base, contentBlocks: JSON.stringify(types.map(type => ({ type, title: 'Heading', text: 'Content', image: 'blogs/existing.png', altText: 'A lake', caption: 'Lake', attribution: 'Author', items: ['First', 'Second'], calloutType: 'tip' }))), imageAltText: 'Cover', author: 'Admin', isFeatured: 'true', metaTitle: 'Search title', metaDescription: 'Search summary', slug: 'Budget Guide' });
    const doc = new Blog({ ...values, contentBlocks: blocks });
    await doc.validate();
    assert.deepEqual(doc.contentBlocks.map(b => b.type), types);
    assert.equal(doc.contentBlocks[7].calloutType, 'tip');
    assert.deepEqual([...doc.contentBlocks[5].items], ['First', 'Second']);
    assert.equal(doc.slug, 'budget-guide');
    assert.equal(doc.isFeatured, true);
});
test('explicit upload indexes preserve reordered images and image-free blocks', () => {
    const { blocks } = parsePayload({ ...base, contentBlocks: JSON.stringify([{ type: 'text', text: 'No image' }, { type: 'image', imageUploadIndex: 1 }, { type: 'image', imageUploadIndex: 0 }, { type: 'image', image: 'existing.png' }]) }, {}, 2);
    assert.equal(blocks[0].imageUploadIndex, undefined);
    assert.equal(blocks[1].imageUploadIndex, 1);
    assert.equal(blocks[2].imageUploadIndex, 0);
    assert.equal(blocks[3].image, 'existing.png');
    assert.throws(() => parsePayload({ ...base, contentBlocks: '[{"imageUploadIndex":0},{"imageUploadIndex":0}]' }, {}, 2), /upload index/);
});
test('scheduled creation converts IST to UTC and disables immediate publication', () => {
    const { values } = parsePayload({ ...base, isPublished: 'true', publicationLocalTime: '2099-10-10T18:30', publicationTimezone: 'Asia/Kolkata', contentBlocks: '[{"type":"text","text":"Scheduled content"}]' });
    assert.equal(values.scheduledAt.toISOString(), '2099-10-10T13:00:00.000Z');
    assert.equal(values.isPublished, false);
});
test('timezone conversion handles daylight savings and rejects nonexistent local times', () => {
    assert.equal(zonedDate('2099-07-01T12:00', 'America/New_York').toISOString(), '2099-07-01T16:00:00.000Z');
    assert.equal(zonedDate('2099-01-01T12:00', 'America/New_York').toISOString(), '2099-01-01T17:00:00.000Z');
    assert.throws(() => zonedDate('2026-03-08T02:30', 'America/New_York'), /does not exist/);
});
test('validation rejects malformed blocks, invalid dates, unsupported types and overlong metadata', () => {
    for (const body of [{ contentBlocks: '{' }, { contentBlocks: '{}' }, { contentBlocks: '[{"type":"script"}]' }, { scheduledAt: 'invalid' }, { scheduledAt: '2000-01-01' }, { publicationTimezone: 'bad-zone' }, { metaTitle: 'x'.repeat(161) }, { isFeatured: 'yes' }]) assert.throws(() => parsePayload({ ...base, ...body }));
});
test('partial status updates preserve fields and clear scheduled publication when publishing now', () => {
    const existing = { ...base, isPublished: false, isArchived: true, scheduledAt: new Date('2099-10-10'), contentBlocks: [{ type: 'text', text: 'Ready' }], slug: 'budget-guide' };
    const { values, blocks } = parsePayload({ isPublished: 'true', isArchived: 'false', scheduledAt: '' }, existing);
    assert.equal(values.isPublished, true);
    assert.equal(values.scheduledAt, null);
    assert.equal(values.title, undefined);
    assert.equal(blocks, undefined);
});

test('accepts exactly 500 description characters, including multipart CRLF newlines', () => {
    const description = `${'a'.repeat(249)}\n${'b'.repeat(250)}`;
    assert.equal(description.length, 500);
    const multipartDescription = description.replace(/\n/g, '\r\n');
    assert.equal(multipartDescription.length, 501);
    assert.equal(parsePayload({ ...base, description: multipartDescription }).values.description, description);
    assert.equal(parsePayload({ ...base, description: 'x'.repeat(500) }).values.description.length, 500);
    assert.equal(parsePayload({ ...base, description: `  ${description}\r\n ` }).values.description, description);
    assert.throws(() => parsePayload({ ...base, description: `${multipartDescription}x` }), /description must be at most 500/);
});
