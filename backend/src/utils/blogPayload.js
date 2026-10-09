const TYPES = ['text', 'heading', 'image', 'text-image', 'quote', 'bullet-list', 'numbered-list', 'callout'];
const fail = message => { const err = new Error(message); err.statusCode = 400; throw err; };
const bool = value => value === true || value === 'true';
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Resolve wall-clock publication time in its selected IANA zone, including DST.
function zonedDate(value, timezone) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) fail('Invalid publication date and time');
    const target = new Date(`${value}:00Z`);
    if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 16) !== value) fail('Invalid publication date and time');
    let formatter;
    try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { fail('Invalid publication timezone'); }
    const wall = date => { const p = formatter.formatToParts(date); const get = k => p.find(v => v.type === k).value; return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`; };
    let result = target;
    for (let i = 0; i < 3; i++) result = new Date(result.getTime() + target.getTime() - new Date(`${wall(result)}:00Z`).getTime());
    if (wall(result) !== value) fail('This local time does not exist in the selected timezone');
    return result;
}

function parsePayload(body, existing = {}, fileCount = 0) {
    const values = {};
    const limits = { title: 200, subtitle: 300, description: 500, imageAltText: 200, author: 100, metaTitle: 160, metaDescription: 320 };
    for (const [key, max] of Object.entries(limits)) {
        if (body[key] === undefined) continue;
        if (typeof body[key] !== 'string') fail(`${key} must be text`);
        // Multipart forms can encode textarea line breaks as CRLF. Count them
        // as one newline, just as the textarea and its character counter do.
        const value = body[key].replace(/\r\n?/g, '\n').trim();
        if (value.length > max) fail(`${key} must be at most ${max} characters`);
        values[key] = value;
    }
    if (body.subcategory !== undefined) values.subcategory = body.subcategory;
    for (const key of ['isPublished', 'isFeatured', 'isArchived']) {
        if (body[key] === undefined) continue;
        if (![true, false, 'true', 'false'].includes(body[key])) fail(`Invalid ${key}`);
        values[key] = bool(body[key]);
    }
    if (body.publicationTimezone !== undefined) {
        try { new Intl.DateTimeFormat('en', { timeZone: body.publicationTimezone }); } catch { fail('Invalid publication timezone'); }
        values.publicationTimezone = body.publicationTimezone;
    }
    if (body.publicationLocalTime) values.scheduledAt = zonedDate(body.publicationLocalTime, values.publicationTimezone || existing.publicationTimezone || 'Asia/Kolkata');
    else if (body.scheduledAt !== undefined) {
        values.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
        if (values.scheduledAt && Number.isNaN(values.scheduledAt.getTime())) fail('Invalid publication date');
    }
    if (values.scheduledAt && values.scheduledAt <= new Date()) fail('Publication date must be in the future');
    if ((values.isArchived ?? existing.isArchived) || (values.scheduledAt ?? (body.scheduledAt === '' ? null : existing.scheduledAt)) > new Date()) values.isPublished = false;
    if (body.slug !== undefined || !existing.slug) {
        if (typeof (body.slug || body.title || existing.title) !== 'string') fail('Invalid URL slug');
        values.slug = slugify(body.slug || body.title || existing.title);
        if (!values.slug || values.slug.length > 200) fail('URL slug must contain letters or numbers and be at most 200 characters');
    }
    let blocks;
    if (body.contentBlocks !== undefined) {
        try { blocks = typeof body.contentBlocks === 'string' ? JSON.parse(body.contentBlocks) : body.contentBlocks; } catch { fail('Invalid content blocks JSON'); }
        if (!Array.isArray(blocks) || blocks.length > 100) fail('Provide at most 100 content blocks');
        const used = new Set();
        blocks = blocks.map((block, order) => {
            if (!block || typeof block !== 'object') fail('Invalid content block');
            const type = block.type || 'text-image';
            if (!TYPES.includes(type)) fail('Unsupported content block type');
            const data = { type, order };
            for (const [key, max] of Object.entries({ title: 200, text: 50000, altText: 200, caption: 500, attribution: 200 })) {
                if (block[key] !== undefined && (typeof block[key] !== 'string' || block[key].length > max)) fail(`Invalid block ${key}`);
                data[key] = block[key] || '';
            }
            data.calloutType = block.calloutType || 'note';
            if (!['note', 'tip', 'warning'].includes(data.calloutType)) fail('Invalid callout type');
            data.items = block.items || [];
            if (!Array.isArray(data.items) || data.items.length > 1000 || data.items.some(item => typeof item !== 'string' || item.length > 5000)) fail('Invalid list items');
            data.image = typeof block.image === 'string' ? block.image : null;
            if (block.imageUploadIndex !== undefined) {
                const index = block.imageUploadIndex;
                if (!Number.isInteger(index) || index < 0 || index >= fileCount || used.has(index)) fail('Invalid block image upload index');
                used.add(index); data.imageUploadIndex = index;
            }
            return data;
        });
        // Old clients did not send explicit upload indexes. Map in order for compatibility.
        let next = 0;
        if (fileCount && !used.size) blocks.forEach(block => { if (!block.image && next < fileCount) { block.imageUploadIndex = next++; used.add(block.imageUploadIndex); } });
        if (used.size !== fileCount) fail('Every uploaded block image must belong to a content block');
    } else if (fileCount) fail('Content blocks are required with block images');
    const merged = { ...existing, ...values };
    if (!merged.title || !merged.description || !merged.subcategory) fail('Title, description and subcategory are required');
    if ((merged.isPublished || merged.scheduledAt) && !(blocks || existing.contentBlocks || []).some(b => b.title?.trim() || b.text?.trim() || b.image || b.imageUploadIndex !== undefined || b.items?.some(Boolean))) fail('Add content before publishing');
    return { values, blocks };
}
module.exports = { parsePayload, zonedDate, slugify };
