import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaTag } from 'react-icons/fa';
import serviceService from '../services/serviceService';

const UPLOAD_IMAGE_URL = `${process.env.REACT_APP_IMAGE_URL}`;

const resolveSubcategoryImage = (image) => {
    if (!image) return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    const filename = image.replace(/^\/uploads\//, '').replace(/^\//, '');
    return `${UPLOAD_IMAGE_URL}${filename}`;
};

const tileBgColors = [
    '#f5f0eb', '#f0f4ff', '#f0fff4', '#fff8f0',
    '#fdf0ff', '#f0faff', '#fffff0', '#fff0f5',
];

const CategoryPopup = ({ category, categoryId, subcategories, onClose }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleSubcategoryClick = async (sub) => {
        onClose();
        navigate(`/services?category=${categoryId}&subcategory=${sub._id}`);
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
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
                    maxWidth: '620px',
                    width: '100%',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    position: 'relative',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                }}
            >
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

                <h2 style={{ fontWeight: 800, fontSize: '1.75rem', marginBottom: '28px', color: '#111' }}>
                    {category}
                </h2>

                {subcategories.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '24px 0' }}>
                        No subcategories available yet.
                    </p>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '16px',
                    }}>
                        {subcategories.map((sub, idx) => (
                            <div
                                key={sub._id || idx}
                                onClick={() => handleSubcategoryClick(sub)}
                                style={{
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    padding: '16px 8px',
                                    borderRadius: '14px',
                                    background: tileBgColors[idx % tileBgColors.length],
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{
                                    width: '60px', height: '60px',
                                    borderRadius: '12px',
                                    background: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 10px',
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                }}>
                                    {sub.image ? (
                                        <img
                                            src={resolveSubcategoryImage(sub.icon)}
                                            alt={sub.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <FaTag size={24} color="#aaa" />
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#1a73e8',
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    wordBreak: 'break-word',
                                }}>
                                    {sub.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryPopup;
