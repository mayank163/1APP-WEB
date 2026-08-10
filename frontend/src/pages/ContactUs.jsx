import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt } from 'react-icons/fa';

const COUNTRY_CODES = ['+91', '+1', '+44', '+971', '+65', '+61'];

const InfoCard = ({ title, children }) => (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 800, fontSize: '15px', marginBottom: 8 }}>{title}</h3>
        {children}
    </div>
);

export default function ContactUs() {
    const [form, setForm] = useState({ name: '', email: '', countryCode: '+91', phone: '', message: '' });
    const [submitting, setSubmitting] = useState(false);

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await new Promise(r => setTimeout(r, 800));
        toast.success('Message sent! We\'ll get back to you within 24-48 hours.');
        setForm({ name: '', email: '', countryCode: '+91', phone: '', message: '' });
        setSubmitting(false);
    };

    const inputStyle = {
        width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8,
        fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#333', background: '#fff'
    };
    const labelStyle = { fontSize: '13px', fontWeight: 700, color: '#111', display: 'block', marginBottom: 6 };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 48, alignItems: 'start' }}>

            {/* Left: Form */}
            <div>
                <h1 style={{ fontWeight: 800, fontSize: '2rem', marginBottom: 32 }}>Contact us</h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label style={labelStyle}>Full Name</label>
                        <input name="name" required value={form.name} onChange={handleChange}
                            placeholder="Enter full name" style={inputStyle} />
                    </div>

                    <div>
                        <label style={labelStyle}>Email Address</label>
                        <input name="email" type="email" required value={form.email} onChange={handleChange}
                            placeholder="Enter your email address" style={inputStyle} />
                    </div>

                    <div>
                        <label style={labelStyle}>Enter Phone Number</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select name="countryCode" value={form.countryCode} onChange={handleChange}
                                style={{ ...inputStyle, width: 90, flexShrink: 0 }}>
                                {COUNTRY_CODES.map(c => <option key={c}>{c}</option>)}
                            </select>
                            <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                                placeholder="Phone Number" style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Enter Message</label>
                        <textarea name="message" required rows={5} value={form.message} onChange={handleChange}
                            placeholder="Enter message" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <button type="submit" disabled={submitting}
                        style={{ background: '#000000', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', width: 'fit-content' }}>
                        {submitting ? 'Sending...' : 'Submit'}
                    </button>
                </form>
            </div>

            {/* Right: Info Cards */}
            <div>
                <InfoCard title="Need help?">
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, marginBottom: 10 }}>
                        For any immediate help regarding your bookings, please log-in and visit our Help Center. You will be able to get instant resolution through our chat support.
                    </p>
                    <a href="#" style={{ color: '#000000', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Open Help Center &rsaquo;</a>
                </InfoCard>

                <InfoCard title="Still facing issues?">
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7 }}>
                        If you've already tried chatting with us and are not satisfied with the resolution - please send us an email on{' '}
                        <strong>contact@1appweb.com</strong>. We will get back to you within 24-48 hours.
                    </p>
                </InfoCard>

                <InfoCard title="Media inquiries">
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7 }}>
                        For media inquiries, you can send us an email on{' '}
                        <a href="mailto:contact@1appweb.com" style={{ color: '#000', fontWeight: 700, textDecoration: 'none' }}>contact@1appweb.com</a>
                    </p>
                </InfoCard>

                <InfoCard title="What is our helpline number?">
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7 }}>
                        We have switched from a customer care phone number to a fast, simple-to-use chat based support. Just open our Help Center, select your issue, and initiate a chat with us.
                    </p>
                </InfoCard>

                <InfoCard title="Our office addresses">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <FaMapMarkerAlt size={16} style={{ color: '#111', marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
                            4404 Westminster Dr, Irving, TX 75038, US
                        </p>
                    </div>
                </InfoCard>
            </div>
        </div>
    );
}
