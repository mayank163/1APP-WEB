import '../styles/BlogDetail.css';
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
    if (!blog) return <div className="ui-blogdetail-1" >Blog not found.</div>;

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
                <div className="ui-blogdetail-2" key={index} >
                    <div className="ui-blogdetail-3" >
                        <img className="ui-blogdetail-4" src={img} alt={title}  />
                    </div>
                    <div className="ui-blogdetail-5" >{orderLabel}</div>
                    <h2 className="ui-blogdetail-6" >{title}</h2>
                    <p className="ui-blogdetail-7" >{body}</p>
                </div>
            );
        }

        // Pattern 1: image left, text right (light bg card)
        if (isEven === 1) {
            return (
                <div className="ui-blogdetail-8" key={index} >
                    <div className="ui-blogdetail-9" >
                        <img className="ui-blogdetail-10" src={img} alt={title}  />
                    </div>
                    <div className="ui-blogdetail-11" >
                        <div className="ui-blogdetail-12" >{orderLabel}</div>
                        <h2 className="ui-blogdetail-13" >{title}</h2>
                        <p className="ui-blogdetail-14" >{body}</p>
                    </div>
                </div>
            );
        }

        // Pattern 2: text center, full-width image below
        if (isEven === 2) {
            return (
                <div className="ui-blogdetail-15" key={index} >
                    <div className="ui-blogdetail-16" >{orderLabel}</div>
                    <h2 className="ui-blogdetail-17" >{title}</h2>
                    <p className="ui-blogdetail-18" >{body}</p>
                    <div className="ui-blogdetail-19" >
                        <img className="ui-blogdetail-20" src={img} alt={title}  />
                    </div>
                </div>
            );
        }

        // Pattern 3: text left, image right (dark bg card)
        return (
            <div className="ui-blogdetail-21" key={index} >
                <div className="ui-blogdetail-22" >
                    <div className="ui-blogdetail-23" >{orderLabel}</div>
                    <h2 className="ui-blogdetail-24" >{title}</h2>
                    <p className="ui-blogdetail-25" >{body}</p>
                    <button className="ui-blogdetail-26" >
                        Enquire About This
                    </button>
                </div>
                <div className="ui-blogdetail-27" >
                    <img className="ui-blogdetail-28" src={img} alt={title}  />
                    <div className="ui-blogdetail-29" >
                        "Quality speaks for itself."
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="ui-blogdetail-30" >

            {/* Breadcrumb */}
            <div className="ui-blogdetail-31" >
                <span className="ui-blogdetail-32"  onClick={() => navigate('/blogs')}>Blogs</span>
                <span className="ui-blogdetail-33" >›</span>
                <span>{blog.subcategory?.category?.name || 'Home'}</span>
            </div>

            {/* Title */}
            <h1 className="ui-blogdetail-34" >{blog.title}</h1>

            {/* Description */}
            <p className="ui-blogdetail-35" >
                {blog.description?.slice(0, 180)}
            </p>

            {/* Divider */}
            <div className="ui-blogdetail-36"  />

            {/* Content Blocks */}
            {blocks.map((block, i) => renderBlock(block, i))}

            {/* CTA Footer */}
            <div className="ui-blogdetail-37" >
                <h2 className="ui-blogdetail-38" >Ready to get started?</h2>
                <p className="ui-blogdetail-39" >
                    Consult with our 1APP experts to find the perfect solution for your needs.
                </p>
                <div className="ui-blogdetail-40" >
                    <button className="ui-blogdetail-41" >
                        Get a Free Quote
                    </button>
                    <button className="ui-blogdetail-42" onClick={() => navigate('/services')} >
                        View All Services
                    </button>
                </div>
            </div>
        </div>
    );
}
