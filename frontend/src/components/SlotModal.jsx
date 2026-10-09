import { cssValue } from '../utils/cssValue';
import '../styles/SlotModal.css';
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
        <div className="ui-slotmodal-1" >
            <div className="ui-slotmodal-2" >
                <div className="ui-slotmodal-3" >
                    <h3 className="ui-slotmodal-4" >When do you need the service?</h3>
                    <button className="ui-slotmodal-5" onClick={onClose} >✕</button>
                </div>
                <div className="ui-slotmodal-6" >
                    {PERIODS.map(option => (
                        <label className="ui-slotmodal-7" key={option.value} style={{ "--ui-slotmodal-7-border": cssValue(period === option.value ? '2px solid #000' : '1px solid #e6e6e6', "border") }}>
                            <span className="ui-slotmodal-8" >{option.label}</span>
                            <input type="radio" name="bookingPeriod" checked={period === option.value} onChange={() => setPeriod(option.value)} />
                        </label>
                    ))}
                </div>
                <div className="ui-slotmodal-9" >
                    <button className="ui-slotmodal-10" onClick={handleConfirm} >Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default SlotModal;
