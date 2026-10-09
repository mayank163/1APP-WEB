import '../styles/ImageUpload.css';
import React, { useRef } from 'react';
import { FaUpload, FaTimes } from 'react-icons/fa';

const BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';

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
                    <div className={["position-relative flex-shrink-0 admin-image-upload-1 ", small ? "admin-image-upload-state-1" : "admin-image-upload-state-2", " ", small ? "admin-image-upload-state-3" : "admin-image-upload-state-4"].join('')} >
                        <img src={preview} alt="preview" className="rounded border w-100 h-100 admin-image-upload-2"  />
                        <button type="button" onClick={() => { onClear?.(); if (ref.current) ref.current.value = ''; }}
                            className="btn btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center admin-image-upload-3"
                            >
                            <FaTimes />
                        </button>
                    </div>
                )}
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => ref.current?.click()}>
                    <FaUpload className="me-1 admin-image-upload-4"  />
                    {preview ? 'Change' : 'Choose'}
                </button>
                <input ref={ref} type="file" accept={accept} className="d-none"
                    onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); }} />
            </div>
        </div>
    );
};

export default ImageUpload;
