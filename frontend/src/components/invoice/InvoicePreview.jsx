import '../../styles/InvoicePreview.css';
import React, { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Modal from 'react-bootstrap/Modal';
import { FiGlobe, FiPhone, FiMail, FiHome, FiMapPin, FiTool, FiUser, FiFileText, FiHeadphones, FiDownload, FiPrinter } from 'react-icons/fi';
import bookingService from '../../services/bookingService';
import { getInvoiceStyles } from './invoiceStyles';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
const invoiceNumber = booking => booking.invoiceNumber || `INV-${String(booking._id).slice(-8).toUpperCase()}`;
const terms = [
    ['Services Provided', 'We offer home installation, repair and support services, including device installation and setup, diagnostics and troubleshooting, network setup and support, and maintenance and repair.'],
    ['Service Limitations', 'We do not guarantee that we will be able to fix all issues. Services are provided as available, except as explicitly stated in writing.'],
    ['Customer Responsibilities', 'Please provide accurate information about your devices and back up important data before service.'],
    ['Estimates and Payment', 'We provide an estimate before beginning work. Payment is due upon completion of the services using an available payment method.'],
    ['Liability', 'Our liability is limited to the cost of the services provided, subject to applicable law.'],
    ['Confidentiality', 'We keep your personal information confidential and use it to provide services or as required by law.'],
    ['Termination and Refusal of Service', 'We reserve the right to refuse or terminate service for reasons including abusive behavior or failure to pay.'],
    ['Dispute Resolution', 'Please contact our support team to resolve any service concerns.'],
    ['Changes to Terms', 'The applicable terms of service govern your booking.']
];
const Contacts = () => <div className="invoice-contacts"><span><FiGlobe /> www.1app.com</span><span><FiPhone /> +1 (253) 3667 557</span><span><FiMail /> support@1app.com</span></div>;
const Details = ({ rows }) => <dl className="invoice-details">{rows.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd><span className="invoice-colon">:</span>{value || 'N/A'}</dd></React.Fragment>)}</dl>;
const Section = ({ icon: Icon, title, children }) => <section className="invoice-section"><h3><Icon /> {title}</h3>{children}</section>;

export const InvoiceDocument = ({ booking }) => {
    const user = typeof booking.user === 'object' && booking.user ? booking.user : {};
    const address = booking.address || {};
    const addressText = typeof address === 'string' ? address : [address.addressLine, address.city, address.state, address.zipcode].filter(Boolean).join(', ');
    const total = Number(booking.totalAmount) || 0;
    const paid = String(booking.paymentStatus).toLowerCase() === 'paid';
    const subtotal = (booking.services || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    return <article className="invoice-paper">
        <header className="invoice-header"><div><div className="invoice-logo"><span>1</span> APP</div><Contacts /></div><div className="invoice-heading"><h1>INVOICE</h1><strong># {invoiceNumber(booking)}</strong></div></header>
        <div className="invoice-overview"><section className="invoice-bill"><h3><FiHome /> BILL TO</h3><strong>{user.name || 'Valued Customer'}</strong><div>{user.email || 'N/A'}</div><div>{booking.phone || user.phone || 'N/A'}</div><p><FiMapPin />{addressText || 'N/A'}</p></section>
            <Details rows={[
                ['Invoice Number', invoiceNumber(booking)], ['Invoice Date', date(booking.createdAt)], ['Booking ID', booking._id], ['Scheduled Date', date(booking.serviceDate)],
                ['Status', <span className="invoice-badge">{booking.status}</span>], ['Payment Status', <span className="invoice-badge">{booking.paymentStatus || 'Pending'}</span>]
            ]} />
        </div>
        <Section icon={FiTool} title="SERVICES ORDERED"><div className="invoice-table-wrap"><table><thead><tr><th>#</th><th>Service Name</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>{(booking.services || []).map((item, i) => <tr key={item._id || i}><td>{i + 1}</td><td>{item.service?.name || 'Service'}{item.variantName && <small>{item.variantName}</small>}{item.selectedAddons?.map((addon, index) => <small key={index}>+ {addon.name}</small>)}</td><td>x{item.quantity || 1}</td><td>{money(item.price)}</td><td>{money((Number(item.price) || 0) * (Number(item.quantity) || 1))}</td></tr>)}</tbody></table></div></Section>
        <div className="invoice-totals"><div><strong>Subtotal</strong><span>{money(subtotal)}</span></div>{Math.abs(total - subtotal) > 0.005 && <div><strong>Adjustments</strong><span>{money(total - subtotal)}</span></div>}<div className="invoice-total"><strong>Total Amount</strong><strong>{money(total)}</strong></div>{paid && <div><strong>Payment received</strong><span>({money(total)})</span></div>}<div className="invoice-balance"><strong>Balance Due</strong><strong>{money(paid ? 0 : total)}</strong></div></div>
        <Section icon={FiUser} title="CUSTOMER DETAILS"><div className="invoice-customer"><Details rows={[['Name', user.name || 'Valued Customer'], ['Email', user.email], ['Phone', booking.phone || user.phone]]} /><Details rows={[['Address', typeof address === 'string' ? address : address.addressLine], ['City', address.city], ['State', address.state], ['ZIP Code', address.zipcode]]} /></div></Section>
        <Section icon={FiFileText} title="TERMS OF SERVICE"><div className="invoice-terms"><p>Welcome to OneApp. These Terms of Service govern your use of our home service platform.</p><div className="invoice-terms-columns"><div>{terms.slice(0, 4).map(([title, text], i) => <div className="invoice-term" key={title}><strong>{i + 1}. {title}</strong><p>{text}</p></div>)}</div><div>{terms.slice(4).map(([title, text], i) => <div className="invoice-term" key={title}><strong>{i + 5}. {title}</strong><p>{text}</p></div>)}<aside className="invoice-help"><FiHeadphones /><div><strong>Need Help?</strong><p>For questions or support, please contact us:</p><Contacts /></div></aside></div></div></div></Section>
        <footer className="invoice-footer"><div><strong>Thank you for choosing OneApp!</strong><p>All services, one app.</p></div><p>All fees are listed in USD and are subject to applicable taxes.</p></footer>
    </article>;
};

export default function InvoicePreview({ bookingId, onClose }) {
    const [booking, setBooking] = useState(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const printFrame = useRef(null);
    useEffect(() => {
        let active = true;
        setError('');
        bookingService.getBookingDetails(bookingId).then(response => {
            if (!response.success || !response.data?.booking) throw new Error('Missing booking');
            if (active) setBooking(response.data.booking);
        }).catch(() => { if (active) setError('Unable to load invoice. Please try again.'); });
        return () => { active = false; };
    }, [bookingId, attempt]);
    const documentHtml = () => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneApp Invoice</title><style>${getInvoiceStyles()}</style></head><body>${renderToStaticMarkup(<InvoiceDocument booking={booking} />)}</body></html>`;
    const download = () => {
        const url = URL.createObjectURL(new Blob([documentHtml()], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${booking._id}.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <Modal show onHide={onClose} size="xl" centered scrollable aria-labelledby="invoice-preview-title" dialogClassName="invoice-preview-dialog">

        <Modal.Header closeButton><Modal.Title id="invoice-preview-title">Invoice Preview</Modal.Title></Modal.Header>
        <Modal.Body>{error ? <div role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : booking ? <InvoiceDocument booking={booking} /> : <p role="status">Loading invoice…</p>}</Modal.Body>
        <Modal.Footer><button type="button" className="invoice-button secondary" onClick={onClose}>Close</button><button type="button" className="invoice-button secondary" disabled={!booking} onClick={() => { printFrame.current.srcdoc = documentHtml(); }}><FiPrinter /> Print / Save as PDF</button><button type="button" className="invoice-button" disabled={!booking} onClick={download}><FiDownload /> Download Invoice</button></Modal.Footer>
        <iframe className="ui-invoicepreview-1" ref={printFrame} title="Printable invoice"  onLoad={() => { if (printFrame.current?.getAttribute('srcdoc')) { printFrame.current.contentWindow.focus(); printFrame.current.contentWindow.print(); } }} />
    </Modal>;
}
