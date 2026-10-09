import '../styles/AllCategoriesPopup.css';
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
        <div className="ui-allcategoriespopup-1"
            onClick={onClose}

        >
            <div className="ui-allcategoriespopup-2"
                onClick={(e) => e.stopPropagation()}

            >
                {/* Close button */}
                <button className="ui-allcategoriespopup-3"
                    onClick={onClose}

                >
                    <FaTimes />
                </button>

                <h2 className="ui-allcategoriespopup-4" >
                    All Services
                </h2>
                <p className="ui-allcategoriespopup-5" >
                    Browse all service categories
                </p>

                {categories.length === 0 ? (
                    <p className="ui-allcategoriespopup-6" >
                        No categories available yet.
                    </p>
                ) : (
                    <div className="ui-allcategoriespopup-7"

                    >
                        {categories.map((cat, idx) => (
                            <div className="ui-allcategoriespopup-8"
                                key={cat.id || cat._id || idx}
                                onClick={() => handleCategoryClick(cat)}



                            >
                                {/* Category image / icon */}
                                <div className="ui-allcategoriespopup-9"

                                >
                                    {cat.image ? (
                                        <img className="ui-allcategoriespopup-10"
                                            src={resolveCategoryImage(cat.image)}
                                            alt={cat.name}

                                            onError={(e) => { e.target.classList.add('ui-image-hidden'); }}
                                        />
                                    ) : (
                                        <FaTag size={24} color="#222" />
                                    )}
                                </div>

                                {/* Category name */}
                                <div className="ui-allcategoriespopup-11"

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
