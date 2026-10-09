import '../styles/CategoryPopup.css';
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
        <div className="ui-categorypopup-1"
            onClick={onClose}

        >
            <div className="ui-categorypopup-2"
                onClick={(e) => e.stopPropagation()}

            >
                <button className="ui-categorypopup-3"
                    onClick={onClose}

                >
                    <FaTimes />
                </button>

                <h2 className="ui-categorypopup-4" >
                    {category}
                </h2>

                {subcategories.length === 0 ? (
                    <p className="ui-categorypopup-5" >
                        No subcategories available yet.
                    </p>
                ) : (
                    <div className="ui-categorypopup-6"

                    >
                        {subcategories.map((sub, idx) => (
                            <div className="ui-categorypopup-7"
                                key={sub._id || idx}
                                onClick={() => handleSubcategoryClick(sub)}



                            >
                                {/* Icon */}
                                <div className="ui-categorypopup-8"

                                >
                                    {sub.icon ? (
                                        <img className="ui-categorypopup-9"
                                            src={resolveSubcategoryImage(sub.icon)}
                                            alt={sub.name}

                                        />
                                    ) : (
                                        <FaTag size={24} color="#222" />
                                    )}
                                </div>

                                {/* Label */}
                                <div className="ui-categorypopup-10"

                                >
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
