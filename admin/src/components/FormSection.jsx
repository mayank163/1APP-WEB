import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FormSection = ({ title, children, defaultOpen = true, badge, required = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="card border-0 shadow-sm rounded-3 mb-3 overflow-hidden">
            <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3 px-4"
                style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold text-dark">{title}</span>
                    {required && <span className="text-danger small">*</span>}
                    {badge !== undefined && badge !== null && (
                        <span className="badge bg-primary rounded-pill" style={{ fontSize: 11 }}>{badge}</span>
                    )}
                </div>
                {open ? <FaChevronUp className="text-muted" /> : <FaChevronDown className="text-muted" />}
            </div>
            {open && <div className="card-body px-4 py-3">{children}</div>}
        </div>
    );
};

export default FormSection;
