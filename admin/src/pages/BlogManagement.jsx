import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { ShimmerBlogTable } from '../components/Shimmer';
import AdminImage from '../components/AdminImage';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaImage, FaEye, FaTimes } from 'react-icons/fa';
import { FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiStar, FiCopy, FiArchive, FiClock, FiArrowUpCircle, FiAlertCircle } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../styles/BlogManagement.css';
import { getImageUrl } from '../utils/helpers';

import BlogEditor from '../components/BlogEditor';

const BlogManagement = () => {
    const [blogs, setBlogs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState(null);
    const showForm = !!editor;
    const handleOpenCreate = () => setEditor({ blog: null });
    const handleOpenEdit = blog => setEditor({ blog });

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [menuId, setMenuId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const setPreview = blog => setEditor({ blog, readOnly: true });
    const [scheduleTarget, setScheduleTarget] = useState(null);
    const [scheduleDate, setScheduleDate] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const statusOf = b => b.isArchived ? 'Archived' : b.scheduledAt && new Date(b.scheduledAt) > new Date() ? 'Scheduled' : b.isPublished ? 'Published' : 'Draft';
    const filtered = blogs.filter(b => (!statusFilter || statusOf(b) === statusFilter) && (!categoryFilter || b.subcategory?.category?._id === categoryFilter) && `${b.title} ${b.description} ${b.subcategory?.name || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'oldest' ? new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt) : new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, pages);
    const visibleBlogs = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, sort, pageSize]);
    useEffect(() => {
        const close = () => setMenuId(null);
        const escape = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('click', close);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape); };
    }, []);
    const updateStatus = async (blog, values) => {
        setActionBusy(true);
        try {
            const fd = new FormData();
            Object.entries(values).forEach(([key, value]) => fd.append(key, value));
            const res = await adminApi.updateBlog(blog._id, fd);
            if (!res.success) throw new Error('Unable to update blog');
            setScheduleTarget(null);
            await fetchData();
            toast.success('Blog updated successfully');
        } catch (err) { toast.error(err.response?.data?.message || err.message); }
        finally { setActionBusy(false); }
    };
    const duplicateBlog = blog => { setEditor({ blog, duplicate: true }); setMenuId(null); };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [blogRes, catRes, subRes] = await Promise.all([
                adminApi.getBlogs(),
                adminApi.getCategories(),
                adminApi.getSubCategories()
            ]);
            if (blogRes.success) setBlogs(blogRes.data.blogs);
            if (catRes.success) setCategories(catRes.data.categories);
            if (subRes.success) setSubcategories(subRes.data.subcategories);
        } catch (err) {
            toast.error('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (id) => {
        setActionBusy(true);
        try {
            const res = await adminApi.deleteBlog(id);
            if (res.success) {
                setDeleteTarget(null);
                toast.success('Blog deleted successfully');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete blog');
        } finally { setActionBusy(false); }
    };

    if (editor) return <BlogEditor {...editor} categories={categories} subcategories={subcategories} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); fetchData(); }} />;

    return (
        <div className="blog-management">
            <div className="blog-page-heading">
                <div>
                    <div className="blog-breadcrumb">Content Management <span>›</span> <strong>Blogs</strong></div>
                    <h1 className="fw-bold text-dark mb-1">Blogs Management</h1>
                    <p className="text-muted mb-0">Create and manage blog posts with rich content blocks</p>
                </div>
                {!showForm && (
                    <button
                        onClick={handleOpenCreate}
                        className="blog-create-button"
                    >
                        <FaPlus /><span>Create Blog</span>
                    </button>
                )}
            </div>

            <div className="blog-stat-grid">
                {[['Total Blogs', blogs.length, ''], ['Published Blogs', blogs.filter(b => statusOf(b) === 'Published').length, 'Published'], ['Scheduled', blogs.filter(b => statusOf(b) === 'Scheduled').length, 'Scheduled'], ['Drafted', blogs.filter(b => statusOf(b) === 'Draft').length, 'Draft'], ['Archived', blogs.filter(b => statusOf(b) === 'Archived').length, 'Archived']].map(([label, count, status]) => <button key={label} className={`blog-stat ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}><strong>{count}</strong><span>{label}</span></button>)}
            </div>
            <div className="blog-filters">
                <div className="blog-search"><input aria-label="Search blogs" placeholder="Search by blog title, description or subcategory" value={search} onChange={e => setSearch(e.target.value)} /><span><FiSearch /></span></div>
                <label className="blog-filter-select"><FiFilter /><select aria-label="Sort blogs" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Sort: Newest</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
                <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Status</option>{['Published', 'Scheduled', 'Draft', 'Archived'].map(status => <option key={status}>{status}</option>)}</select>
                <select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">Category</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
                <button className="blog-reset" onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); setSort('newest'); setPage(1); }}><FaTimes /> Reset</button>
            </div>
            {loading ? <ShimmerBlogTable rows={5} /> : <div className="blog-table-shell"><table className="blog-table"><thead><tr>{['Image', 'Blog title', 'Category', 'Subcategory', 'Content', 'Featured', 'Status', 'Updated', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
                {visibleBlogs.length === 0 && <tr><td colSpan="9" className="blog-empty">{blogs.length ? 'No blogs match your filters.' : 'No blogs yet. Create your first blog to get started.'}</td></tr>}
                {visibleBlogs.map(blog => <tr key={blog._id}>
                    <td>{blog.featuredImage ? <AdminImage src={getImageUrl(blog.featuredImage)} alt={blog.title} width={56} height={44} radius={7} /> : <span className="blog-image-placeholder"><FaImage /></span>}</td>
                    <td><div className="blog-row-title" title={blog.title}>{blog.title}</div><div className="blog-row-description">{blog.description}</div></td>
                    <td>{blog.subcategory?.category?.name || '—'}</td><td>{blog.subcategory?.name || '—'}</td>
                    <td><span className="blog-block-count">{blog.contentBlocks?.length || 0} {blog.contentBlocks?.length === 1 ? 'block' : 'blocks'}</span></td>
                    <td><span className={`blog-featured ${blog.isFeatured ? 'selected' : ''}`}><FiStar /> {blog.isFeatured ? 'Featured' : 'Not featured'}</span></td>
                    <td><span className={`blog-status ${statusOf(blog).toLowerCase()}`}>• {statusOf(blog)}</span>{statusOf(blog) === 'Scheduled' && <small className="blog-schedule-date">{new Date(blog.scheduledAt).toLocaleDateString('en-GB')}</small>}</td>
                    <td className="blog-updated">{new Date(blog.updatedAt || blog.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><div className="blog-row-actions"><button aria-label={`Preview ${blog.title}`} onClick={() => setPreview(blog)}><FaEye /></button><button aria-label={`Edit ${blog.title}`} onClick={() => handleOpenEdit(blog)}><FaEdit /></button><button aria-label={`Actions for ${blog.title}`} aria-expanded={menuId === blog._id} onClick={e => { e.stopPropagation(); setMenuId(menuId === blog._id ? null : blog._id); }}><FiMoreHorizontal /></button></div>
                    {menuId === blog._id && <div className="blog-action-menu" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setPreview(blog); setMenuId(null); }}><FaEye />Preview Blog</button>
                        <button onClick={() => { handleOpenEdit(blog); setMenuId(null); }}><FaEdit />Edit Blog</button>
                        <button disabled={actionBusy} onClick={() => { setMenuId(null); updateStatus(blog, { isPublished: true, isArchived: false, scheduledAt: '' }); }}><FiArrowUpCircle />Publish Now</button>
                        <button onClick={() => { setScheduleTarget(blog); setScheduleDate(''); setMenuId(null); }}><FiClock />Schedule Publication</button>
                        <button onClick={() => duplicateBlog(blog)}><FiCopy />Duplicate Blog</button>
                        <button disabled={actionBusy} onClick={() => { setMenuId(null); updateStatus(blog, { isArchived: true, isPublished: false, scheduledAt: '' }); }}><FiArchive />Archive Blog</button>
                        <button className="blog-delete-action" onClick={() => { setDeleteTarget(blog); setMenuId(null); }}><FaTrash />Delete Blog</button>
                    </div>}</td>
                </tr>)}
            </tbody></table></div>}
            <div className="blog-pagination"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} blogs</span><nav aria-label="Blog pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><FiChevronLeft /></button>{Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - currentPage) < 2).map((n, i, nums) => <React.Fragment key={n}>{i > 0 && n - nums[i - 1] > 1 && <span>…</span>}<button className={n === currentPage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button></React.Fragment>)}<button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><FiChevronRight /></button></nav><select aria-label="Blogs per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[10, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}</select></div>
            <Modal show={!!deleteTarget} onHide={() => !actionBusy && setDeleteTarget(null)} centered dialogClassName="blog-delete-modal"><Modal.Body><button className="blog-modal-close" aria-label="Close" disabled={actionBusy} onClick={() => setDeleteTarget(null)}><FaTimes /></button><div className="blog-delete-message"><span><FiAlertCircle /></span><div><h5>Delete Blog</h5><p>Are you sure you want to delete this blog? This action cannot be undone.</p></div></div><div className="blog-modal-buttons"><button disabled={actionBusy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="danger" disabled={actionBusy} onClick={() => handleDelete(deleteTarget._id)}>{actionBusy ? 'Deleting…' : 'Delete'}</button></div></Modal.Body></Modal>
            <Modal show={!!scheduleTarget} onHide={() => !actionBusy && setScheduleTarget(null)} centered><Modal.Header closeButton><Modal.Title>Schedule Publication</Modal.Title></Modal.Header><Modal.Body><form onSubmit={e => { e.preventDefault(); if (new Date(scheduleDate) <= new Date()) { toast.error('Choose a future date and time'); return; } updateStatus(scheduleTarget, { scheduledAt: new Date(scheduleDate).toISOString(), isPublished: false, isArchived: false }); }}><label htmlFor="blog-schedule-time" className="form-label">Publication date and time (your local time)</label><input id="blog-schedule-time" className="form-control" type="datetime-local" required value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} /><button className="blog-create-button mt-3" disabled={actionBusy} type="submit">{actionBusy ? 'Saving…' : 'Schedule Publication'}</button></form></Modal.Body></Modal>

        </div>
    );
};

export default BlogManagement;
