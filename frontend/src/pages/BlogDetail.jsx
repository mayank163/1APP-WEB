import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { resolveImageUrl } from '../services/api';
import { BlogDetailShimmer } from '../components/Shimmer';

export default function BlogDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [blog, setBlog] = useState(null);
    const [blogLoading, setBlogLoading] = useState(true);

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/blogs`)
            .then(res => {
                if (res.data.success) {
                    const found = res.data.data.blogs.find(b => b._id === id);
                    setBlog(found || null);
                }
            })
            .catch(() => {})
            .finally(() => setBlogLoading(false));
    }, [id]);

    const resolveImg = (img) => {
        if (!img) return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800';
        if (img.startsWith('http')) return img;
        return resolveImageUrl(img);
    };

    if (blogLoading) return <BlogDetailShimmer />;
    if (!blog) return <div style={{ textAlign: 'center', padding: 80, color: '#888' }}>Blog not found.</div>;

    const blocks = blog.contentBlocks || [];

    // Layout patterns cycling through blocks
    const renderBlock = (block, index) => {
        const isEven = index % 4;
        const img = resolveImg(block.image);
        const lines = block.text?.split('\n') || [];
        const heading = lines[0] || '';
        const body = lines.slice(1).join('\n').trim();
        const orderLabel = `0${index + 1} — ${heading.replace(/^\d+\.\s*/, '').split(' ').slice(0, 3).join(' ').toUpperCase()}`;
        const title = heading.replace(/^\d+\.\s*/, '');

        // Pattern 0: full-width image above, text below
        if (isEven === 0) {
            return (
                <div key={index} style={{ marginBottom: 56 }}>
                    <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
                        <img src={img} alt={title} style={{ width: '100%', height: 380, objectFit: 'cover' }} />
                    </div>
                    <div style={{ color: '#000000', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{orderLabel}</div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.6rem', marginBottom: 12 }}>{title}</h2>
                    <p style={{ fontSize: 15, color: '#444', lineHeight: 1.8, maxWidth: 680 }}>{body}</p>
                </div>
            );
        }

        // Pattern 1: image left, text right (light bg card)
        if (isEven === 1) {
            return (
                <div key={index} style={{ background: '#f7f5f2', borderRadius: 16, display: 'flex', gap: 32, padding: 24, marginBottom: 56, alignItems: 'center' }}>
                    <div style={{ width: '45%', flexShrink: 0, borderRadius: 12, overflow: 'hidden', height: 260 }}>
                        <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#000000', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{orderLabel}</div>
                        <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 12 }}>{title}</h2>
                        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8 }}>{body}</p>
                    </div>
                </div>
            );
        }

        // Pattern 2: text center, full-width image below
        if (isEven === 2) {
            return (
                <div key={index} style={{ marginBottom: 56, textAlign: 'center' }}>
                    <div style={{ color: '#000000', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{orderLabel}</div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.6rem', marginBottom: 12 }}>{title}</h2>
                    <p style={{ fontSize: 15, color: '#444', lineHeight: 1.8, margin: '0 auto 24px' }}>{body}</p>
                    <div style={{ borderRadius: 16, overflow: 'hidden' }}>
                        <img src={img} alt={title} style={{ width: '100%', height: 360, objectFit: 'cover' }} />
                    </div>
                </div>
            );
        }

        // Pattern 3: text left, image right (dark bg card)
        return (
            <div key={index} style={{ background: '#111', borderRadius: 16, display: 'flex', gap: 32, padding: 32, marginBottom: 56, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#000000', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{orderLabel}</div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 12, color: '#fff' }}>{title}</h2>
                    <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.8 }}>{body}</p>
                    <button style={{ marginTop: 20, border: '1.5px solid #000000', background: '#000000', color: '#fff', borderRadius: 24, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                        Enquire About This
                    </button>
                </div>
                <div style={{ width: '48%', flexShrink: 0, borderRadius: 12, overflow: 'hidden', height: 280, position: 'relative' }}>
                    <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 16, right: 16, background: '#000000', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontStyle: 'italic', fontWeight: 600 }}>
                        "Quality speaks for itself."
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 20px 80px' }}>

            {/* Breadcrumb */}
            <div style={{ textAlign: 'center', fontSize: 13, color: '#888', marginBottom: 16 }}>
                <span style={{ cursor: 'pointer' }} onClick={() => navigate('/blogs')}>Blogs</span>
                <span style={{ margin: '0 6px' }}>›</span>
                <span>{blog.subcategory?.category?.name || 'Home'}</span>
            </div>

            {/* Title */}
            <h1 style={{ fontWeight: 900, fontSize: '2.4rem', textAlign: 'center', lineHeight: 1.25, marginBottom: 20 }}>{blog.title}</h1>

            {/* Description */}
            <p style={{ textAlign: 'center', fontSize: 15, color: '#555', lineHeight: 1.8, maxWidth: 620, margin: '0 auto 32px' }}>
                {blog.description?.slice(0, 180)}
            </p>

            {/* Divider */}
            <div style={{ width: 60, height: 2, background: '#ddd', margin: '0 auto 48px' }} />

            {/* Content Blocks */}
            {blocks.map((block, i) => renderBlock(block, i))}

            {/* CTA Footer */}
            <div style={{ background: '#f5f5f5', borderRadius: 16, padding: '48px 32px', textAlign: 'center', marginTop: 40 }}>
                <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 12 }}>Ready to get started?</h2>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>
                    Consult with our 1APP experts to find the perfect solution for your needs.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button style={{ background: '#000000', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        Get a Free Quote
                    </button>
                    <button onClick={() => navigate('/services')} style={{ background: '#fff', color: '#000000', border: '1.5px solid #000000', borderRadius: 8, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        View All Services
                    </button>
                </div>
            </div>
        </div>
    );
}
