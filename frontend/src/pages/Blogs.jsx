import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../services/api';
import serviceService from '../services/serviceService';
import { BlogsShimmer } from '../components/Shimmer';

export default function Blogs() {
    const [blogs, setBlogs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeTab, setActiveTab] = useState(null); // null = All
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const row1Ref = useRef(null);
    const row2Ref = useRef(null);
    const otherRef = useRef(null);
    const catRef = useRef(null);

    useEffect(() => {
        Promise.all([
            axios.get(`${process.env.REACT_APP_API_URL}/blogs`),
            serviceService.getCategoriesWithSubcategories(),
        ]).then(([blogsRes, catRes]) => {
            if (blogsRes.data.success) setBlogs(blogsRes.data.data.blogs);
            if (catRes.success) setCategories(catRes.data.categories);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const resolveImg = (img) => {
        if (!img) return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600';
        if (img.startsWith('http')) return img;
        return resolveImageUrl(img);
    };

    const filteredBlogs = activeTab
        ? blogs.filter(b => b.subcategory?.category?._id === activeTab)
        : blogs;

    const hero = filteredBlogs[0] || null;
    const sideBlogs = filteredBlogs.slice(1, 3);
    // No duplicates — use real data only
    const gridRow1 = filteredBlogs.slice(0, 5);
    const gridRow2 = filteredBlogs.slice(5, 10);
    const featuredTwo = filteredBlogs.slice(0, 2);
    const otherBlogs = filteredBlogs.slice(0, 5);

    const scroll = (ref, dir) => ref.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

    const Tag = ({ label }) => (
        <span style={{
            background: '#f0f0f0', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            padding: '3px 8px', borderRadius: 4, color: '#555', textTransform: 'uppercase',
            display: 'inline-block',
        }}>{label}</span>
    );

    const BlogCard = ({ blog, onClick }) => (
        <div onClick={onClick} style={{ cursor: 'pointer', minWidth: 160, flex: '0 0 160px' }}>
            <div style={{ borderRadius: 10, overflow: 'hidden', height: 130, background: '#eee', marginBottom: 8 }}>
                <img
                    src={resolveImg(blog.featuredImage)}
                    alt={blog.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                />
            </div>
            <Tag label={blog.subcategory?.category?.name || 'BLOG'} />
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{blog.title}</div>
        </div>
    );

    const ScrollRow = ({ items, refEl, label }) => (
        <div style={{ marginBottom: 32 }}>
            {label && <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 16 }}>{label}</h2>}
            <div style={{ position: 'relative' }}>
                <div
                    ref={refEl}
                    style={{
                        display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4,
                        scrollbarWidth: 'none', msOverflowStyle: 'none',
                    }}
                >
                    {items.map((b, i) => (
                        <BlogCard key={b._id + i} blog={b} onClick={() => navigate(`/blogs/${b._id}`)} />
                    ))}
                </div>
                {items.length > 4 && (
                    <>
                        <button onClick={() => scroll(refEl, -1)} style={arrowBtn('left')}>‹</button>
                        <button onClick={() => scroll(refEl, 1)} style={arrowBtn('right')}>›</button>
                    </>
                )}
            </div>
        </div>
    );

    const EmptyState = () => {
        const cat = categories.find(c => c._id === activeTab);
        return (
            <div style={{
                textAlign: 'center', padding: '64px 20px', background: '#fafafa',
                borderRadius: 16, border: '1.5px dashed #e0e0e0', marginBottom: 40,
            }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 8, color: '#111' }}>
                    No blogs in {cat?.name || 'this category'} yet
                </h3>
                <p style={{ fontSize: 14, color: '#888', marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>
                    We're working on bringing you great content here. Check back soon or explore other categories.
                </p>
                <button
                    onClick={() => setActiveTab(null)}
                    style={{
                        background: '#000000', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '10px 24px', fontWeight: 700,
                        fontSize: 14, cursor: 'pointer',
                    }}
                >
                    Browse All Blogs
                </button>
            </div>
        );
    };

    if (loading) return <BlogsShimmer />;

    return (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

            {/* ── Header ── */}
            <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 20 }}>Checkout Our Latest Blogs</h2>

            {/* ── Hero Section (only when blogs exist) ── */}
            {filteredBlogs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginBottom: 32 }}>
                    {hero && (
                        <div onClick={() => navigate(`/blogs/${hero._id}`)} style={{ cursor: 'pointer' }}>
                            <div style={{ borderRadius: 12, overflow: 'hidden', height: 260, background: '#eee', marginBottom: 12 }}>
                                <img
                                    src={resolveImg(hero.featuredImage)}
                                    alt={hero.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                />
                            </div>
                            <Tag label={hero.subcategory?.category?.name || 'BLOG'} />
                            <h3 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '8px 0 4px', lineHeight: 1.3 }}>{hero.title}</h3>
                            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{hero.description?.slice(0, 80)}</p>
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {sideBlogs.map(b => (
                            <div key={b._id} onClick={() => navigate(`/blogs/${b._id}`)} style={{ cursor: 'pointer', display: 'flex', gap: 10 }}>
                                <div style={{ width: 110, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#eee' }}>
                                    <img
                                        src={resolveImg(b.featuredImage)}
                                        alt={b.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                    />
                                </div>
                                <div>
                                    <Tag label={b.subcategory?.category?.name || 'BLOG'} />
                                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{b.title}</div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{b.description?.slice(0, 40)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div style={{ marginBottom: 28 }}>
                <div style={{
                    display: 'flex', gap: 4, overflowX: 'auto',
                    scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 2,
                }}>
                    {[{ _id: null, name: 'All' }, ...categories].map(cat => {
                        const isActive = activeTab === cat._id;
                        return (
                            <button
                                key={cat._id ?? 'all'}
                                onClick={() => setActiveTab(cat._id)}
                                style={{
                                    border: 'none', background: isActive ? '#000000' : '#f5f5f5',
                                    color: isActive ? '#fff' : '#555',
                                    padding: '7px 16px', borderRadius: 20,
                                    fontWeight: isActive ? 700 : 500, fontSize: 13,
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    flexShrink: 0,
                                }}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
                <div style={{ height: 1, background: '#e8e8e8', marginTop: 12 }} />
            </div>

            {/* ── Empty State ── */}
            {filteredBlogs.length === 0 && <EmptyState />}

            {/* ── Grid Rows (horizontal scroll) ── */}
            {gridRow1.length > 0 && <ScrollRow items={gridRow1} refEl={row1Ref} />}
            {gridRow2.length > 0 && <ScrollRow items={gridRow2} refEl={row2Ref} />}

            {/* ── Featured Two Cards ── */}
            {featuredTwo.length >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
                    {featuredTwo.map(b => (
                        <div key={b._id} onClick={() => navigate(`/blogs/${b._id}`)} style={{
                            cursor: 'pointer', background: '#fdf6ee', borderRadius: 12,
                            display: 'flex', gap: 12, padding: 12, alignItems: 'center',
                        }}>
                            <div style={{ width: 120, height: 90, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#eee' }}>
                                <img
                                    src={resolveImg(b.featuredImage)}
                                    alt={b.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                />
                            </div>
                            <div>
                                <Tag label={b.subcategory?.category?.name || 'BLOG'} />
                                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>{b.title}</div>
                                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{b.description?.slice(0, 50)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
        </div>
    );
}

const arrowBtn = (side) => ({
    position: 'absolute',
    [side]: -14,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid #e0e0e0',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: '#333',
    zIndex: 2,
    lineHeight: 1,
});
