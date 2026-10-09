import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiLayers, FiPlus, FiCopy, FiTrash2, FiChevronUp, FiChevronDown, FiImage, FiSettings, FiSearch, FiFilePlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import { getImageUrl } from '../utils/helpers';
import '../styles/BlogEditor.css';

export const BLOCK_TYPES = [['text', 'Text', 'Standard paragraph content'], ['heading', 'Heading', 'Section heading'], ['image', 'Image', 'Full-width image with caption'], ['text-image', 'Text + Image', 'Image and text together'], ['quote', 'Quote', 'Highlighted quotation'], ['bullet-list', 'Bullet List', 'Unordered list'], ['numbered-list', 'Numbered List', 'Ordered steps'], ['callout', 'Callout', 'Important note or tip']];
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const localDateTime = (value, zone) => {
    if (!value) return { date: '', time: '' };
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const get = type => parts.find(p => p.type === type)?.value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};
export function BlogBlock({ block }) {
    const image = block.image && <figure><img src={getImageUrl(block.image)} alt={block.altText || ''} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    const items = block.items?.length ? block.items : (block.text || '').split('\n').filter(Boolean);
    if (block.type === 'heading') return <h2>{block.title || block.text}</h2>;
    if (block.type === 'quote') return <blockquote>{block.text}{block.attribution && <cite>— {block.attribution}</cite>}</blockquote>;
    if (block.type === 'bullet-list' || block.type === 'numbered-list') { const List = block.type === 'numbered-list' ? 'ol' : 'ul'; return <section>{block.title && <h3>{block.title}</h3>}<List>{items.map((item, i) => <li key={i}>{item}</li>)}</List></section>; }
    if (block.type === 'callout') return <aside className={`be-callout ${block.calloutType || 'note'}`}><strong>{block.calloutType || 'Note'}</strong><p>{block.text}</p></aside>;
    return <section>{block.title && <h3>{block.title}</h3>}{image}{block.type !== 'image' && <p>{block.text}</p>}</section>;
}

export default function BlogEditor({ blog, duplicate = false, readOnly = false, categories, subcategories, onClose, onSaved }) {
    const admin = (() => { try { return JSON.parse(localStorage.getItem('1app_admin_info') || '{}'); } catch { return {}; } })();
    const [form, setForm] = useState(() => ({ title: duplicate ? `${blog.title} (Copy)` : blog?.title || '', subtitle: blog?.subtitle || '', description: blog?.description || '', category: blog?.subcategory?.category?._id || '', subcategory: blog?.subcategory?._id || '', imageAltText: blog?.imageAltText || '', isFeatured: blog?.isFeatured || false, author: blog?.author || admin.name || 'Admin', metaTitle: blog?.metaTitle || '', metaDescription: blog?.metaDescription || '', slug: duplicate ? '' : blog?.slug || '', publication: duplicate ? 'draft' : blog?.scheduledAt ? 'schedule' : blog?.isPublished ? 'publish' : 'draft', timezone: blog?.publicationTimezone || 'Asia/Kolkata' }));
    const [authors, setAuthors] = useState([]);
    useEffect(() => { let active = true; if (adminApi.getBlogAuthors) adminApi.getBlogAuthors().then(res => { if (active && res.success) setAuthors(res.data.authors); }).catch(() => {}); return () => { active = false; }; }, []);
    const [blocks, setBlocks] = useState(() => (blog?.contentBlocks || []).map(b => ({ ...b, type: b.type || 'text-image', imagePreview: b.image ? getImageUrl(b.image) : '' })));
    const [featured, setFeatured] = useState({ image: blog?.featuredImage || '', preview: blog?.featuredImage ? getImageUrl(blog.featuredImage) : '', file: null });
    const [schedule, setSchedule] = useState(() => localDateTime(blog?.scheduledAt, blog?.publicationTimezone || 'Asia/Kolkata'));
    const [menu, setMenu] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const urls = useRef([]);
    const scheduleRef = useRef(null);
    useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
    const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const changeBlock = (index, key, value) => setBlocks(prev => prev.map((b, i) => i === index ? { ...b, [key]: value } : b));
    const chooseImage = (file, index) => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error('Choose a PNG, JPG or WebP image under 5MB'); return; }
        const preview = URL.createObjectURL(file); urls.current.push(preview);
        if (index === undefined) setFeatured({ file, preview, image: '' });
        else setBlocks(prev => prev.map((b, i) => i === index ? { ...b, imageFile: file, imagePreview: preview, image: null } : b));
    };
    const move = (index, direction) => setBlocks(prev => { const next = [...prev]; const target = index + direction; if (target < 0 || target >= next.length) return prev; [next[index], next[target]] = [next[target], next[index]]; return next; });
    const save = async (mode = form.publication) => {
        if (!form.title.trim() || !form.description.trim() || !form.subcategory) { toast.error('Enter a title, description, category and subcategory'); return; }
        if (mode !== 'draft' && !blocks.some(b => b.title?.trim() || b.text?.trim() || b.image || b.imageFile || b.items?.some(Boolean))) { toast.error('Add content before publishing'); return; }
        if (mode === 'schedule' && (!schedule.date || !schedule.time)) { change('publication', 'schedule'); scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast.error('Choose a publication date and time'); return; }
        setBusy(true);
        try {
            const fd = new FormData();
            ['title', 'subtitle', 'description', 'imageAltText', 'author', 'metaTitle', 'metaDescription'].forEach(key => fd.append(key, form[key].trim()));
            fd.append('subcategory', form.subcategory);
            fd.append('slug', form.slug);
            fd.append('isFeatured', form.isFeatured);
            fd.append('isPublished', mode === 'publish');
            fd.append('isArchived', false);
            fd.append('publicationTimezone', form.timezone);
            fd.append('scheduledAt', '');
            if (mode === 'schedule') fd.append('publicationLocalTime', `${schedule.date}T${schedule.time}`);
            if (featured.file) fd.append('featuredImage', featured.file);
            else if (!featured.image) fd.append('removeFeaturedImage', 'true');
            else if (duplicate) fd.append('copyFrom', blog._id);
            let imageIndex = 0;
            fd.append('contentBlocks', JSON.stringify(blocks.map((b, order) => {
                const { imageFile, imagePreview, collapsed, ...data } = b;
                if (imageFile) fd.append('blockImages', imageFile);
                return { ...data, order, image: imageFile ? null : b.image || null, imageUploadIndex: imageFile ? imageIndex++ : undefined, items: ['bullet-list', 'numbered-list'].includes(b.type) ? (b.text || '').split('\n').filter(line => line.trim()) : [] };
            })));
            const res = blog?._id && !duplicate ? await adminApi.updateBlog(blog._id, fd) : await adminApi.createBlog(fd);
            if (!res.success) throw new Error(res.message || 'Unable to save blog');
            toast.success(mode === 'draft' ? 'Draft saved' : mode === 'schedule' ? 'Blog scheduled' : 'Blog published');
            onSaved();
        } catch (err) { toast.error(err.response?.data?.message || err.message || 'Unable to save blog'); }
        finally { setBusy(false); }
    };
    const field = (key, label, max, placeholder, textarea = false) => <label className="be-field">{label}<span className="be-input-wrap">{textarea ? <textarea value={form[key]} maxLength={max} placeholder={placeholder} onChange={e => change(key, e.target.value)} /> : <input value={form[key]} maxLength={max} placeholder={placeholder} onChange={e => change(key, e.target.value)} />}</span>{max && <small className="be-counter">{form[key].length}/{max}</small>}</label>;
    return <div className="blog-editor"><form onSubmit={e => { e.preventDefault(); save(); }}>
        <fieldset disabled={busy || readOnly} className="be-grid"><div className="be-main">
            <section className="be-panel"><header><h2>{readOnly ? 'View Blog Post' : blog && !duplicate ? 'Edit Blog Post' : 'Create New Blog Post'}</h2>{!readOnly && <button type="button" aria-label="Close editor" onClick={onClose}><FiX /></button>}</header><div className="be-panel-body"><div className="be-progress" /><h3 className="be-section-title"><span>1</span>Basic Information</h3>
                {field('title', <>Blog Title <em>*</em></>, 200, 'Enter an engaging blog title...')}
                {field('subtitle', <>Subtitle <small>(Optional)</small></>, 300, 'A short supporting line under the title...')}
                {field('description', <>Short Description <em>*</em></>, 500, 'Write a compelling description that summarizes your blog post...', true)}
                <div className="be-category-row"><label className="be-field">Category <em>*</em><select value={form.category} onChange={e => { change('category', e.target.value); change('subcategory', ''); }}><option value="">Select category</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label><label className="be-field">Subcategory <em>*</em><select value={form.subcategory} disabled={!form.category || readOnly || busy} onChange={e => change('subcategory', e.target.value)}><option value="">Select subcategory</option>{subcategories.filter(s => (s.category?._id || s.category) === form.category).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label></div>
            </div>{!readOnly && <footer><button type="button" onClick={() => save()}>Save</button></footer>}</section>
            <section className="be-panel be-content"><header><div className="be-section-heading"><FiLayers /><div><h2>Content Blocks</h2><p>Build the article from reorderable blocks.</p></div></div><span className="be-count">{blocks.length} blocks</span></header><div className="be-panel-body">
                {!blocks.length && <div className="be-empty"><FiFilePlus /><strong>Start writing your blog</strong><p>Add a content block to begin building your article.</p>{!readOnly && <button type="button" onClick={() => setMenu(!menu)}><FiPlus /> Add First Block</button>}</div>}
                {readOnly ? <article className="be-article">{blocks.map((b, i) => <BlogBlock key={i} block={b} />)}</article> : blocks.map((b, i) => <div className="be-block" key={i}><div className="be-block-header"><strong>⠿ &nbsp; Block {i + 1}</strong><span>{BLOCK_TYPES.find(t => t[0] === b.type)?.[1] || 'Text + Image'}</span><div><button type="button" aria-label={`Collapse block ${i + 1}`} onClick={() => changeBlock(i, 'collapsed', !b.collapsed)}><FiChevronUp /></button><button type="button" aria-label={`Move block ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><FiChevronUp /></button><button type="button" aria-label={`Move block ${i + 1} down`} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><FiChevronDown /></button><button type="button" aria-label={`Duplicate block ${i + 1}`} onClick={() => setBlocks(prev => [...prev.slice(0, i + 1), { ...b }, ...prev.slice(i + 1)])}><FiCopy /></button><button type="button" aria-label={`Delete block ${i + 1}`} onClick={() => setBlocks(prev => prev.filter((_, n) => n !== i))}><FiTrash2 /></button></div></div>
                    {!b.collapsed && <div className="be-block-fields">
                        {b.type === 'callout' ? <label>Callout type<select value={b.calloutType || 'note'} onChange={e => changeBlock(i, 'calloutType', e.target.value)}>{['note', 'tip', 'warning'].map(t => <option key={t}>{t}</option>)}</select></label> : b.type !== 'image' && <label>{b.type === 'heading' ? 'Heading' : 'Block heading (optional)'}<input value={b.title || ''} placeholder="Add a heading for this section..." onChange={e => changeBlock(i, 'title', e.target.value)} maxLength={200} /></label>}
                        {!['heading', 'image'].includes(b.type) && <label>{b.type === 'callout' ? 'Message' : b.type.includes('list') ? 'List items (one per line)' : 'Text'}<textarea value={b.text || ''} rows={4} placeholder="Write your content here..." onChange={e => changeBlock(i, 'text', e.target.value)} /></label>}
                        {['image', 'text-image'].includes(b.type) && <><label className="be-image-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseImage(e.dataTransfer.files[0], i); }}>{b.imagePreview ? <img src={b.imagePreview} alt={b.altText || ''} /> : <><FiImage /><strong>Add an image</strong><small>Click or drop a file · JPG, PNG, WebP · max 5MB</small></>}<input aria-label={`Block ${i + 1} image`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => chooseImage(e.target.files[0], i)} /></label>{b.imagePreview && <button className="be-outline" type="button" onClick={() => setBlocks(prev => prev.map((item, n) => n === i ? { ...item, image: null, imageFile: null, imagePreview: '' } : item))}>Remove image</button>}<label>Image alt text<input value={b.altText || ''} maxLength={200} onChange={e => changeBlock(i, 'altText', e.target.value)} /></label><label>Caption<input value={b.caption || ''} maxLength={500} onChange={e => changeBlock(i, 'caption', e.target.value)} /></label></>}
                        {b.type === 'quote' && <label>Attribution<input value={b.attribution || ''} maxLength={200} onChange={e => changeBlock(i, 'attribution', e.target.value)} /></label>}
                    </div>}</div>)}
                {!readOnly && <div className="be-add-wrap"><button className="be-add-block" type="button" onClick={() => setMenu(!menu)}><FiPlus /> Add Content Block</button>{menu && <div className="be-block-menu">{BLOCK_TYPES.map(([type, name, description]) => <button type="button" key={type} onClick={() => { setBlocks(prev => [...prev, { type, title: '', text: '', image: null, calloutType: 'note' }]); setMenu(false); }}><FiLayers /><span><strong>{name}</strong><small>{description}</small></span></button>)}</div>}</div>}
            </div></section>
        </div><aside className="be-sidebar">
            <section className="be-panel"><header><h2><FiSettings /> BLOG SETTINGS</h2></header><div className="be-panel-body"><label className="be-setting-label">Featured Image</label><div className="be-featured-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!readOnly) chooseImage(e.dataTransfer.files[0]); }}>{featured.preview ? <img src={featured.preview} alt={form.imageAltText} /> : <><FiImage /><strong>Upload Featured Image</strong><span>PNG, JPG, WebP (Max 5MB)</span><small>Recommended: 1200 × 675px (16:9)</small></>}</div>{!readOnly && <div className="be-file-actions"><input ref={fileRef} type="file" aria-label="Featured image" accept="image/png,image/jpeg,image/webp" onChange={e => chooseImage(e.target.files[0])} hidden /><button type="button" onClick={() => fileRef.current.click()}>Choose File</button><button type="button" onClick={() => { setFeatured({ image: '', preview: '', file: null }); fileRef.current.value = ''; }}>Remove</button></div>}
                {field('imageAltText', <>Image Alt Text <small>(Optional)</small></>, 200, 'Describe the image for accessibility...')}
                <label className="be-feature-toggle"><span><strong>Featured blog</strong><small>Mark this post for featured placements on the public site.</small></span><input type="checkbox" role="switch" checked={form.isFeatured} onChange={e => change('isFeatured', e.target.checked)} /></label>
                <label className="be-field">Author<select aria-label="Author" value={form.author} onChange={e => change('author', e.target.value)}>{Array.from(new Set([form.author, admin.name || 'Admin', ...authors.map(a => a.name)])).filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></label>{!readOnly && <div className="be-center"><button type="button" onClick={() => save()}>Save</button></div>}
            </div></section>
            <section className="be-panel" ref={scheduleRef}><header><h2><FiLayers /> Publishing Options</h2></header><div className="be-panel-body">{[['draft', 'Save as Draft', 'Keep it private and continue later.'], ['publish', 'Publish Now', 'Make it live immediately.'], ['schedule', 'Schedule Publication', 'Set a future date and time.']].map(([value, label, hint]) => <label className="be-radio" key={value}><input type="radio" name="publication" value={value} checked={form.publication === value} onChange={() => change('publication', value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}
                <div className="be-schedule-row"><input aria-label="Publication date" type="date" value={schedule.date} onChange={e => { setSchedule({ ...schedule, date: e.target.value }); change('publication', 'schedule'); }} /><input aria-label="Publication time" type="time" value={schedule.time} onChange={e => { setSchedule({ ...schedule, time: e.target.value }); change('publication', 'schedule'); }} /></div>
                <select aria-label="Publication timezone" value={form.timezone} onChange={e => change('timezone', e.target.value)}><option value="Asia/Kolkata">(GMT+05:30) India Standard Time</option><option value="UTC">(GMT+00:00) UTC</option><option value="America/New_York">Eastern Time — New York</option><option value="Europe/London">London Time</option></select>
                {field('slug', <>URL Slug <small>(Optional)</small></>, 200, slugify(form.title) || 'your-blog-slug')}{!readOnly && <div className="be-center"><button type="submit">Save</button></div>}
            </div></section>
            <section className="be-panel"><header><div className="be-section-heading"><FiSearch /><div><h2>SEO &amp; Metadata</h2><p>How the blog appears in search results.</p></div></div></header><div className="be-panel-body be-seo">
                {field('metaTitle', 'META TITLE (optional)', 160, 'Custom title for search results...')}<p>50–60 characters recommended. Falls back to the blog title.</p>
                {field('metaDescription', 'META DESCRIPTION (optional)', 320, 'Write the description search engines will display...', true)}<p>120–160 characters recommended. Falls back to the short description.</p>
                <label className="be-setting-label">URL SLUG</label><div className="be-slug"><span>/blogs/</span><span>{form.slug || slugify(form.title) || 'your-blog-slug'}</span>{!readOnly && <button type="button" onClick={() => change('slug', '')}>Auto</button>}</div>
                <div className="be-seo-preview"><small>SEO PREVIEW</small><strong>{form.metaTitle || form.title || 'Your blog title appears here'}</strong><span>/blogs/{form.slug || slugify(form.title) || 'your-blog-slug'}</span><p>{form.metaDescription || form.description || 'Add a short description so search engines can summarise your post.'}</p></div>
            </div></section>
        </aside></fieldset>
        <div className="be-bottom"><button type="button" className="be-outline" onClick={onClose} disabled={busy}>{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly && <><button type="button" className="be-outline" disabled={busy} onClick={() => save('draft')}>Save as Draft</button><span /><button type="button" disabled={busy} onClick={() => save('schedule')}>Schedule a Blog</button><button type="button" disabled={busy} onClick={() => save('publish')}>{busy ? 'Saving…' : 'Publish'}</button></>}</div>
    </form></div>;
}
