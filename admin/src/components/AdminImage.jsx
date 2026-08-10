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

    const containerStyle = {
        position: 'relative',
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
    };

    return (
        <div className={className} style={containerStyle}>
            {/* ── Loading spinner (shown while image is fetching) ── */}
            {status === 'loading' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f0f0f0',
                    zIndex: 1,
                }}>
                    <div style={{
                        width: Math.max(16, Math.min(width, height) * 0.4),
                        height: Math.max(16, Math.min(width, height) * 0.4),
                        borderRadius: '50%',
                        border: '2px solid #d0d0d0',
                        borderTopColor: '#999',
                        animation: 'adminImgSpin 0.75s linear infinite',
                    }} />
                </div>
            )}

            {/* ── Placeholder (shown on error or missing src) ── */}
            {status === 'error' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f0f0f0',
                    flexDirection: 'column',
                    gap: 4,
                }}>
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
                    className={imgClassName}
                    onLoad={() => setStatus('loaded')}
                    onError={() => setStatus('error')}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit,
                        display: status === 'loaded' ? 'block' : 'none',
                        ...imgStyle,
                    }}
                />
            )}

            {/* ── Keyframe injected once via a style tag ── */}
            <style>{`
                @keyframes adminImgSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AdminImage;
