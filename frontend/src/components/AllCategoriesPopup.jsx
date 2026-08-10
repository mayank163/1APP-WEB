import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaTag } from 'react-icons/fa';

const UPLOAD_IMAGE_URL = `${process.env.REACT_APP_IMAGE_URL}`;

const resolveCategoryImage = (image) => {
    if (!image) return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    const filename = image.replace(/^\/uploads\//, '').replace(/^\//, '');
    return `${UPLOAD_IMAGE_URL}${filename}`;
};

/**
 * AllCategoriesPopup
 * Shows all top-level categories as tiles.
 * Clicking a category:
 *   - If it has subcategories → opens the existing CategoryPopup (via onCategorySelect)
 *   - Otherwise → navigates directly to /services?category=ID
 *
 * Props:
 *   categories      – array of category objects from the API
 *   onClose         – called to close this popup
 *   onCategorySelect – called with the category object when user picks one that has subs
 */
const AllCategoriesPopup = ({ categories, onClose, onCategorySelect }) => {
    const navigate = useNavigate();

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Prevent body scroll while open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleCategoryClick = (cat) => {
        if (cat.subcategories && cat.subcategories.length > 0) {
            onClose();
            onCategorySelect(cat);
        } else {
            onClose();
            navigate(`/services?category=${cat.id || cat._id}`);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                zIndex: 1050,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: '20px',
                    padding: '36px 32px 32px',
                    maxWidth: '720px',
                    width: '100%',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    position: 'relative',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        width: '36px', height: '36px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#f0f0f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: '#333',
                    }}
                >
                    <FaTimes />
                </button>

                <h2 style={{ fontWeight: 800, fontSize: '1.75rem', marginBottom: '6px', color: '#111' }}>
                    All Services
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>
                    Browse all service categories
                </p>

                {categories.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '24px 0' }}>
                        No categories available yet.
                    </p>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: '18px',
                            marginTop: '20px',
                        }}
                    >
                        {categories.map((cat, idx) => (
                            <div
                                key={cat.id || cat._id || idx}
                                onClick={() => handleCategoryClick(cat)}
                                style={{
                                    cursor: 'pointer',
                                    background: '#fff',
                                    border: '1.5px solid #222',
                                    borderRadius: '18px',
                                    padding: '14px 8px 12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    minHeight: '110px',
                                    boxShadow: '0 0 0 2px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.08)',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f5f5f5';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.15)';
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.08)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Category image / icon */}
                                <div
                                    style={{
                                        width: '54px',
                                        height: '54px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '8px',
                                        flexShrink: 0,
                                    }}
                                >
                                    {cat.image ? (
                                        <img
                                            src={resolveCategoryImage(cat.image)}
                                            alt={cat.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                display: 'block',
                                            }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <FaTag size={24} color="#222" />
                                    )}
                                </div>

                                {/* Category name */}
                                <div
                                    style={{
                                        color: '#1a1a1a',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        lineHeight: 1.35,
                                        wordBreak: 'break-word',
                                        maxWidth: '90%',
                                    }}
                                >
                                    {cat.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllCategoriesPopup;
