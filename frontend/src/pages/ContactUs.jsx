import '../styles/ContactUs.css';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

const COUNTRY_CODES = ['+91', '+1', '+44', '+971', '+65', '+61'];

const InfoCard = ({ title, children }) => (
    <div className="ui-contactus-1" >
        <h3 className="ui-contactus-2" >{title}</h3>
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




    return (
        <div className="ui-contactus-3" >

            {/* Left: Form */}
            <div>
                <h1 className="ui-contactus-4" >Contact us</h1>
                <p className="contact-intro">We are here to assist with any questions or support needs.</p>

                <form className="ui-contactus-5" onSubmit={handleSubmit} >
                    <div>
                        <label className="ui-contactus-6"  htmlFor="contact-name">Full Name</label>
                        <input className="ui-contactus-7" id="contact-name" name="name" required value={form.name} onChange={handleChange}
                            placeholder="Enter full name"  />
                    </div>

                    <div>
                        <label className="ui-contactus-8"  htmlFor="contact-email">Email Address</label>
                        <input className="ui-contactus-9" id="contact-email" name="email" type="email" required value={form.email} onChange={handleChange}
                            placeholder="Enter your email address"  />
                    </div>

                    <div>
                        <label className="ui-contactus-6" htmlFor="contact-phone">Enter Phone Number</label>
                    <div className="ui-contactus-10" >
    <select className="ui-contactus-11"
        aria-label="Country code"
        name="countryCode"
        value={form.countryCode}
        onChange={handleChange}

    >
        {COUNTRY_CODES.map(c => (
            <option key={c}>{c}</option>
        ))}
    </select>

    <input className="ui-contactus-12"
        id="contact-phone"
        name="phone"
        type="tel"
        value={form.phone}
        onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            if (value.length <= 10) {
                handleChange({
                    target: {
                        name: 'phone',
                        value
                    }
                });
            }
        }}
        maxLength={10}
        inputMode="numeric"
        placeholder="Phone Number"

    />
</div>
                    </div>

                    <div>
                        <label className="ui-contactus-13"  htmlFor="contact-message">Enter Message</label>
                        <textarea className="ui-contactus-14" id="contact-message" name="message" required rows={5} value={form.message} onChange={handleChange}
                            placeholder="Enter message"  />
                    </div>

                    <button className="ui-contactus-15" type="submit" disabled={submitting}
                        >
                        {submitting ? 'Sending...' : 'Submit'}
                    </button>
                </form>
            </div>

            {/* Right: Info Cards */}
            <div className="contact-info">
                <InfoCard title="Need help?">
                    <p className="ui-contactus-16" >
                        For any immediate help regarding your bookings, please log-in and visit our Help Center. You will be able to get instant resolution through our chat support.
                    </p>
                    <Link className="contact-card-action" to="/support">Open Help Center <FiChevronRight aria-hidden="true" /></Link>
                </InfoCard>

                <InfoCard title="Still facing issues?">
                    <p className="ui-contactus-17" >
                        If you've already tried chatting with us and are not satisfied with the resolution - please send us an email on{' '}
                        <a className="contact-email" href="mailto:contact@1app.com">contact@1app.com</a>. We will get back to you within 24-48 hours.
                    </p>
                </InfoCard>

                <InfoCard title="Media inquiries">
                    <p className="ui-contactus-18" >
                        For media inquiries, you can send us an email on{' '}
                        <a className="ui-contactus-19" href="mailto:contact@1app.com" >contact@1app.com</a>
                    </p>
                </InfoCard>

                <InfoCard title="What is our helpline number?">
                    <p className="ui-contactus-20" >
                        We have switched from a customer care phone number to a fast, simple-to-use chat based support. Just open our Help Center, select your issue, and initiate a chat with us.
                    </p>
                </InfoCard>

                <InfoCard title="Our office addresses">
                    <p className="ui-contactus-16">You can view a list of all our office addresses by clicking below</p>
                    <details className="contact-addresses">
                        <summary className="contact-card-action">View addresses <FiChevronRight aria-hidden="true" /></summary>
                        <p className="ui-contactus-23">6565 N MacArthur Blvd, Irving, TX 75039</p>
                    </details>
                </InfoCard>
            </div>
        </div>
    );
}
