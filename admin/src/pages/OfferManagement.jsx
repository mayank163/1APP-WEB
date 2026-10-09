import '../styles/OfferManagement.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlus, FiSearch, FiFilter, FiChevronDown, FiChevronLeft, FiChevronRight, FiMoreVertical, FiTool, FiCalendar, FiClock, FiPower, FiCopy, FiEdit2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import CouponWizard, { couponIcons, couponImageUrl, formatCouponDate } from '../components/CouponWizard';

const titleCase = value => value.charAt(0).toUpperCase() + value.slice(1);
const displayOffer = offer => ({ ...offer, id: offer._id, raw: offer, status: titleCase(offer.status), theme: 'custom', discount: offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `${offer.currency === 'INR' ? '₹' : '$'}${offer.discountValue} OFF`, cap: offer.maximumDiscount != null ? `${offer.currency === 'INR' ? '₹' : '$'}${offer.maximumDiscount.toLocaleString('en-IN')}` : null, scope: offer.applicability === 'services' ? `${offer.services.length} selected services` : offer.applicability === 'categories' ? `${offer.categories.length} selected categories` : offer.applicability === 'minimum' ? `Orders above ${offer.currency} ${offer.minimumOrderValue}` : 'All services', dates: `${formatCouponDate(offer.startsAt)} – ${formatCouponDate(offer.endsAt)} IST`, duration: offer.startsAt && offer.endsAt ? `${Number(((new Date(offer.endsAt) - new Date(offer.startsAt)) / 3600000).toFixed(1))} hours` : 'Not scheduled', limit: offer.totalLimit });

function OfferManagement() {
    const [offers, setOffers] = useState([]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('default');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [menu, setMenu] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [form, setForm] = useState(null);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const closeWizard = useCallback(() => setForm(null), []);
    const refresh = useCallback(async () => {
        setLoading(true); setLoadError('');
        try { const result = await adminApi.getOffers(); setOffers(result.data.offers.map(displayOffer)); }
        catch (error) { setLoadError(error.response?.data?.message || 'Unable to load coupons. Please try again.'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { refresh(); const timer = setInterval(refresh, 60000); return () => clearInterval(timer); }, [refresh]);
    const [history, setHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const loadHistory = async (offer, historyPage = 1) => {
        setHistoryLoading(true);
        try { const result = await adminApi.getOfferRedemptions(offer.id, historyPage); setHistory({ offer, ...result.data }); }
        catch (error) { toast.error(error.response?.data?.message || 'Unable to load redemptions.'); }
        finally { setHistoryLoading(false); }
    };
    const dialogRef = useRef(null);
    const returnFocus = useRef(null);
    const modalOpen = Boolean(confirm || history);
    useEffect(() => {
        if (!modalOpen) return;
        returnFocus.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.querySelector('input, button')?.focus();
        const handleKey = event => {
            if (event.key === 'Escape') { setConfirm(null); setHistory(null); }
            if (event.key === 'Tab') {
                const items = dialogRef.current?.querySelectorAll('button, input');
                if (!items?.length) return;
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); returnFocus.current?.focus(); };
    }, [modalOpen]);
    useEffect(() => {
        if (menu === null) return;
        const close = event => { if (!event.target.closest('.coupon-actions')) setMenu(null); };
        const escape = event => { if (event.key === 'Escape') setMenu(null); };
        document.addEventListener('click', close);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape); };
    }, [menu]);
    const filtered = offers.filter(offer => `${offer.code} ${offer.title} ${offer.description} ${offer.scope} ${offer.status}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'name') filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'uses') filtered.sort((a, b) => b.used - a.used);
    if (sort === 'status') filtered.sort((a, b) => a.status.localeCompare(b.status));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, pages);
    const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const stats = [
        [offers.length, 'Total Coupons', 'All coupon records'],
        [offers.filter(o => o.status === 'Active').length, 'Active Coupons', 'Currently available to customers'],
        [offers.filter(o => o.status === 'Scheduled').length, 'Scheduled', 'Waiting for start date/time'],
        [offers.filter(o => o.status === 'Expired').length, 'Expired', 'Validity period has ended'],
        [offers.reduce((total, offer) => total + offer.used, 0), 'Total Uses', 'Successful coupon redemptions']
    ];
    return <section className="offers-page">
        <header className="offers-header">
            <div><div className="offers-breadcrumb">Customer Management <FiChevronRight /> <span>Services</span></div>
                <h1>Offers &amp; Coupons</h1><p>Create and manage promotional offers, discount coupons, and campaigns across 1APP services.</p></div>
            <button className="offers-primary" onClick={() => { setEditing(null); setForm(true); }}><FiPlus /> Create Coupon</button>
        </header>
        <div className="offers-stats">{stats.map(([value, label, note]) => <div className="offers-stat" key={label}><strong>{value}</strong><h2>{label}</h2><p>{note}</p></div>)}</div>
        <div className="offers-filters">
            <div className="offers-search"><input aria-label="Search coupons" placeholder="Search by booking Id, customer or service" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /><button aria-label="Search"><FiSearch /></button></div>
            <label className="offers-sort"><FiFilter /><select aria-label="Sort coupons" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="default">Sort</option><option value="name">Name</option><option value="uses">Most used</option><option value="status">Status</option></select><FiChevronDown /></label>
            <button className="offers-reset" onClick={() => { setQuery(''); setSort('default'); setPage(1); }}><FiX /> Reset</button>
        </div>
        {loadError && <div role="alert" className="coupon-form-error">{loadError} <button onClick={refresh}>Retry</button></div>}
        {loading && !offers.length && <div role="status" className="offers-empty">Loading coupons…</div>}
        <div className="offers-grid">{visible.map(offer => <article className="coupon-card" key={offer.id}>
            <div className={`coupon-banner coupon-banner-${offer.theme}`}>
                {offer.image ? <img className="coupon-banner-image" src={couponImageUrl(offer.image)} alt="" /> : React.createElement(couponIcons[offer.icon] || couponIcons.tag, { className: 'coupon-lightning' })}
                <span className={`coupon-status coupon-status-${offer.status.toLowerCase()}`}>• {offer.status}</span><span className="coupon-code">{offer.code}</span>
            </div>
            <div className="coupon-body"><div className="coupon-title-row"><h2>{offer.title}</h2><div className="coupon-actions"><button aria-label={`Actions for ${offer.title} (${offer.id})`} aria-expanded={menu === offer.id} onClick={() => setMenu(menu === offer.id ? null : offer.id)}><FiMoreVertical /></button>
                {menu === offer.id && <div className="coupon-menu"><button onClick={() => { setEditing(offer.id); setForm(offer.raw); setMenu(null); }}><FiEdit2 /> Edit Coupon</button><button onClick={async () => { try { await navigator.clipboard.writeText(offer.code); toast.success('Coupon code copied.'); } catch { toast.error('Unable to copy coupon code.'); } setMenu(null); }}><FiCopy /> Copy Code</button><button onClick={() => { loadHistory(offer); setMenu(null); }} disabled={historyLoading}><FiClock /> Redemption history</button><button className="coupon-danger" onClick={() => { setConfirm(offer); setMenu(null); }} disabled={offer.status === 'Inactive'}><FiPower /> Deactivate Coupon</button></div>}
            </div></div><p className="coupon-description">{offer.description}</p><p className="coupon-discount"><strong>{offer.discount}</strong>{offer.cap && <> <span>up to {offer.cap}</span></>}</p>
                <div className="coupon-details"><div><FiTool /><span>{offer.scope}</span></div><div><FiCalendar /><span>{offer.dates}</span></div><div><FiClock /><span>Duration: {offer.duration}</span></div></div>
                <div className="coupon-usage"><span>{offer.used} / {offer.limit ?? 'Unlimited'} used</span><div className="coupon-track" role="progressbar" aria-label={`${offer.title} redemptions`} aria-valuenow={offer.used} aria-valuemin={0} aria-valuemax={offer.limit || undefined}><div style={{ width: `${offer.limit ? Math.min(100, offer.used / offer.limit * 100) : 0}%` }} /></div></div>
            </div></article>)}</div>
        {!loading && !loadError && !visible.length && <div className="offers-empty">No coupons found. Try a different search.</div>}
        <footer className="offers-pagination"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} Coupons</span><nav aria-label="Coupon pages"><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><FiChevronLeft /></button>{Array.from({ length: pages }, (_, i) => <button key={i} aria-current={currentPage === i + 1 ? 'page' : undefined} className={currentPage === i + 1 ? 'selected' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><FiChevronRight /></button></nav><label className="offers-page-size"><select aria-label="Coupons per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 per page</option><option value={6}>6 per page</option><option value={3}>3 per page</option></select><FiChevronDown /></label></footer>
        {form && <CouponWizard offer={editing ? form : null} onClose={closeWizard} onSaved={saved => { setOffers(previous => editing ? previous.map(o => o.id === saved._id ? displayOffer(saved) : o) : [displayOffer(saved), ...previous]); setForm(null); setPage(1); toast.success(saved.publicationStatus === 'draft' ? 'Draft saved.' : editing ? 'Coupon updated.' : 'Coupon created.'); }} />}
        {modalOpen && <div className="offers-overlay"><div className="offers-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="offers-dialog-title">
            {confirm ? <><div className="offers-power"><FiPower /></div><h2 id="offers-dialog-title">Deactivate this coupon?</h2><p>Customers will no longer be able to redeem this coupon.<br />Existing completed bookings and redemption records will remain unchanged.</p><div className="offers-dialog-buttons"><button disabled={saving} onClick={() => setConfirm(null)}>Cancel</button><button disabled={saving} className="offers-deactivate" onClick={async () => { setSaving(true); try { const result = await adminApi.deactivateOffer(confirm.id); setOffers(previous => previous.map(o => o.id === confirm.id ? displayOffer(result.data.offer) : o)); setConfirm(null); toast.info('Coupon deactivated.'); } catch (error) { toast.error(error.response?.data?.message || 'Unable to deactivate coupon.'); } finally { setSaving(false); } }}>{saving ? 'Deactivating…' : 'Deactivate Coupon'}</button></div></> : <><h2 id="offers-dialog-title">Redemption history</h2><p>{history.offer.title}</p>{history.records.length ? <div className="coupon-history">{history.records.map(record => <div key={record._id}><strong>{record.user?.name || 'Customer'}</strong><span>Discount: {record.discount}</span><small>{formatCouponDate(record.updatedAt)} IST</small></div>)}</div> : <p>No successful redemptions yet.</p>}<div className="offers-dialog-buttons"><button disabled={historyLoading || history.page === 1} onClick={() => loadHistory(history.offer, history.page - 1)}>Previous</button><button disabled={historyLoading || history.page * 20 >= history.total} onClick={() => loadHistory(history.offer, history.page + 1)}>Next</button><button onClick={() => setHistory(null)}>Close</button></div></>}
        </div></div>}
    </section>;
}
export default OfferManagement;
