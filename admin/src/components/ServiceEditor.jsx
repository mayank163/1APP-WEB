import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { FaArrowLeft, FaCheck, FaPlus, FaRocket, FaTrash, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import adminApi from '../services/adminApi';
import { getImageUrl } from '../utils/helpers';
import { toast } from 'react-toastify';
import '../styles/ServiceEditor.css';

const steps = ['Basic Info', 'Pricing', 'Variants & Add-ons', 'Content', 'Media', 'Requirements', 'Process', 'Preview'];
const titles = ['Basic Information', 'Pricing', 'Variants & Add-ons', 'Content', 'Media', 'Requirements & Tools', 'Our Process', 'Preview & Publish'];
const subtitles = ['This is how customers will identify the service.', 'Choose how the price is presented to customers.', 'Optional tiers and extras for this service.', 'Description, inclusions and FAQs shown on the service page.', 'Cover image and gallery shown to customers.', 'What customers must arrange and what technicians carry.', 'Customer-facing steps explaining how the service works.', 'Final check of how the service appears to customers.'];
const empty = { name: '', category: '', subcategory: '', serviceType: 'Standard', serviceDuration: '', cardDescription: '', shortDescription: [], longDescription: '', pricingType: 'fixed', actualPrice: '', discountPercentage: 0, variants: [], addons: [], includedItems: [], excludedItems: [], faqs: [], featuredImage: '', gallery: [], requirements: [], tools: [], processSteps: [], skillsRequired: [], serviceArea: 'City-wide Standard', isFeatured: false };
const imageUrl = value => value?.startsWith('blob:') ? value : getImageUrl(value);
const textOnly = value => String(value || '').replace(/<[^>]*>/g, '').trim();
const Field = ({ label, children }) => <label className="service-editor-field"><span>{label}</span>{children}</label>;

const ListEditor = ({ title, items, onChange, fields }) => {
    const [entry, setEntry] = useState({});
    return <section className="service-editor-card"><h3>{title} <small>{items.length}</small></h3>
        {items.map((item, index) => <div className="service-editor-list-item" key={index}><div><strong>{item[fields[0].key]}</strong><p>{fields.slice(1).map(field => item[field.key]).filter(value => value !== undefined && value !== '').join(' · ')}</p></div><button type="button" aria-label={`Remove ${title} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><FaTrash /></button></div>)}
        <div className="service-editor-entry">{fields.map(field => <input key={field.key} aria-label={`${title}: ${field.label}`} placeholder={field.label} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={entry[field.key] ?? ''} onChange={event => setEntry({ ...entry, [field.key]: event.target.value })} />)}</div>
        <button type="button" className="service-editor-outline" onClick={() => {
            if (!String(entry[fields[0].key] || '').trim()) return;
            if (fields.some(field => field.type === 'number' && (entry[field.key] === undefined || entry[field.key] === '' || !Number.isFinite(Number(entry[field.key])) || Number(entry[field.key]) < 0))) { toast.error('Enter valid prices and durations'); return; }
            const item = Object.fromEntries(fields.map(field => [field.key, field.type === 'number' ? Number(entry[field.key]) : String(entry[field.key] || '').trim()]));
            onChange([...items, item]); setEntry({});
        }}><FaPlus /> Add {title === 'Variants' ? 'Variant' : title === 'Add-ons' ? 'Add-on' : title === 'FAQs' ? 'FAQ' : title === 'Required Tools' ? 'Tool' : title === 'Customer Requirements' ? 'Requirement' : 'Item'}</button>
    </section>;
};

const ServiceEditor = ({ service, categories, subcategories, onClose, onSaved }) => {
    const [data, setData] = useState(() => ({ ...empty, ...service, category: service?.category?._id || service?.category || '', subcategory: service?.subcategory?._id || service?.subcategory || '', shortDescription: Array.isArray(service?.shortDescription) ? service.shortDescription : service?.shortDescription ? [service.shortDescription] : [], pricingType: service?.pricingType || (service?.hasVariants ? 'starting' : 'fixed') }));
    const [step, setStep] = useState(0);
    const [stepError, setStepError] = useState('');
    const [busy, setBusy] = useState(false);
    const [highlight, setHighlight] = useState('');
    const [coverFile, setCoverFile] = useState(null);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [processEntry, setProcessEntry] = useState({ title: '', description: '' });
    const [discountEnabled, setDiscountEnabled] = useState(Number(service?.discountPercentage) > 0);
    const [dirty, setDirty] = useState(false);
    const set = (key, value) => { setData(previous => ({ ...previous, [key]: value })); setDirty(true); };
    const stepErrors = [
        !data.name.trim() || !data.category || !data.subcategory
            ? 'Enter a service name and select a category and sub-category.'
            : !Number.isFinite(Number(data.serviceDuration)) || Number(data.serviceDuration) <= 0
                ? 'Enter a duration greater than zero.' : '',
        data.pricingType !== 'quote' && (String(data.actualPrice).trim() === '' || !Number.isFinite(Number(data.actualPrice)) || Number(data.actualPrice) < 0)
            ? 'Enter a valid base price.'
            : !Number.isFinite(Number(data.discountPercentage)) || Number(data.discountPercentage) < 0 || Number(data.discountPercentage) > 100
                ? 'Discount must be between 0 and 100%.' : '',
        '', // Variants and add-ons are optional.
        !textOnly(data.longDescription).replace(/&nbsp;/g, '').trim() ? 'Write a service description before continuing.' : '',
        !data.featuredImage ? 'Upload a featured image before continuing.' : '',
        '', // Requirements and tools are optional.
        !data.processSteps.length ? 'Add at least one process step before continuing.' : '',
        ''
    ];
    const go = index => {
        if (busy) return;
        if (index > step) {
            const incomplete = stepErrors.findIndex((error, i) => i < index && error);
            if (incomplete !== -1) { setStep(incomplete); setStepError(stepErrors[incomplete]); return; }
        }
        setStepError(''); setStep(index);
    };
    const cancel = () => { if (!busy && (!dirty || window.confirm('Discard unsaved service changes?'))) onClose(); };
    const offer = Math.floor(Number(data.actualPrice || 0) * (1 - Number(data.discountPercentage || 0) / 100));
    const checks = [['Service name set', !!data.name.trim()], ['Category & sub-category selected', !!data.category && !!data.subcategory], ['Pricing configured', data.pricingType === 'quote' || (data.actualPrice !== '' && Number(data.actualPrice) >= 0)], ['Media added', !!data.featuredImage], ['Description written', !!textOnly(data.longDescription)], ['Variants defined (optional)', true]];
    const save = async targetStatus => {
        if (busy) return;
        if (targetStatus === 'active') {
            const incomplete = stepErrors.findIndex(Boolean);
            if (incomplete !== -1) { setStep(incomplete); setStepError(stepErrors[incomplete]); return; }
        }
        if (!data.name.trim() || !data.category || !data.subcategory) { go(0); toast.error('Service name, category and sub-category are required to save.'); return; }
        if (targetStatus === 'active' && (!Number.isFinite(Number(data.serviceDuration)) || Number(data.serviceDuration) <= 0)) { go(0); toast.error('Enter a duration greater than zero.'); return; }
        if (targetStatus === 'active' && data.pricingType !== 'quote' && (data.actualPrice === '' || !Number.isFinite(Number(data.actualPrice)) || Number(data.actualPrice) < 0)) { go(1); toast.error('Enter a valid base price.'); return; }
        if (Number(data.discountPercentage) < 0 || Number(data.discountPercentage) > 100) { go(1); toast.error('Discount must be between 0 and 100%.'); return; }
        setBusy(true);
        try {
            const payload = new FormData();
            const values = { ...data, name: data.name.trim(), status: targetStatus, actualPrice: data.pricingType === 'quote' ? 0 : Number(data.actualPrice || 0), offerPrice: data.pricingType === 'quote' ? 0 : offer, serviceDuration: Number(data.serviceDuration || 0), hasVariants: data.variants.length > 0, variants: data.variants.map(item => ({ ...item, offerPrice: item.offerPrice ?? item.actualPrice, isActive: item.isActive ?? true })), addons: data.addons.map(item => ({ ...item, isActive: item.isActive ?? true })), processSteps: data.processSteps.map((item, index) => ({ ...item, stepNumber: index + 1 })) };
            ['name', 'category', 'subcategory', 'serviceType', 'serviceDuration', 'cardDescription', 'longDescription', 'pricingType', 'actualPrice', 'discountPercentage', 'offerPrice', 'status', 'hasVariants', 'isFeatured', 'serviceArea'].forEach(key => payload.append(key, values[key] ?? ''));
            ['shortDescription', 'variants', 'addons', 'includedItems', 'excludedItems', 'faqs', 'gallery', 'requirements', 'tools', 'processSteps', 'skillsRequired'].forEach(key => payload.append(key, JSON.stringify(values[key])));
            if (coverFile) payload.append('featuredImage', coverFile); else payload.append('featuredImageUrl', data.featuredImage || '');
            galleryFiles.filter(Boolean).forEach(file => payload.append('galleryImages', file));
            const result = service?._id ? await adminApi.updateService(service._id, payload) : await adminApi.createService(payload);
            if (!result.success) throw new Error(result.message || 'Could not save service');
            setDirty(false); toast.success(targetStatus === 'draft' ? 'Service saved as draft' : 'Service published'); onSaved();
        } catch (error) { toast.error(error.response?.data?.message || error.message || 'Failed to save service'); } finally { setBusy(false); }
    };
    const actions = <><button type="button" className="service-editor-outline" disabled={busy} onClick={() => save('draft')}>Save Draft</button><button type="button" className="service-editor-primary" disabled={busy} onClick={() => save('active')}><FaRocket /> {busy ? 'Saving…' : 'Publish Service'}</button></>;
    const input = (key, type = 'text', placeholder = '') => <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} placeholder={placeholder} value={data[key] ?? ''} onChange={event => set(key, event.target.value)} />;
    const moveProcess = (index, direction) => { const items = [...data.processSteps]; [items[index], items[index + direction]] = [items[index + direction], items[index]]; set('processSteps', items); };
    return <div className="service-editor">
        <button type="button" className="service-editor-back" disabled={busy} onClick={cancel}><FaArrowLeft /> Services</button>
        <header className="service-editor-header"><div><h1>{service ? 'Edit Service' : 'Create New Service'}</h1><p>Add a service to the customer catalogue.</p></div><div className="service-editor-actions">{actions}</div></header>
        <div className="service-editor-layout"><nav className="service-editor-nav" aria-label="Service sections">{steps.map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined} className={`${step === index ? 'active' : ''} ${index < step && !stepErrors[index] ? 'visited' : ''}`} onClick={() => go(index)}><span>{index < step && !stepErrors[index] ? <FaCheck /> : String(index + 1).padStart(2, '0')}</span>{label}</button>)}</nav>
        <section className="service-editor-panel" aria-labelledby="service-section-title"><h2 id="service-section-title">{titles[step]}</h2><p className="service-editor-subtitle">{subtitles[step]}{(step === 2 || step === 5) && <strong className="service-editor-optional">Optional — you can skip this step.</strong>}</p>{stepError && <p role="alert" className="service-editor-step-error">{stepError}</p>}
        {step === 0 && <div className="service-editor-fields">
            <Field label="Service Name *">{input('name', 'text', 'e.g. Networking Troubleshooting')}</Field>
            <div className="service-editor-grid"><Field label="Service Type"><select value={data.serviceType} onChange={event => set('serviceType', event.target.value)}>{[...new Set(['Standard', 'Premium', data.serviceType].filter(Boolean))].map(type => <option key={type}>{type}</option>)}</select></Field><Field label="Duration (minutes) *">{input('serviceDuration', 'number')}</Field><Field label="Category *"><select value={data.category} onChange={event => { set('category', event.target.value); set('subcategory', ''); }}><option value="">Select category…</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field><Field label="Sub-category *"><select disabled={!data.category} value={data.subcategory} onChange={event => set('subcategory', event.target.value)}><option value="">Select sub-category…</option>{subcategories.filter(item => (item.category?._id || item.category) === data.category).map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field></div>
            <Field label="Short Description">{input('cardDescription', 'text', 'One line shown on cards and lists')}</Field>
            <Field label="Key Highlights (max 3)"><div className="service-editor-inline"><input placeholder="Add a highlight…" value={highlight} disabled={data.shortDescription.length >= 3} onChange={event => setHighlight(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (highlight.trim() && data.shortDescription.length < 3) { set('shortDescription', [...data.shortDescription, highlight.trim()]); setHighlight(''); } } }} /><button type="button" className="service-editor-outline" aria-label="Add highlight" disabled={data.shortDescription.length >= 3} onClick={() => { if (highlight.trim()) { set('shortDescription', [...data.shortDescription, highlight.trim()]); setHighlight(''); } }}><FaPlus /></button></div></Field>
            <div className="service-editor-chips">{data.shortDescription.map((item, index) => <span key={index}>{item}<button type="button" aria-label={`Remove highlight ${index + 1}`} onClick={() => set('shortDescription', data.shortDescription.filter((_, i) => i !== index))}>×</button></span>)}</div>
            <div className="service-editor-grid"><Field label="Service Area">{input('serviceArea')}</Field><Field label="Skills required (comma separated)"><input value={data.skillsRequired.join(', ')} onChange={event => set('skillsRequired', event.target.value.split(',').map(item => item.trim()))} /></Field></div><label className="service-editor-toggle"><input type="checkbox" checked={data.isFeatured} onChange={event => set('isFeatured', event.target.checked)} /> Featured service</label>
        </div>}
        {step === 1 && <><div className="service-editor-pricing">{[['fixed', 'Fixed Price', 'One price for all customers'], ['starting', 'Starting From', 'Base price, may vary on-site'], ['quote', 'Get a Quote', 'Customer receives technician quote']].map(([value, label, detail]) => <button type="button" aria-pressed={data.pricingType === value} className={data.pricingType === value ? 'selected' : ''} key={value} onClick={() => set('pricingType', value)}><strong>{label}</strong><small>{detail}</small>{data.pricingType === value && <FaCheck />}</button>)}</div>{data.pricingType !== 'quote' && <div className="service-editor-fields"><Field label="Base Price (USD) *">{input('actualPrice', 'number', '0.00')}</Field><label className="service-editor-toggle"><input type="checkbox" checked={discountEnabled} onChange={event => { setDiscountEnabled(event.target.checked); if (!event.target.checked) set('discountPercentage', 0); }} /> Enable promotional discount</label>{discountEnabled && <div className="service-editor-grid"><Field label="Discount (%)"><input type="number" min="0" max="100" value={data.discountPercentage} onChange={event => set('discountPercentage', event.target.value)} /></Field><Field label="Offer Price"><output>${offer.toFixed(2)}</output></Field></div>}</div>}</>}
        {step === 2 && <div className="service-editor-grid"><ListEditor title="Variants" items={data.variants} onChange={items => set('variants', items)} fields={[{ key: 'name', label: 'Variant name' }, { key: 'sizeCapacity', label: 'Spec (e.g. 33–55 inches)' }, { key: 'actualPrice', label: '$ Price', type: 'number' }, { key: 'duration', label: 'Minutes', type: 'number' }]} /><ListEditor title="Add-ons" items={data.addons} onChange={items => set('addons', items)} fields={[{ key: 'name', label: 'Add-on name' }, { key: 'description', label: 'Short description' }, { key: 'price', label: '$ Price', type: 'number' }]} /></div>}
        {step === 3 && <><ReactQuill theme="snow" value={data.longDescription} onChange={value => set('longDescription', value)} modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'clean']] }} /><div className="service-editor-grid"><ListEditor title="Included in Service" items={data.includedItems} onChange={items => set('includedItems', items)} fields={[{ key: 'title', label: 'Add item…' }]} /><ListEditor title="Not Included" items={data.excludedItems} onChange={items => set('excludedItems', items)} fields={[{ key: 'title', label: 'Add item…' }]} /></div><ListEditor title="FAQs" items={data.faqs} onChange={items => set('faqs', items)} fields={[{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer' }]} /></>}
        {step === 4 && <><h3>Featured Image</h3><label className="service-editor-upload">{data.featuredImage && <img src={imageUrl(data.featuredImage)} alt="Service cover" />}<strong>{data.featuredImage ? 'Replace image' : 'Upload Image'}</strong><span>JPG / PNG / WebP · Recommended 1200 × 900</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files[0]; if (file) { setCoverFile(file); set('featuredImage', URL.createObjectURL(file)); } }} /></label><h3>Gallery <small>{data.gallery.length}</small></h3><div className="service-editor-gallery">{data.gallery.map((item, index) => <div key={index}>{item.type === 'image' ? <img src={imageUrl(item.url)} alt={`Gallery ${index + 1}`} /> : <span>{item.url}</span>}<button type="button" aria-label={`Remove gallery image ${index + 1}`} onClick={() => { set('gallery', data.gallery.filter((_, i) => i !== index)); setGalleryFiles(previous => previous.filter((_, i) => i !== index)); }}><FaTrash /></button></div>)}</div>{!data.gallery.length && <p>No gallery images yet.</p>}<label className="service-editor-outline service-editor-file"><FaPlus /> Upload images<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { const files = Array.from(event.target.files); setGalleryFiles(previous => [...(previous.length ? previous : data.gallery.map(() => null)), ...files]); set('gallery', [...data.gallery, ...files.map(file => ({ type: 'image', url: URL.createObjectURL(file), order: data.gallery.length }))]); event.target.value = ''; }} /></label></>}
        {step === 5 && <div className="service-editor-grid"><ListEditor title="Customer Requirements" items={data.requirements} onChange={items => set('requirements', items)} fields={[{ key: 'title', label: 'Requirement' }, { key: 'description', label: 'Short description' }]} /><ListEditor title="Required Tools" items={data.tools} onChange={items => set('tools', items)} fields={[{ key: 'name', label: 'Tool name' }, { key: 'description', label: 'Short description' }]} /></div>}
        {step === 6 && <><div className="service-editor-process">{data.processSteps.map((item, index) => <div key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveProcess(index, -1)}><FaChevronUp /></button><button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === data.processSteps.length - 1} onClick={() => moveProcess(index, 1)}><FaChevronDown /></button><button type="button" aria-label={`Delete step ${index + 1}`} onClick={() => set('processSteps', data.processSteps.filter((_, i) => i !== index))}><FaTrash /></button></div>)}</div><div className="service-editor-fields"><input aria-label="Process step title" placeholder="Step title (e.g. Inspection & Assessment)" value={processEntry.title} onChange={event => setProcessEntry({ ...processEntry, title: event.target.value })} /><textarea aria-label="Process step description" placeholder="What happens in this step" rows={3} value={processEntry.description} onChange={event => setProcessEntry({ ...processEntry, description: event.target.value })} /><button type="button" className="service-editor-outline" onClick={() => { if (processEntry.title.trim()) { set('processSteps', [...data.processSteps, { ...processEntry, title: processEntry.title.trim(), stepNumber: data.processSteps.length + 1 }]); setProcessEntry({ title: '', description: '' }); } }}><FaPlus /> Add Process Step</button></div></>}
        {step === 7 && <div className="service-editor-grid"><article className="service-editor-card service-editor-preview">{data.featuredImage && <img src={imageUrl(data.featuredImage)} alt={data.name || 'Service preview'} />}<small>{categories.find(item => item._id === data.category)?.name || 'Category'} · {data.serviceType}</small><h3>{data.name || 'Service name'}</h3><p>{data.cardDescription || textOnly(data.longDescription) || 'Add a description for your service.'}</p><ul>{data.shortDescription.map((item, index) => <li key={index}>{item}</li>)}</ul><p>{data.serviceDuration || 0} min</p><small>{data.pricingType === 'quote' ? 'GET A QUOTE' : data.pricingType === 'starting' ? 'STARTING FROM' : 'FIXED PRICE'}</small><h3>{data.pricingType === 'quote' ? 'Custom' : `$${offer.toFixed(2)}`}</h3><div className="service-editor-book">Book Service</div></article><section className="service-editor-card"><h3>Readiness checklist</h3>{checks.map(([label, ready]) => <p className={`service-editor-check ${ready ? 'ready' : ''}`} key={label}><span>{ready ? '✓' : '○'}</span>{label}</p>)}</section></div>}
        <div className="service-editor-step-actions">
            {step > 0 && <button type="button" className="service-editor-outline" disabled={busy} onClick={() => go(step - 1)}>Previous</button>}
            {step < steps.length - 1 && <button type="button" className="service-editor-primary" disabled={busy} onClick={() => go(step + 1)}>{step === 2 || step === 5 ? 'Skip / Continue' : 'Next'}</button>}
        </div>
        </section></div>
        <footer className="service-editor-footer"><span>● {busy ? 'Saving service…' : dirty ? 'Unsaved changes' : 'Ready to edit'}</span><div className="service-editor-actions"><button type="button" className="service-editor-outline" disabled={busy} onClick={cancel}>Cancel</button>{actions}</div></footer>
    </div>;
};
export default ServiceEditor;
