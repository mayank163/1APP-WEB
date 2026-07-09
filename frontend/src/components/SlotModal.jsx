import React, { useState } from 'react';

const datesForNextDays = (days = 5) => {
    const arr = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        arr.push(d);
    }
    return arr;
};

const formatDateShort = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' });

const defaultTimes = ['04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM'];

const SlotModal = ({ open, onClose, onSelect, initial }) => {
    const [mode, setMode] = useState(initial ? 'scheduled' : 'instant');
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const [selectedTime, setSelectedTime] = useState(null);

    if (!open) return null;

    const dates = datesForNextDays(5);

    const handleConfirm = () => {
        if (mode === 'instant') {
            onSelect({ type: 'instant', etaMinutes: 50 });
        } else {
            if (!selectedTime) return;
            const date = dates[selectedDateIdx];
            onSelect({ type: 'scheduled', date: date.toISOString(), time: selectedTime });
        }
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: 680, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ padding: 18, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>When should the professional arrive?</h3>
                    <button onClick={onClose} style={{ border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, padding: 6 }}>✕</button>
                </div>

                <div style={{ padding: 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ border: '1px solid #e6e6e6', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'inline-block', background: '#e8f5e9', color: '#1b5e20', padding: '4px 8px', borderRadius: 6, fontWeight: 700, marginBottom: 4 }}>Instant</div>
                                <div style={{ color: '#555' }}>In 50 mins</div>
                            </div>
                            <input type="radio" name="slotMode" checked={mode === 'instant'} onChange={() => setMode('instant')} />
                        </label>

                        <label style={{ border: '1px solid #e6e6e6', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>Schedule for later</div>
                                <div style={{ color: '#888', fontSize: 13 }}>Select your preferred day & time</div>
                                {mode === 'scheduled' && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                            {dates.map((d, idx) => (
                                                <button key={idx} onClick={() => setSelectedDateIdx(idx)} style={{ padding: '10px 14px', borderRadius: 8, border: selectedDateIdx === idx ? '2px solid #6c47ff' : '1px solid #eaeaea', background: selectedDateIdx === idx ? '#fff' : '#fff', cursor: 'pointer' }}>
                                                    <div style={{ fontSize: 13 }}>{formatDateShort(d)}</div>
                                                </button>
                                            ))}
                                        </div>

                                        <div>
                                            <div style={{ marginBottom: 8, fontWeight: 700 }}>Select start time of service</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                                {defaultTimes.map(t => (
                                                    <button key={t} onClick={() => setSelectedTime(t)} style={{ padding: '12px 10px', borderRadius: 8, border: selectedTime === t ? '2px solid #6c47ff' : '1px solid #eaeaea', background: '#fff', cursor: 'pointer' }}>{t}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <input type="radio" name="slotMode" checked={mode === 'scheduled'} onChange={() => setMode('scheduled')} />
                        </label>
                    </div>
                </div>

                <div style={{ padding: 18, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={handleConfirm} disabled={mode === 'scheduled' && !selectedTime} style={{ background: '#6c47ff', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: (mode === 'scheduled' && !selectedTime) ? 0.6 : 1 }}>Proceed to checkout</button>
                </div>
            </div>
        </div>
    );
};

export default SlotModal;
