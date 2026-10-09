import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiUpload, FiSmile, FiTag, FiGift, FiPercent, FiTool, FiHome, FiCalendar, FiClock, FiInfo } from 'react-icons/fi';
import adminApi from '../services/adminApi';
import { getImageUrl } from '../utils/helpers';
import '../styles/CouponWizard.css';

export const couponIcons = { tag: FiTag, gift: FiGift, percent: FiPercent, tool: FiTool, home: FiHome, calendar: FiCalendar };
export const couponImageUrl = image => {
    if (!image || typeof image !== 'string') return '';
    if (/^https?:\/\//.test(image)) return image;
    if (image.startsWith('/uploads/')) return `${(process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '')}${image}`;
    return getImageUrl(image);
};
const localIST = date => new Date(new Date(date).getTime() + 330 * 60000).toISOString().slice(0, 16);
export const formatCouponDate = date => date && Number.isFinite(new Date(date).getTime()) ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date)) : 'Not set';
const headings = ['Basic Information', 'Discount Details', 'Applicability', 'Validity & Schedule', 'Usage & Limits', 'Status', 'Live customer-facing preview'];
const defaults = () => ({ code: '', title: '', description: '', image: '', icon: 'tag', currency: 'USD', discountType: 'percentage', discountValue: '', maximumDiscount: '', applicability: 'all', services: [], categories: [], minimumOrderValue: 0, eligibility: 'all', customers: [], startsAt: localIST(new Date()), endsAt: localIST(Date.now() + 72 * 3600000), totalLimit: '', perCustomerLimit: 1, publicationStatus: 'active' });
const errorMessage = error => error.response?.data?.message || error.message || 'Unable to save coupon.';

export default function CouponWizard({ offer, onClose, onSaved }) {
    const [values, setValues] = useState(() => offer ? { ...defaults(), ...offer, startsAt: offer.startsAt ? localIST(offer.startsAt) : '', endsAt: offer.endsAt ? localIST(offer.endsAt) : '', maximumDiscount: offer.maximumDiscount ?? '', totalLimit: offer.totalLimit ?? '' } : defaults());
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [options, setOptions] = useState({ services: [], categories: [], customers: [] });
    const [optionsError, setOptionsError] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [iconsOpen, setIconsOpen] = useState(false);
    const [duration, setDuration] = useState(72);
    const ref = useRef(null);
    const bodyRef = useRef(null);
    const set = (key, value) => setValues(current => ({ ...current, [key]: value }));
    useEffect(() => {
        const controller = { active: true };
        const timeout = setTimeout(() => adminApi.getOfferOptions({ customerSearch }).then(result => { if (controller.active) { setOptions(result.data); setOptionsError(''); } }).catch(err => { if (controller.active) setOptionsError(errorMessage(err)); }), customerSearch ? 300 : 0);
        return () => { controller.active = false; clearTimeout(timeout); };
    }, [customerSearch]);
    useEffect(() => {
        const prior = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        ref.current?.querySelector('button')?.focus();
        const keydown = event => {
            if (event.key === 'Escape' && !ref.current?.dataset.busy) onClose();
            if (event.key !== 'Tab') return;
            const items = [...ref.current.querySelectorAll('button, input, select, textarea')].filter(item => !item.disabled && item.offsetParent !== null);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); prior?.focus(); };
    }, [onClose]);
    const payload = status => ({ ...values, publicationStatus: status, discountValue: Number(values.discountValue || 0), minimumOrderValue: Number(values.minimumOrderValue || 0), perCustomerLimit: Number(values.perCustomerLimit), startsAt: values.startsAt ? new Date(`${values.startsAt}:00+05:30`).toISOString() : null, endsAt: values.endsAt ? new Date(`${values.endsAt}:00+05:30`).toISOString() : null });
    const stepError = index => {
        if (index === 0) {
            if (!/^[A-Z0-9-]{1,30}$/.test(values.code)) return 'Enter a code using uppercase letters, numbers and hyphens.';
            if (!values.title.trim() || !values.description.trim()) return 'Coupon title and short description are required.';
        }
        if (index === 1 && (!(Number(values.discountValue) > 0) || (values.discountType === 'percentage' && Number(values.discountValue) > 100) || (values.maximumDiscount !== '' && !(Number(values.maximumDiscount) > 0)))) return 'Enter a valid discount. Percentage must be between 0 and 100; maximum discount must be positive.';
        if (index === 2) {
            if (values.applicability === 'services' && !values.services.length) return 'Select at least one service.';
            if (values.applicability === 'categories' && !values.categories.length) return 'Select at least one category.';
            if (values.applicability === 'minimum' && !(Number(values.minimumOrderValue) > 0)) return 'Enter a minimum order value.';
            if (values.eligibility === 'selected' && !values.customers.length) return 'Select at least one customer.';
        }
        if (index === 3 && (!values.startsAt || !values.endsAt || !Number.isFinite(new Date(`${values.startsAt}:00+05:30`).getTime()) || !Number.isFinite(new Date(`${values.endsAt}:00+05:30`).getTime()) || values.endsAt <= values.startsAt)) return 'Choose a start time and a later end time.';
        if (index === 4 && ((values.totalLimit !== '' && (!Number.isSafeInteger(Number(values.totalLimit)) || Number(values.totalLimit) < 1)) || !Number.isSafeInteger(Number(values.perCustomerLimit)) || Number(values.perCustomerLimit) < 1)) return 'Usage limits must be positive whole numbers.';
        return '';
    };
    const next = () => { const message = stepError(step); if (message) { setError(message); return; } setError(''); setStep(step + 1); bodyRef.current?.scrollTo?.(0, 0); };
    const save = async draft => {
        if (draft && !/^[A-Z0-9-]{1,30}$/.test(values.code)) { setStep(0); setError('Enter or generate a coupon code before saving a draft.'); return; }
        if (!draft) { for (let i = 0; i < 6; i++) { const message = stepError(i); if (message) { setStep(i); setError(message); return; } } }
        setBusy(true); setError('');
        try { const body = payload(draft ? 'draft' : values.publicationStatus); const result = offer ? await adminApi.updateOffer(offer._id, body) : await adminApi.createOffer(body); onSaved(result.data.offer); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
    };
    const upload = async event => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP image up to 2 MB.'); input.value = ''; return; }
        setUploading(true); setError('');
        try { const data = new FormData(); data.append('image', file); const result = await adminApi.uploadOfferImage(data); set('image', result.data.image); } catch (err) { setError(errorMessage(err)); } finally { setUploading(false); input.value = ''; }
    };
    const toggle = (key, id) => set(key, values[key].includes(id) ? values[key].filter(value => value !== id) : [...values[key], id]);
    const radio = (key, value, label, description) => <label key={`${key}-${value}`} className={`coupon-choice ${values[key] === value ? 'is-selected' : ''}`}><input type="radio" name={key} checked={values[key] === value} onChange={() => set(key, value)} /><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>;
    const moneySymbol = values.currency === 'INR' ? '₹' : '$';
    const Icon = couponIcons[values.icon] || FiTag;
    const validDates = values.startsAt && values.endsAt && values.endsAt > values.startsAt;
    const hours = validDates ? (new Date(values.endsAt) - new Date(values.startsAt)) / 3600000 : 0;
    const effective = values.publicationStatus === 'inactive' ? 'Inactive' : values.publicationStatus === 'draft' ? 'Draft' : new Date(`${values.endsAt}+05:30`) <= new Date() ? 'Expired' : new Date(`${values.startsAt}+05:30`) > new Date() ? 'Scheduled' : 'Active';
    return <div className="offers-overlay"><div className="coupon-wizard" ref={ref} role="dialog" aria-modal="true" aria-labelledby="coupon-wizard-title" data-busy={busy || uploading ? 'true' : undefined}>
        <header className="coupon-wizard-header"><div><h2 id="coupon-wizard-title">{offer ? 'Edit Coupon' : 'Create New Coupon'}</h2><p>Configure the offer, eligibility, validity and limits.</p></div><button type="button" aria-label="Close coupon editor" disabled={busy || uploading} onClick={onClose}><FiX /></button></header>
        <div className="coupon-wizard-body" ref={bodyRef}>
            <div className="coupon-step-progress" aria-label={`Step ${step + 1} of 7`}><span style={{ width: `${(step + 1) / 7 * 100}%` }} /></div>
            <div className="coupon-step-heading"><span>{step === 6 ? 'PREVIEW' : step + 1}</span><h3>{headings[step]}</h3>{step === 3 && <small>Exact start and end, down to the hour</small>}</div>
            {error && <div role="alert" className="coupon-form-error">{error}</div>}
            {step === 0 && <>
                <label className="coupon-field">Coupon code <b>*</b><div className="coupon-code-input"><input aria-label="Coupon code" maxLength={30} placeholder="e.g. 1APP-SUMMER30" value={values.code} onChange={event => set('code', event.target.value.toUpperCase())} /><button type="button" onClick={() => set('code', `1APP-${Array.from(crypto.getRandomValues(new Uint8Array(5)), value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`)}>Generate</button></div><small>Max 30 characters — uppercase letters, numbers and hyphens.</small></label>
                <label className="coupon-field">Coupon title <b>*</b><input aria-label="Coupon title" maxLength={120} placeholder="e.g. Special Installation Offer" value={values.title} onChange={event => set('title', event.target.value)} /></label>
                <label className="coupon-field">Short description <b>*</b><textarea aria-label="Short description" maxLength={120} placeholder="e.g. Get 30% off on installation services." value={values.description} onChange={event => set('description', event.target.value)} /><small>{values.description.length} / 120</small></label>
                <div className="coupon-field">Promotional image or icon <span className="coupon-muted">(optional)</span><div className="coupon-media-options"><label className="coupon-upload"><FiUpload /><strong>{uploading ? 'Uploading…' : 'Upload promotional image'}</strong><small>Banner or thumbnail for the Customer App. JPG, PNG or WebP · up to 2 MB · 800×400 px recommended</small><input aria-label="Upload promotional image" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload} /></label><button type="button" className="coupon-upload" onClick={() => setIconsOpen(!iconsOpen)}><FiSmile /><strong>Choose an icon</strong><small>Select a simple icon such as tag, gift, percent, wrench, home or calendar.</small></button></div>{iconsOpen && <div className="coupon-icon-options">{Object.entries(couponIcons).map(([name, Item]) => <button type="button" key={name} aria-label={`${name} icon`} aria-pressed={values.icon === name} onClick={() => { set('icon', name); set('image', ''); }}><Item /></button>)}</div>}{values.image && <div className="coupon-upload-preview"><img src={couponImageUrl(values.image)} alt="Promotional banner" /><button type="button" onClick={() => set('image', '')}>Remove image</button></div>}</div>
            </>}
            {step === 1 && <><label className="coupon-field">Order currency<select aria-label="Order currency" value={values.currency} onChange={event => set('currency', event.target.value)}><option value="USD">USD ($)</option><option value="INR">INR (₹)</option></select><small>Must match the checkout payment currency.</small></label><div className="coupon-field">Discount type <b>*</b></div><div className="coupon-two-columns coupon-discount-options">{radio('discountType', 'percentage', <><FiPercent />Percentage</>, 'Example: 30% off')}{radio('discountType', 'flat', <><span>{moneySymbol}</span>Flat amount</>, `Example: ${moneySymbol}300 off`)}</div><div className="coupon-two-columns"><label className="coupon-field">Discount value <b>*</b><div className="coupon-unit-input"><input aria-label="Discount value" type="number" min="0.01" step="0.01" max={values.discountType === 'percentage' ? 100 : undefined} value={values.discountValue} onChange={event => set('discountValue', event.target.value)} /><span>{values.discountType === 'percentage' ? '%' : moneySymbol}</span></div></label><label className="coupon-field">Maximum discount <span className="coupon-muted">(optional)</span><input aria-label="Maximum discount" type="number" min="0.01" step="0.01" placeholder={`${moneySymbol} 500`} value={values.maximumDiscount} onChange={event => set('maximumDiscount', event.target.value)} /><small>If the computed discount exceeds the maximum, it is capped at this amount.</small></label></div></>}
            {step === 2 && <><div className="coupon-choice-list">{radio('applicability', 'all', 'All services', 'The coupon applies to all eligible services on the platform.')}{radio('applicability', 'services', 'Specific services', 'Search and pick one or more individual services.')}{radio('applicability', 'categories', 'Category', 'Apply to a full service category.')}{radio('applicability', 'minimum', 'Minimum Order Value', 'Applies when the eligible order amount meets the minimum.')}</div>
                {optionsError && <p role="alert" className="coupon-form-error">{optionsError}</p>}
                {values.applicability === 'services' && <div className="coupon-picker"><input aria-label="Search services" placeholder="Search services…" value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} /><div>{options.services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).map(item => <label key={item._id}><input type="checkbox" checked={values.services.includes(item._id)} onChange={() => toggle('services', item._id)} />{item.name}</label>)}{!options.services.length && <small>No active services available.</small>}</div></div>}
                {values.applicability === 'categories' && <div className="coupon-picker"><div>{options.categories.map(item => <label key={item._id}><input type="checkbox" checked={values.categories.includes(item._id)} onChange={() => toggle('categories', item._id)} />{item.name}</label>)}{!options.categories.length && <small>No categories available.</small>}</div></div>}
                <label className="coupon-field">Minimum order value ({values.currency})<input aria-label="Minimum order value" type="number" min="0" step="0.01" value={values.minimumOrderValue} onChange={event => set('minimumOrderValue', event.target.value)} /></label>
                <fieldset className="coupon-advanced"><legend>Advanced eligibility</legend>{radio('eligibility', 'all', 'All customers')}{radio('eligibility', 'new', 'New customers only', 'First-time bookings on 1APP.')}{radio('eligibility', 'selected', 'Selected customer segment')}{values.eligibility === 'selected' && <div className="coupon-picker"><input aria-label="Search customers" placeholder="Search name, email or phone (at least 2 characters)" value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} /><small>{values.customers.length} customers selected</small><div>{options.customers.map(item => <label key={item._id}><input type="checkbox" checked={values.customers.includes(item._id)} onChange={() => toggle('customers', item._id)} />{item.name} · {item.email || item.phone}</label>)}</div>{values.customers.map(customer => <button type="button" key={customer} onClick={() => toggle('customers', customer)}>Remove {options.customers.find(c => c._id === customer)?.name || customer}</button>)}</div>}</fieldset>
            </>}
            {step === 3 && <><div className="coupon-timezone"><FiClock /><span>Time zone: <strong>India Standard Time (IST, UTC+05:30)</strong></span></div><div className="coupon-two-columns">{[['startsAt', 'Start'], ['endsAt', 'End']].map(([key, label]) => <React.Fragment key={key}><label className="coupon-field">{label} date <b>*</b><input aria-label={`${label} date`} type="date" value={values[key].slice(0, 10)} onChange={event => { set(key, `${event.target.value}T${values[key].slice(11) || '00:00'}`); setDuration(null); }} /></label><label className="coupon-field">{label} time <b>*</b><input aria-label={`${label} time`} type="time" value={values[key].slice(11)} onChange={event => { set(key, `${values[key].slice(0, 10)}T${event.target.value}`); setDuration(null); }} /></label></React.Fragment>)}</div><div className="coupon-field">Validity duration preview<small>Choose a duration to calculate the end time automatically.</small></div><div className="coupon-duration-options">{[1, 6, 12, 24, 72, 168, 720].map(value => <button key={value} type="button" className={duration === value ? 'is-selected' : ''} onClick={() => { if (!values.startsAt) { setError('Choose a start date first.'); return; } setDuration(value); set('endsAt', localIST(new Date(`${values.startsAt}:00+05:30`).getTime() + value * 3600000)); }}>{value} {value === 1 ? 'hour' : 'hours'}{value >= 24 ? ` (${value / 24} ${value === 24 ? 'day' : 'days'})` : ''}</button>)}<button type="button" className={duration === null ? 'is-selected' : ''} onClick={() => setDuration(null)}>Custom end date &amp; time</button></div><div className="coupon-schedule-summary"><div><span>STARTS</span><strong>{values.startsAt ? `${formatCouponDate(`${values.startsAt}:00+05:30`)} IST` : 'Not set'}</strong></div><div><span>ENDS</span><strong>{values.endsAt ? `${formatCouponDate(`${values.endsAt}:00+05:30`)} IST` : 'Not set'}</strong></div><div><span>DURATION</span><strong>{hours > 0 ? `${Number(hours.toFixed(2))} hours` : 'Choose valid dates'}</strong></div></div></>}
            {step === 4 && <><label className="coupon-field">Total redemptions allowed<input aria-label="Total redemptions allowed" type="number" min="1" step="1" placeholder="e.g. 100" value={values.totalLimit} onChange={event => set('totalLimit', event.target.value)} /><small>Leave blank for unlimited. Only successful redemptions are counted; failed attempts are ignored.</small></label><label className="coupon-field">Uses per customer<select aria-label="Uses per customer" value={values.perCustomerLimit} onChange={event => set('perCustomerLimit', Number(event.target.value))}>{[...new Set([1, 2, 3, 5, 10, Number(values.perCustomerLimit)])].map(value => <option value={value} key={value}>{value} {value === 1 ? 'time' : 'times'}</option>)}</select></label></>}
            {step === 5 && <><div className="coupon-status-options">{[['active', 'Active', 'Publish now if within the validity period.'], ['scheduled', 'Scheduled', 'Publish automatically at the start time.'], ['inactive', 'Inactive', 'Disabled — cannot be redeemed.']].map(([value, label, note]) => radio('publicationStatus', value, label, note))}</div><p className="coupon-help">Coupon can be redeemed when all eligibility conditions are satisfied.</p><div className="coupon-status-info"><FiInfo /><span>Effective state: <strong>{effective}</strong>{effective === 'Scheduled' ? ' — it will go live automatically at its start time.' : ''}</span></div><p className="coupon-help">Expired and Exhausted are derived automatically from time and usage — they cannot be selected manually.</p></>}
            {step === 6 && <><div className="coupon-live-preview"><div className="coupon-preview-banner">{values.image ? <img src={couponImageUrl(values.image)} alt="Coupon promotion" /> : <Icon />}</div><div className="coupon-preview-body"><div className="coupon-preview-code"><strong>{values.discountType === 'percentage' ? `${values.discountValue}% OFF` : `${moneySymbol}${values.discountValue} OFF`}</strong><span>{values.code || 'CODE'}</span></div><h4>{values.title || 'Coupon title'}</h4><p>{values.description || 'Short description of the offer will appear here.'}</p>{values.maximumDiscount !== '' && <p>Maximum discount: {moneySymbol}{values.maximumDiscount}</p>}<p><FiCalendar /> {values.startsAt ? formatCouponDate(`${values.startsAt}:00+05:30`) : 'Not set'} – {values.endsAt ? formatCouponDate(`${values.endsAt}:00+05:30`) : 'Not set'} IST</p><p><FiTool /> {values.applicability === 'services' ? `${values.services.length} selected services` : values.applicability === 'categories' ? `${values.categories.length} selected categories` : 'Valid for all services'}</p>{Number(values.minimumOrderValue) > 0 && <p>Minimum order: {moneySymbol}{values.minimumOrderValue}</p>}<p>{values.eligibility === 'new' ? 'New customers only' : values.eligibility === 'selected' ? 'Selected customers only' : 'All customers'} · {values.perCustomerLimit} use(s) per customer</p></div></div><p className="coupon-help">This is a preview of the intended customer-facing presentation, not a guarantee of final mobile layout.</p></>}
        </div>
        <footer className="coupon-wizard-footer"><button disabled={busy || uploading} onClick={onClose}>Cancel</button><button disabled={busy || uploading} onClick={() => save(true)}>Save as Draft</button><div className="coupon-wizard-next">{step > 0 && <button disabled={busy || uploading} onClick={() => { setStep(step - 1); setError(''); }}>Back</button>}<button className="is-primary" disabled={busy || uploading} onClick={step === 6 ? () => save(false) : next}>{busy ? 'Saving…' : step === 6 ? offer ? 'Save Coupon' : 'Create Coupon' : 'Next'}</button></div></footer>
    </div></div>;
}
