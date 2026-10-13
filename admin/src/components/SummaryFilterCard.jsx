import React from 'react';
import '../styles/SummaryFilterCard.css';

export default function SummaryFilterCard({ active = false, className = '', children, ...props }) {
    return <button type="button" {...props} className={`summary-filter-card ${className}`} aria-pressed={active}>{children}</button>;
}
