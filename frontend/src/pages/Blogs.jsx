import { cssValue } from '../utils/cssValue';
import '../styles/Blogs.css';
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
    const featuredTwo = filteredBlogs.filter(blog => blog.isFeatured).slice(0, 2);
    const otherBlogs = filteredBlogs.slice(0, 5);

    const scroll = (ref, dir) => ref.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

    const Tag = ({ label }) => (
        <span className="ui-blogs-1" >{label}</span>
    );

    const BlogCard = ({ blog, onClick }) => (
        <div className="ui-blogs-2" onClick={onClick} >
            <div className="ui-blogs-3" >
                <img className="ui-blogs-4"
                    src={resolveImg(blog.featuredImage)}
                    alt={blog.imageAltText || blog.title}

                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                />
            </div>
            <Tag label={blog.subcategory?.category?.name || 'BLOG'} />
            <div className="ui-blogs-5" >{blog.title}</div>
        </div>
    );

    const ScrollRow = ({ items, refEl, label }) => (
        <div className="ui-blogs-6" >
            {label && <h2 className="ui-blogs-7" >{label}</h2>}
            <div className="ui-blogs-8" >
                <div className="ui-blogs-9"
                    ref={refEl}

                >
                    {items.map((b, i) => (
                        <BlogCard key={b._id + i} blog={b} onClick={() => navigate(`/blogs/${b.slug || b._id}`)} />
                    ))}
                </div>
                {items.length > 4 && (
                    <>
                        <button className="ui-blogs-10" onClick={() => scroll(refEl, -1)} >‹</button>
                        <button className="ui-blogs-11" onClick={() => scroll(refEl, 1)} >›</button>
                    </>
                )}
            </div>
        </div>
    );

    const EmptyState = () => {
        const cat = categories.find(c => c._id === activeTab);
        return (
            <div className="ui-blogs-12" >
                <div className="ui-blogs-13" >📭</div>
                <h3 className="ui-blogs-14" >
                    No blogs in {cat?.name || 'this category'} yet
                </h3>
                <p className="ui-blogs-15" >
                    We're working on bringing you great content here. Check back soon or explore other categories.
                </p>
                <button className="ui-blogs-16"
                    onClick={() => setActiveTab(null)}

                >
                    Browse All Blogs
                </button>
            </div>
        );
    };

    if (loading) return <BlogsShimmer />;

    return (
        <div className="ui-blogs-17" >

            {/* ── Header ── */}
            <h2 className="ui-blogs-18" >Checkout Our Latest Blogs</h2>

            {/* ── Hero Section (only when blogs exist) ── */}
            {filteredBlogs.length > 0 && (
                <div className="ui-blogs-19" >
                    {hero && (
                        <div className="ui-blogs-20" onClick={() => navigate(`/blogs/${hero.slug || hero._id}`)} >
                            <div className="ui-blogs-21" >
                                <img className="ui-blogs-22"
                                    src={resolveImg(hero.featuredImage)}
                                    alt={hero.title}

                                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                />
                            </div>
                            <Tag label={hero.subcategory?.category?.name || 'BLOG'} />
                            <h3 className="ui-blogs-23" >{hero.title}</h3>
                            <p className="ui-blogs-24" >{hero.description?.slice(0, 80)}</p>
                        </div>
                    )}
                    <div className="ui-blogs-25" >
                        {sideBlogs.map(b => (
                            <div className="ui-blogs-26" key={b._id} onClick={() => navigate(`/blogs/${b.slug || b._id}`)} >
                                <div className="ui-blogs-27" >
                                    <img className="ui-blogs-28"
                                        src={resolveImg(b.featuredImage)}
                                        alt={b.title}

                                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                    />
                                </div>
                                <div>
                                    <Tag label={b.subcategory?.category?.name || 'BLOG'} />
                                    <div className="ui-blogs-29" >{b.title}</div>
                                    <div className="ui-blogs-30" >{b.description?.slice(0, 40)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="ui-blogs-31" >
                <div className="ui-blogs-32" >
                    {[{ _id: null, name: 'All' }, ...categories].map(cat => {
                        const isActive = activeTab === cat._id;
                        return (
                            <button className="ui-blogs-33"
                                key={cat._id ?? 'all'}
                                onClick={() => setActiveTab(cat._id)}
                                style={{ "--ui-blogs-33-background": cssValue(isActive ? "var(--ui-color-27)" : "var(--ui-color-35)", "background"), "--ui-blogs-33-color": cssValue(isActive ? "var(--ui-color-2)" : "var(--ui-color-41)", "color"), "--ui-blogs-33-font-weight": cssValue(isActive ? 700 : 500, "fontWeight") }}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
                <div className="ui-blogs-34"  />
            </div>

            {/* ── Empty State ── */}
            {filteredBlogs.length === 0 && <EmptyState />}

            {/* ── Grid Rows (horizontal scroll) ── */}
            {gridRow1.length > 0 && <ScrollRow items={gridRow1} refEl={row1Ref} />}
            {gridRow2.length > 0 && <ScrollRow items={gridRow2} refEl={row2Ref} />}

            {/* ── Featured Two Cards ── */}
            {featuredTwo.length >= 2 && (
                <div className="ui-blogs-35" >
                    {featuredTwo.map(b => (
                        <div className="ui-blogs-36" key={b._id} onClick={() => navigate(`/blogs/${b.slug || b._id}`)} >
                            <div className="ui-blogs-37" >
                                <img className="ui-blogs-38"
                                    src={resolveImg(b.featuredImage)}
                                    alt={b.title}

                                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'; }}
                                />
                            </div>
                            <div>
                                <Tag label={b.subcategory?.category?.name || 'BLOG'} />
                                <div className="ui-blogs-39" >{b.title}</div>
                                <div className="ui-blogs-40" >{b.description?.slice(0, 50)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
