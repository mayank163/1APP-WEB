import { adminCssValue } from '../utils/adminCssValue.js';
import '../styles/AdminImage.css';
import React, { useState } from 'react';
import { FaImage } from 'react-icons/fa';

/**
 * AdminImage
 * ----------
 * Drop-in replacement for <img> that:
 *  - Shows a grey circular spinner while the image is loading
 *  - Shows a grey placeholder icon if the image fails to load (or if no src)
 *
 * Props:
 *   src          – image URL (required)
 *   alt          – alt text
 *   width        – container width  (default 60)
 *   height       – container height (default 60)
 *   radius       – border-radius CSS value (default 8px)
 *   objectFit    – CSS object-fit (default 'cover')
 *   className    – extra className applied to the outer wrapper
 *   style        – extra style applied to the outer wrapper
 *   imgClassName – extra className applied to <img>
 *   imgStyle     – extra style applied to <img>
 */
const AdminImage = ({
    src,
    alt = '',
    width = 60,
    height = 60,
    radius = 8,
    objectFit = 'cover',
    className = '',
    style = {},
    imgClassName = '',
    imgStyle = {},
}) => {
    const [status, setStatus] = useState(src ? 'loading' : 'error');


    return (
        <div className={`admin-image-container ${className}`} style={{
            '--admin-image-width': adminCssValue(width),
            '--admin-image-height': adminCssValue(height),
            '--admin-image-radius': adminCssValue(radius),
            ...style,
        }}>
            {/* ── Loading spinner (shown while image is fetching) ── */}
            {status === 'loading' && (
                <div className="admin-admin-image-1" >
                    <div className="admin-admin-image-2" style={{ "--admin-admin-image-2-width": adminCssValue(Math.max(16, Math.min(width, height) * 0.4)), "--admin-admin-image-2-height": adminCssValue(Math.max(16, Math.min(width, height) * 0.4)) }} />
                </div>
            )}

            {/* ── Placeholder (shown on error or missing src) ── */}
            {status === 'error' && (
                <div className="admin-admin-image-3" >
                    <FaImage
                        size={Math.max(12, Math.min(width, height) * 0.35)}
                        color="#bbb"
                    />
                </div>
            )}

            {/* ── Actual image ── */}
            {src && (
                <img
                    src={src}
                    alt={alt}
                    className={[`admin-image-content ${imgClassName}`, " ", status === 'loaded' ? "admin-admin-image-state-1" : "admin-admin-image-state-2"].join('')}
                    onLoad={() => setStatus('loaded')}
                    onError={() => setStatus('error')}
                    style={{ '--admin-image-fit': objectFit, ...imgStyle }}
                />
            )}
        </div>
    );
};

export default AdminImage;
