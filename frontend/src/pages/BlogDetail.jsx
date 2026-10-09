import '../styles/BlogDetail.css';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiClock, FiUser } from 'react-icons/fi';
import axios from 'axios';
import { resolveImageUrl } from '../services/api';
import { BlogDetailShimmer } from '../components/Shimmer';

export default function BlogDetail() {
    const { id } = useParams();
    const [blog, setBlog] = useState(null);
    const [blogLoading, setBlogLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setBlogLoading(true);
        setBlog(null);
        axios.get(`${process.env.REACT_APP_API_URL}/blogs/${encodeURIComponent(id)}`)
            .then(res => { if (active && res.data.success) setBlog(res.data.data.blog); })
            .catch(() => { if (active) setBlog(null); })
            .finally(() => { if (active) setBlogLoading(false); });
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!blog) return;
        const oldTitle = document.title;
        document.title = blog.metaTitle || blog.title;
        let meta = document.querySelector('meta[name="description"]');
        const created = !meta;
        if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
        const oldDescription = meta.getAttribute('content');
        meta.setAttribute('content', blog.metaDescription || blog.description || '');
        return () => { document.title = oldTitle; if (created) meta.remove(); else if (oldDescription === null) meta.removeAttribute('content'); else meta.setAttribute('content', oldDescription); };
    }, [blog]);

    if (blogLoading) return <BlogDetailShimmer />;
    if (!blog) return <div className="blog-article-empty"><h1>Blog not found</h1><Link to="/blogs">Back to blogs</Link></div>;

    const blocks = blog.contentBlocks || [];
    const wordCount = [blog.description, ...blocks.flatMap(b => [b.title, ...(b.type?.includes('list') && b.items?.length ? b.items : [b.text])])].filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean).length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const date = blog.publishedAt || blog.createdAt;
    const validDate = date && !Number.isNaN(new Date(date).getTime());
    const renderBlock = (block, index) => {
        const type = block.type || (block.image ? 'text-image' : 'text');
        const image = block.image && <figure className="blog-article-block-image"><img src={resolveImageUrl(block.image)} alt={block.altText || ''} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
        const items = block.items?.length ? block.items : (block.text || '').split('\n').filter(line => line.trim());
        const heading = block.title && <h2>{block.title}</h2>;
        if (type === 'heading') return <h2 className="blog-article-heading" key={index}>{block.title || block.text}</h2>;
        if (type === 'quote') return <section className="blog-article-block" key={index}>{heading}<blockquote>{block.text}{block.attribution && <cite>— {block.attribution}</cite>}</blockquote></section>;
        if (type === 'bullet-list' || type === 'numbered-list') { const List = type === 'numbered-list' ? 'ol' : 'ul'; return <section className="blog-article-block" key={index}>{heading}<List>{items.map((item, i) => <li key={i}>{item}</li>)}</List></section>; }
        if (type === 'callout') return <aside className={`blog-article-callout ${block.calloutType || 'note'}`} key={index}>{heading}<strong>{block.calloutType || 'Note'}</strong><p>{block.text}</p></aside>;
        return <section className={`blog-article-block ${type === 'text-image' && block.image ? 'blog-article-media-row' : ''}`} key={index}>{image}<div>{heading}{type !== 'image' && block.text && <p>{block.text}</p>}</div></section>;
    };
    return <main className="blog-article-page"><article className="blog-article">
        {blog.featuredImage && <div className="blog-article-cover"><img src={resolveImageUrl(blog.featuredImage)} alt={blog.imageAltText || blog.title} loading="eager" /></div>}
        <div className="blog-article-tags">{blog.subcategory?.category?.name && <Link to="/blogs" className="blog-article-category">{blog.subcategory.category.name}</Link>}{blog.subcategory?.name && <span className="blog-article-subcategory">{blog.subcategory.name}</span>}</div>
        <header className="blog-article-header"><h1>{blog.title}</h1>{blog.subtitle && <p className="blog-article-subtitle">{blog.subtitle}</p>}
            <div className="blog-article-meta"><span><FiUser aria-hidden="true" /> By <strong>{blog.author || '1APP Team'}</strong></span>{validDate && <><span aria-hidden="true">•</span><time dateTime={new Date(date).toISOString()}>{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</time></>}<span aria-hidden="true">•</span><span><FiClock aria-hidden="true" /> {readMinutes} min read</span></div>
        </header>
        {blog.description && <p className="blog-article-intro">{blog.description}</p>}
        <div className="blog-article-content">{blocks.map(renderBlock)}</div>
        <footer className="blog-article-footer"><Link to="/blogs">← Back to blogs</Link></footer>
    </article></main>;
}
