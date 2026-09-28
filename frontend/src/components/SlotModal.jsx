import React, { useState } from 'react';

const PERIODS = [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
];

const getDateForPeriod = (period) => {
    const date = new Date();
    if (period === 'tomorrow') date.setDate(date.getDate() + 1);
    if (period === 'week') date.setDate(date.getDate() + (7 - date.getDay() || 7));
    if (period === 'month') date.setMonth(date.getMonth() + 1, 1);
    return date.toISOString();
};

const SlotModal = ({ open, onClose, onSelect, initial }) => {
    const [period, setPeriod] = useState(initial?.period || 'today');

    if (!open) return null;

    const handleConfirm = () => {
        onSelect({ period, date: getDateForPeriod(period) });
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: 420, maxWidth: '90vw', background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ padding: 18, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>When do you need the service?</h3>
                    <button onClick={onClose} style={{ border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, padding: 6 }}>✕</button>
                </div>
                <div style={{ padding: 18, display: 'grid', gap: 10 }}>
                    {PERIODS.map(option => (
                        <label key={option.value} style={{ border: period === option.value ? '2px solid #000' : '1px solid #e6e6e6', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                            <span style={{ fontWeight: 700 }}>{option.label}</span>
                            <input type="radio" name="bookingPeriod" checked={period === option.value} onChange={() => setPeriod(option.value)} />
                        </label>
                    ))}
                </div>
                <div style={{ padding: 18, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={handleConfirm} style={{ background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default SlotModal;
