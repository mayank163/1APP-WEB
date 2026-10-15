import React from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/AdminBreadcrumb.css';

const sections = {
    'Overview': [['/', 'dashboard']],
    'Customer Management': [['/users', 'users'], ['/services', 'services'], ['/bookings', 'bookings'], ['/plans', 'offers']],
    'Field Operations': [['/technician-jobs', 'technician_jobs'], ['/technician-verification', 'technician_verification']],
    'Content Management': [['/blogs', 'blogs']],
    'People & Support': [['/sub-admins', 'sub_admins'], ['/support', 'support'], ['/users', 'users']],
};

export default function AdminBreadcrumb({ className = '', section, items }) {
    const { can } = useAdminAuth();
    const destination = sections[section]?.find(([, resource]) => can(resource, 'read'))?.[0];
    const crumbs = [{ label: section, to: destination }, ...items];
    return <nav className={`admin-breadcrumb ${className}`} aria-label="Breadcrumb">
        {crumbs.map((item, index) => <React.Fragment key={`${index}-${item.label}`}>
            {index > 0 && <span className="admin-breadcrumb-separator" aria-hidden="true">/</span>}
            {index === crumbs.length - 1 ? <span aria-current="page">{item.label}</span>
                : item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button>
                : item.to ? <Link to={item.to}>{item.label}</Link>
                : <span>{item.label}</span>}
        </React.Fragment>)}
    </nav>;
}
