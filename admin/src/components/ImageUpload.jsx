import React, { useRef } from 'react';
import { FaUpload, FaTimes } from 'react-icons/fa';

const BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

const ImageUpload = ({ file, existingUrl, onChange, onClear, label = 'Upload Image', accept = 'image/*', small = false }) => {
    const ref = useRef();
    const preview = file
        ? URL.createObjectURL(file)
        : existingUrl
            ? (existingUrl.startsWith('http') ? existingUrl : `${BASE}/uploads/${existingUrl}`)
            : null;

    const size = small ? 56 : 80;

    return (
        <div>
            {label && <label className="form-label small fw-semibold text-muted d-block mb-1">{label}</label>}
            <div className="d-flex align-items-center gap-2 flex-wrap">
                {preview && (
                    <div className="position-relative flex-shrink-0" style={{ width: size, height: size }}>
                        <img src={preview} alt="preview" className="rounded border w-100 h-100" style={{ objectFit: 'cover' }} />
                        <button type="button" onClick={() => { onClear?.(); if (ref.current) ref.current.value = ''; }}
                            className="btn btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center"
                            style={{ width: 18, height: 18, fontSize: 9, borderRadius: '50%', transform: 'translate(40%,-40%)' }}>
                            <FaTimes />
                        </button>
                    </div>
                )}
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => ref.current?.click()}>
                    <FaUpload className="me-1" style={{ fontSize: 11 }} />
                    {preview ? 'Change' : 'Choose'}
                </button>
                <input ref={ref} type="file" accept={accept} className="d-none"
                    onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); }} />
            </div>
        </div>
    );
};

export default ImageUpload;
