import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../services/supportApi';
import '../styles/SupportCenter.css';
import UserSupportCenter from './UserSupportCenter';
const statuses = ['open', 'in_progress', 'escalated', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['Job Issue', 'Billing', 'Payment & Refund', 'Payout', 'App Issue', 'Verification', 'Booking', 'Other'];
const label = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const date = value => new Date(value).toLocaleString();
const Badge = ({ value }) => <span className={`support-badge ${value}`}>{label(value)}</span>;
const Attachment = ({ file }) => file?.url ? <a className="support-attachment" href={file.url} target="_blank" rel="noreferrer">📎 {file.name || 'Attachment'}</a> : null;
const emptyArticle = { title: '', content: '', category: 'Getting Started', audience: 'all', published: false };
export default function SupportCenter(props) {
    return props.adminMode ? <SupportDashboard {...props} /> : <UserSupportCenter socket={props.socket} />;
}
function SupportDashboard({ adminMode = false, socket, canWrite = true }) {
    const [params, setParams] = useSearchParams();
    const selected = params.get('ticket');
    const [tab, setTab] = useState('dashboard');
    const [list, setList] = useState({ data: [], total: 0, stats: {} });
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [agents, setAgents] = useState([]);
    const [articles, setArticles] = useState([]);
    const [articleCategory, setArticleCategory] = useState('');
    const [articleSearch, setArticleSearch] = useState('');
    const [articleEditor, setArticleEditor] = useState(null);
    const [articleView, setArticleView] = useState(null);
    const [creating, setCreating] = useState(false);
    const [reply, setReply] = useState('');
    const [note, setNote] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ subject: '', description: '', category: 'Job Issue', priority: 'medium' });
    const uploadRef = useRef(null);
    const detailRequest = useRef(0);
    const fetchList = useCallback(async () => {
        const { data } = await API.get('/support/tickets', { params: { page, search, status, priority } });
        setList(data);
    }, [page, search, status, priority]);
    const fetchDetail = useCallback(async () => {
        if (!selected) return;
        const request = ++detailRequest.current;
        const [detail, thread] = await Promise.all([API.get(`/support/tickets/${selected}`), API.get(`/support/tickets/${selected}/messages`)]);
        if (request !== detailRequest.current) return;
        setTicket(detail.data.data); setMessages(thread.data.data); setCursor(thread.data.nextCursor);
        if (!adminMode || canWrite) await API.patch(`/support/tickets/${selected}/read`);
    }, [selected, adminMode, canWrite]);
    useEffect(() => {
        let active = true;
        const timeout = setTimeout(() => { fetchList().catch(e => active && setError(e.response?.data?.message || 'Unable to load tickets.')).finally(() => active && setLoading(false)); }, 250);
        return () => { active = false; clearTimeout(timeout); };
    }, [fetchList]);
    useEffect(() => {
        setTicket(null); setMessages([]); setReply(''); setNote(''); setFile(null); setError(''); setEditing(false);
        fetchDetail().catch(e => setError(e.response?.data?.message || 'Unable to load ticket.'));
        return () => { detailRequest.current += 1; };
    }, [fetchDetail]);
    useEffect(() => {
        API.get('/support/articles').then(r => setArticles(r.data.data)).catch(e => setError(e.response?.data?.message || 'Unable to load FAQs.'));
        if (adminMode) API.get('/support/agents').then(r => setAgents(r.data.data)).catch(e => setError(e.response?.data?.message || 'Unable to load agents.'));
    }, [adminMode, tab]);
    useEffect(() => {
        const refresh = () => { fetchList().catch(() => {}); fetchDetail().catch(() => {}); };
        socket?.on('support:updated', refresh); socket?.on('connect', refresh);
        const timer = setInterval(refresh, 15000);
        return () => { socket?.off('support:updated', refresh); socket?.off('connect', refresh); clearInterval(timer); };
    }, [socket, fetchList, fetchDetail]);
    const act = async fn => {
        setBusy(true); setError('');
        try { await fn(); } catch (e) { setError(e.response?.data?.message || 'Unable to save. Please try again.'); } finally { setBusy(false); }
    };
    const patch = data => act(async () => { await API.patch(`/support/tickets/${selected}`, data); await Promise.all([fetchDetail(), fetchList()]); });
    const send = internal => act(async () => {
        const body = new FormData(); body.append('text', internal ? note : reply); body.append('internal', String(internal));
        if (!internal && file) body.append('file', file);
        await API.post(`/support/tickets/${selected}/messages`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (internal) setNote(''); else { setReply(''); setFile(null); if (uploadRef.current) uploadRef.current.value = ''; }
        await Promise.all([fetchDetail(), fetchList()]);
    });
    const create = e => { e.preventDefault(); act(async () => {
        const body = new FormData(); Object.entries(draft).forEach(([key, value]) => body.append(key, value)); if (file) body.append('file', file);
        const result = await API.post('/support/tickets', body, { headers: { 'Content-Type': 'multipart/form-data' } });
        setCreating(false); setFile(null); setDraft({ subject: '', description: '', category: 'Job Issue', priority: 'medium' }); setParams({ ticket: result.data.data._id }); await fetchList();
    }); };
    const loadOlder = () => act(async () => { const r = await API.get(`/support/tickets/${selected}/messages`, { params: { before: cursor } }); setMessages(previous => [...r.data.data, ...previous]); setCursor(r.data.nextCursor); });
    const saveArticle = e => { e.preventDefault(); act(async () => {
        if (articleEditor._id) await API.put(`/support/articles/${articleEditor._id}`, articleEditor); else await API.post('/support/articles', articleEditor);
        setArticles((await API.get('/support/articles')).data.data); setArticleEditor(null);
    }); };
    const terminal = ticket && ['closed', 'resolved'].includes(ticket.status);
    const visibleArticles = articles.filter(a => (!articleCategory || a.category === articleCategory) && `${a.title} ${a.content}`.toLowerCase().includes(articleSearch.toLowerCase()));
    return <div className="support-center">
        <div className="support-heading"><div><small>Help & Support</small><h1>{adminMode ? 'Support Dashboard' : 'Support Center'}</h1><p>{adminMode ? 'Manage your customer and technician support tickets' : 'Get help, track your tickets, and chat with our support team'}</p></div>{!adminMode && !selected && <button onClick={() => { setCreating(true); setFile(null); }}>+ New ticket</button>}</div>
        {error && <div role="alert" className="support-error">{error}<button className="support-plain" onClick={() => setError('')}>Dismiss</button></div>}
        {selected ? <><button className="support-plain support-back" onClick={() => setParams({})}>← Back to tickets</button>{ticket ? <div className="support-detail-grid"><div>
            <section className="support-card"><div className="support-ticket-meta"><strong>{ticket.ticketId}</strong><Badge value={ticket.status} /><Badge value={ticket.priority} /></div><h2>{ticket.subject}</h2><p>{ticket.requester?.name} ({ticket.requester?.role === 'technician' ? 'Technician' : 'Customer'}) · {ticket.category} · Updated {date(ticket.updatedAt)}</p></section>
            <section className="support-card"><h3>▤ Issue description</h3><p className="support-prewrap">{ticket.description}</p>{ticket.attachments?.map((a, i) => <Attachment key={i} file={a} />)}</section>
            <section className="support-card"><h3>☏ Message thread</h3>{cursor && <button disabled={busy} className="support-plain" onClick={loadOlder}>Load older messages</button>}<div className="support-thread">{messages.filter(m => !m.internal).map(m => <div className={`support-message ${m.senderRole === 'admin' ? 'agent' : ''}`} key={m._id}><div><strong>{m.senderName}</strong><p className="support-prewrap">{m.text}</p><Attachment file={m.attachment} /></div><small>{date(m.createdAt)}</small></div>)}{!messages.some(m => !m.internal) && <p>No replies yet. Start the conversation below.</p>}</div>
            {terminal ? <p>This ticket is {label(ticket.status)}. Reopen it to continue chatting.</p> : canWrite && <form onSubmit={e => { e.preventDefault(); send(false); }}><textarea aria-label="Reply" placeholder="Reply to this ticket…" maxLength={4000} value={reply} onChange={e => setReply(e.target.value)} /><div className="support-compose"><input ref={uploadRef} aria-label="Attach a file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files[0] || null)} /><button disabled={busy || (!reply.trim() && !file)}>Send reply</button></div></form>}</section>
            {adminMode && <section className="support-card"><h3>♙ Internal notes</h3><p className="support-muted">Only visible to support staff</p>{messages.filter(m => m.internal).map(m => <div className="support-note" key={m._id}><p className="support-prewrap">{m.text}</p><small>{m.senderName} · {date(m.createdAt)}</small></div>)}{canWrite && !terminal && <form onSubmit={e => { e.preventDefault(); send(true); }}><textarea aria-label="Internal note" placeholder="Add an internal note (not visible to customer)…" maxLength={4000} value={note} onChange={e => setNote(e.target.value)} /><button disabled={busy || !note.trim()}>Add note</button></form>}</section>}
        </div><aside>
            <section className="support-card"><h3>{ticket.requester?.role === 'technician' ? 'Technician' : 'Customer'} Information</h3><div className="support-profile">{ticket.requester?.profileImage?.url && <img alt="" src={ticket.requester.profileImage.url} />}<div><strong>{ticket.requester?.name}</strong><small>{ticket.requester?.technicianId || ticket.requester?._id}</small></div></div><p>{ticket.requester?.phone}<br />{ticket.requester?.email}<br />{ticket.requester?.address}</p>{adminMode && <Link to={ticket.requester?.role === 'technician' ? '/technician-overview' : '/users'}>View {ticket.requester?.role === 'technician' ? 'technician' : 'customer'}</Link>}</section>
            <section className="support-card"><div className="support-heading"><h3>Ticket Information</h3>{adminMode && canWrite && <button className="support-plain" onClick={() => setEditing(!editing)}>Edit</button>}</div><dl>{[['Ticket ID', ticket.ticketId], ['Subject', ticket.subject], ['Category', ticket.category], ['Priority', label(ticket.priority)], ['Status', label(ticket.status)], ['Created At', date(ticket.createdAt)], ['Last Updated', date(ticket.updatedAt)], ['Assigned To', ticket.assignedAgent?.name || 'Unassigned']].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>{editing && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); patch(Object.fromEntries(data)); setEditing(false); }}><label>Subject<input name="subject" defaultValue={ticket.subject} required maxLength={200} /></label><label>Category<input name="category" defaultValue={ticket.category} required maxLength={80} /></label><button disabled={busy}>Save</button></form>}</section>
            {canWrite && <section className="support-card"><h3>ϟ Actions</h3>{adminMode ? <><label>Assigned agent<select disabled={busy} value={ticket.assignedAgent?._id || ''} onChange={e => patch({ assignedAgent: e.target.value })}><option value="">Unassigned</option>{agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label><label>Priority<select disabled={busy} value={ticket.priority} onChange={e => patch({ priority: e.target.value })}>{priorities.map(p => <option key={p} value={p}>{label(p)}</option>)}</select></label>{statuses.filter(s => s !== ticket.status).map(s => <button className="support-action" key={s} disabled={busy} onClick={() => patch({ status: s })}>{s === 'open' ? 'Reopen ticket' : s === 'escalated' ? 'Escalate' : s === 'resolved' ? 'Resolve' : s === 'closed' ? 'Close ticket' : 'Mark in progress'}</button>)}</> : <button disabled={busy} onClick={() => patch({ status: terminal ? 'open' : 'closed' })}>{terminal ? 'Reopen ticket' : 'Close ticket'}</button>}</section>}
            {adminMode && <section className="support-card"><h3>Audit trail & logs</h3><div className="support-audit">{[...(ticket.audit || [])].reverse().map((a, i) => <div key={i}><strong>{a.action}</strong><small>{a.actor} · {date(a.createdAt)}</small></div>)}</div></section>}
        </aside></div> : <p>Loading ticket…</p>}</> : <>
        {tab === 'dashboard' && <div className="support-stats">{['open', 'in_progress', 'urgent', 'resolved'].map(s => <div key={s}><strong>{label(s)}</strong><span>{list.stats?.[s] || 0}</span></div>)}</div>}
        <nav className="support-tabs" aria-label="Support sections">{['dashboard', 'tickets', 'faqs'].map(t => <button className={tab === t ? 'active' : ''} key={t} onClick={() => { setTab(t); setPage(1); }}>{t === 'tickets' ? 'Ticket List' : t === 'faqs' ? 'FAQs' : 'Dashboard'}</button>)}</nav>
        {tab !== 'faqs' ? <><div className="support-filters"><label>Search<input placeholder="Search by ticket ID, name, or subject…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All</option>{statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label><label>Priority<select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}><option value="">All</option>{priorities.map(p => <option key={p} value={p}>{label(p)}</option>)}</select></label></div>
        <div className="support-table-wrap"><table><thead><tr>{['Ticket ID', 'Technician / Customer', 'Subject', 'Category', 'Priority', 'Status', 'Assigned Agent', 'Last Updated'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{list.data.map(t => <tr key={t._id}><td><button className="support-plain" onClick={() => setParams({ ticket: t._id })}><strong>{t.ticketId}</strong>{(adminMode ? t.unreadAdmin : t.unreadUser) > 0 && <span className="support-unread">{adminMode ? t.unreadAdmin : t.unreadUser}</span>}</button></td><td>{t.requester?.name}<small>{t.requester?.role === 'technician' ? 'Technician' : 'Customer'}</small></td><td><button className="support-plain" onClick={() => setParams({ ticket: t._id })}>{t.subject}</button></td><td>{t.category}</td><td><Badge value={t.priority} /></td><td><Badge value={t.status} /></td><td>{t.assignedAgent?.name || 'Unassigned'}</td><td>{date(t.updatedAt)}</td></tr>)}</tbody></table>{!list.data.length && <p className="support-empty">{loading ? 'Loading tickets…' : 'No tickets found.'}</p>}</div><div className="support-pagination"><span>{list.total ? `Showing ${(page - 1) * 10 + 1} to ${Math.min(page * 10, list.total)} of ${list.total} tickets` : '0 tickets'}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button><span>Page {page}</span><button disabled={page * 10 >= list.total} onClick={() => setPage(page + 1)}>›</button></div></div></> : <><div className="support-filters"><label>Search FAQs<input value={articleSearch} placeholder="Search help articles…" onChange={e => setArticleSearch(e.target.value)} /></label>{adminMode && canWrite && <button onClick={() => setArticleEditor({ ...emptyArticle })}>+ New article</button>}</div><div className="support-tabs"><button className={!articleCategory ? 'active' : ''} onClick={() => setArticleCategory('')}>All</button>{[...new Set(articles.map(a => a.category))].map(c => <button key={c} className={articleCategory === c ? 'active' : ''} onClick={() => setArticleCategory(c)}>{c}</button>)}</div><div className="support-articles">{visibleArticles.map(a => <section className="support-card" key={a._id}><Badge value={a.published ? 'published' : 'draft'} /><small>{a.category}</small><button className="support-plain" onClick={() => setArticleView(a)}><h3>{a.title}</h3></button><p>{a.content.slice(0, 180)}{a.content.length > 180 ? '…' : ''}</p><footer><span>{a.author?.name}</span><small>Updated {date(a.updatedAt)}</small></footer>{adminMode && canWrite && <div className="support-compose"><button className="support-plain" onClick={() => setArticleEditor({ ...a })}>Edit</button><button className="support-plain" disabled={busy} onClick={() => { if (window.confirm('Delete this article?')) act(async () => { await API.delete(`/support/articles/${a._id}`); setArticles(previous => previous.filter(item => item._id !== a._id)); }); }}>Delete</button></div>}</section>)}</div>{!visibleArticles.length && <p>No help articles found.</p>}</>}
        </>}
        {creating && <div className="support-modal" role="dialog" aria-modal="true" aria-label="Create ticket"><form className="support-card" onSubmit={create}><h2>New support ticket</h2><label>Subject<input required maxLength={200} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} /></label><label>Category<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}>{priorities.map(p => <option key={p} value={p}>{label(p)}</option>)}</select></label><label>Issue description<textarea required maxLength={10000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label><label>Attachment (JPEG, PNG, WebP or PDF, max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files[0] || null)} /></label>{error && <p role="alert">{error}</p>}<div className="support-compose"><button type="button" disabled={busy} onClick={() => { setCreating(false); setFile(null); }}>Cancel</button><button disabled={busy}>Create ticket</button></div></form></div>}
        {articleEditor && <div className="support-modal" role="dialog" aria-modal="true" aria-label="Article editor"><form className="support-card" onSubmit={saveArticle}><h2>{articleEditor._id ? 'Edit article' : 'New article'}</h2>{['title', 'category'].map(key => <label key={key}>{label(key)}<input required maxLength={key === 'title' ? 200 : 80} value={articleEditor[key]} onChange={e => setArticleEditor({ ...articleEditor, [key]: e.target.value })} /></label>)}<label>Content<textarea required maxLength={20000} value={articleEditor.content} onChange={e => setArticleEditor({ ...articleEditor, content: e.target.value })} /></label><label>Audience<select value={articleEditor.audience} onChange={e => setArticleEditor({ ...articleEditor, audience: e.target.value })}><option value="all">Everyone</option><option value="user">Customers</option><option value="technician">Technicians</option></select></label><label><input type="checkbox" checked={articleEditor.published} onChange={e => setArticleEditor({ ...articleEditor, published: e.target.checked })} /> Published</label>{error && <p role="alert">{error}</p>}<div className="support-compose"><button type="button" disabled={busy} onClick={() => setArticleEditor(null)}>Cancel</button><button disabled={busy}>Save article</button></div></form></div>}
        {articleView && <div className="support-modal" role="dialog" aria-modal="true" aria-label={articleView.title}><section className="support-card"><h2>{articleView.title}</h2><p className="support-prewrap">{articleView.content}</p><button onClick={() => setArticleView(null)}>Close</button></section></div>}
    </div>;
}
