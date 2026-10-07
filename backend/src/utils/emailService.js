'use strict';

const nodemailer = require('nodemailer');

// Transporter is created lazily so dotenv is always loaded before first use
let _transporter = null;
const getTransporter = () => {
    if (!_transporter) {
        _transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false, // TLS via STARTTLS on port 587
            auth: {
                user: process.env.SMTP_USER || 'apikey',
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return _transporter;
};

const FROM = () =>
    `"${process.env.FROM_NAME || '1APP Services'}" <${process.env.FROM_EMAIL || 'noreply@1app.com'}>`;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const siteBase = () => String(process.env.CLIENT_URL || '').replace(/\/+$/, '');
const appLink = (path) => siteBase() ? `${siteBase()}${path}` : '';
const actionButton = (label, path) => {
    const href = appLink(path);
    return href ? `<p style="margin:24px 0 8px;text-align:center;"><a class="button" href="${escapeHtml(href)}">${escapeHtml(label)} &nbsp; &rarr;</a></p>` : '';
};

const layout = (bodyHtml, previewText = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>1APP</title>
  <style>
        * { box-sizing: border-box; }
    body { margin: 0; background: #f1f2f4; color: #17191f; font-family: Arial, Helvetica, sans-serif; }
    a { color: inherit; }
    .outer { width: 100%; padding: 22px 12px; }
    .wrapper { width: 100%; max-width: 680px; margin: 0 auto; }
    .header { background: #08090b; border-radius: 14px; padding: 18px 24px; }
    .header-table, .footer-table { width: 100%; border-collapse: collapse; }
    .header-logo { color: #fff; font-size: 23px; font-weight: 800; letter-spacing: -0.5px; }
    .header-nav { color: #e5e7eb; text-align: right; font-size: 12px; white-space: nowrap; }
    .header-nav a { color: #e5e7eb; text-decoration: none; padding-left: 18px; }
    .body { margin: 16px 0; padding: 26px; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; }
    .hero { display: table; width: 100%; margin-bottom: 24px; padding: 24px; border-radius: 12px; background: #f3f4f6; }
    .hero-copy, .hero-icon { display: table-cell; vertical-align: middle; }
    .hero-eyebrow { color: #687386; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
    .hero h1 { margin: 8px 0 6px; color: #111318; font-size: 27px; line-height: 1.15; }
    .hero p { margin: 0; color: #596273; font-size: 14px; line-height: 1.55; }
    .hero-icon { width: 72px; text-align: right; color: #20242c; font-size: 42px; }
    .hero.confirmed, .hero.completed { background: #f6f1ea; }
    .hero.cancelled, .hero.action { background: #f3f4f6; }
    .greeting { margin: 0 0 7px; font-size: 19px; font-weight: 700; }
    .text { margin: 0 0 14px; color: #525b6b; font-size: 14px; line-height: 1.65; }
    .detail-card { margin: 20px 0; padding: 18px 20px; border: 1px solid #e2e5ea; border-radius: 12px; }
    .detail-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; }
    .detail-subtitle { margin-bottom: 12px; color: #8b93a1; font-size: 9px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; }
    .detail-row { width: 100%; border-collapse: collapse; }
    .detail-row td { padding: 9px 0; border-top: 1px solid #eef0f2; font-size: 12px; line-height: 1.45; vertical-align: top; }
    .detail-row tr:first-child td { border-top: 0; }
    .detail-label { width: 38%; padding-right: 12px !important; color: #737d8c; }
    .detail-value { color: #17191f; font-weight: 600; text-align: right; }
    .total-row .detail-value { font-size: 16px; }
    .note { margin: 18px 0; padding: 14px 16px; border-radius: 10px; background: #f4f5f7; color: #525b6b; font-size: 12px; line-height: 1.6; }
    .button { display: inline-block; padding: 13px 24px; border-radius: 9px; background: #111214; color: #fff !important; font-size: 13px; font-weight: 700; text-decoration: none; }
    .otp { margin: 22px 0; padding: 18px; border-radius: 10px; background: #f3f4f6; color: #111318; font-family: monospace; font-size: 30px; font-weight: 800; letter-spacing: 8px; text-align: center; }
    .footer { padding: 18px 22px; border-radius: 14px; background: #08090b; color: #fff; }
    .footer-logo { color: #fff; font-size: 18px; font-weight: 800; }
    .footer-copy { margin-top: 4px; color: #a7aab2; font-size: 11px; line-height: 1.5; }
    .footer-links { color: #d5d7dc; text-align: right; font-size: 11px; }
    .footer-links a { color: #d5d7dc; text-decoration: none; }
    .copyright { padding-top: 15px; color: #858992; font-size: 10px; text-align: center; }
    @media only screen and (max-width: 520px) {
      .outer { padding: 10px 7px; }
      .header { padding: 15px; }
      .header-nav a { padding-left: 9px; font-size: 10px; }
      .body { padding: 18px 14px; }
      .hero { padding: 18px 15px; }
      .hero h1 { font-size: 23px; }
      .hero-icon { width: 48px; font-size: 32px; }
      .detail-card { padding: 15px 13px; }
      .detail-label { width: 34%; }
      .footer { padding: 16px 14px; }
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>` : ''}
  <div class="outer"><div class="wrapper">
    <div class="header"><table class="header-table" role="presentation"><tr>
      <td class="header-logo">1APP</td>
    <td class="header-nav">${siteBase() ? `<a href="${escapeHtml(appLink('/services'))}">Services</a><a href="${escapeHtml(appLink('/support'))}">Support</a><a href="mailto:support@1app.com">Contact</a>` : '<a href="mailto:support@1app.com">Contact</a>'}</td>
    </tr></table></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer"><table class="footer-table" role="presentation"><tr>
      <td><div class="footer-logo">1APP</div><div class="footer-copy">Book trusted professionals.<br />Get things done.</div></td>
      <td class="footer-links"><a href="mailto:support@1app.com">Help &amp; Support</a>${siteBase() ? ` &nbsp; | &nbsp; <a href="${escapeHtml(appLink('/privacy-policy'))}">Privacy</a>` : ''}</td>
    </tr></table><div class="copyright">&copy; ${new Date().getFullYear()} 1APP Services. All rights reserved.</div></div>
  </div></div>
</body>
</html>`;

const hero = (eyebrow, title, description, icon, tone = 'action') => `
  <div class="hero ${tone}"><div class="hero-copy"><div class="hero-eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="hero-icon" aria-hidden="true">${icon}</div></div>`;

const detailCard = (title, rows, subtitle = 'ACCOUNT DETAILS') => `
  <div class="detail-card"><h2 class="detail-title">${escapeHtml(title)}</h2><div class="detail-subtitle">${escapeHtml(subtitle)}</div>
    <table class="detail-row" role="presentation"><tbody>${rows.map(([label, value, className = '']) => `<tr class="${className}"><td class="detail-label">${escapeHtml(label)}</td><td class="detail-value">${value}</td></tr>`).join('')}</tbody></table>
  </div>`;

// ─────────────────────────────────────────────────────────────────────────────
// Booking detail block (shared across booking emails)
// ─────────────────────────────────────────────────────────────────────────────
const bookingDetailBlock = (booking) => {
    const formatDate = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
    };
    const address = typeof booking.address === 'string'
        ? booking.address
        : [booking.address?.addressLine, booking.address?.city, booking.address?.state, booking.address?.zipcode].filter(Boolean).join(', ');
    const serviceNames = (booking.services || []).map(item => item.service?.name || 'Service').join(', ') || 'Home service';
    const rows = [
        ['Service', escapeHtml(serviceNames)],
        ['Booking ID', `<span style="font-family:monospace;">#${escapeHtml(String(booking._id || '').slice(-12))}</span>`],
        ['Scheduled for', escapeHtml(formatDate(booking.serviceDate))],
        ['Location', escapeHtml(address || 'Not provided')],
        ...(booking.assignedTechnician?.name ? [['Technician', escapeHtml(`${booking.assignedTechnician.name}${booking.assignedTechnician.phone ? ` · ${booking.assignedTechnician.phone}` : ''}`)]] : []),
        ['Phone', escapeHtml(booking.phone || 'Not provided')],
        ['Total amount', escapeHtml(`$${Number(booking.totalAmount || 0).toFixed(2)}`), 'total-row']
    ];
    return detailCard('Booking Summary', rows, 'SERVICE INFORMATION');
};

// ─────────────────────────────────────────────────────────────────────────────
// Template builders
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Welcome email — sent on registration */
const welcomeTemplate = (user) => ({
    subject: 'Welcome to 1APP — Your Account is Ready!',
    html: layout(`
    ${hero('ACCOUNT READY', 'Welcome to 1APP', 'Your account is ready. Find trusted professionals for the jobs that matter.', '&#10003;', 'completed')}
    <p class="greeting">Hi ${escapeHtml(user.name)},</p>
    <p class="text">Thanks for joining 1APP. You can now browse services, book appointments, and manage your home services in one place.</p>
    ${detailCard('Your Account', [['Email', escapeHtml(user.email)], ['Phone', escapeHtml(user.phone || 'Not provided')]])}
    ${actionButton('Browse Services', '/services')}
    <p class="text">If you did not create this account, contact <a href="mailto:support@1app.com">support@1app.com</a>.</p>`,
        `Welcome to 1APP, ${user.name}! Your account is ready.`),
});

/** 2. Login notification — sent on every successful login */
const loginTemplate = (user) => {
    const time = new Date().toLocaleString('en-IN', {
        weekday: 'short', year: 'numeric', month: 'short',
        day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return {
        subject: '1APP — New Login to Your Account',
        html: layout(`
    ${hero('SECURITY NOTICE', 'New sign-in detected', 'We noticed a successful sign-in to your 1APP account.', '&#9679;', 'action')}
    <p class="greeting">Hi ${escapeHtml(user.name)},</p>
    <p class="text">If this was you, no action is needed. If you do not recognize this activity, secure your account and contact our support team.</p>
    ${detailCard('Sign-in Details', [['Time', escapeHtml(time)], ['Account', escapeHtml(user.email)]])}
    <p class="text">Need help? Contact <a href="mailto:support@1app.com">support@1app.com</a>.</p>`,
            `New login detected on your 1APP account.`),
    };
};

/** 3. Forgot-password OTP email */
const forgotPasswordTemplate = (user, otp) => ({
    subject: '1APP — Your Password Reset OTP',
    html: layout(`
    ${hero('ACCOUNT SECURITY', 'Reset your password', 'Use the one-time code below to continue resetting your 1APP password.', '&#128274;', 'action')}
    <p class="greeting">Hi ${escapeHtml(user.name)},</p>
    <p class="text">This verification code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    <div class="otp">${escapeHtml(otp)}</div>
    <p class="text">If you did not request a password reset, you can ignore this email. Your password will remain unchanged.</p>`,
        `Your 1APP password reset OTP: ${otp}`),
});

const sendVerificationOTPEmail = async (email, otp) => {
    const html = layout(`
    ${hero('ACCOUNT VERIFICATION', 'Verify your email address', 'Use the one-time code below to verify your 1APP email address.', '&#128274;', 'action')}
    <p class="text">This verification code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
    <div class="otp">${escapeHtml(otp)}</div>
    <p class="text">If you did not request this code, you can ignore this email.</p>`,
        `Your 1APP verification OTP: ${otp}`);

    return sendEmail({
        to: email,
        subject: '1APP — Your Email Verification OTP',
        html,
    });
};

/** 4. Password reset success */
const passwordResetSuccessTemplate = (user) => ({
    subject: '1APP — Your Password Has Been Reset',
    html: layout(`
    ${hero('PASSWORD UPDATED', 'Password changed', 'Your account security details have been updated.', '&#10003;', 'completed')}
    <p class="greeting">Hi ${escapeHtml(user.name)},</p>
    <p class="text">Your 1APP password was successfully reset. If you did not make this change, contact us immediately.</p>
    ${detailCard('Change Details', [['Account', escapeHtml(user.email)], ['Changed on', escapeHtml(new Date().toLocaleString('en-IN'))]])}
    <div class="note"><strong>If you made this change:</strong> no further action is needed.<br /><strong>If you did not:</strong> contact <a href="mailto:support@1app.com">support@1app.com</a>.</div>`,
        `Your 1APP password has been successfully reset.`),
});

/** 5. Booking confirmed + invoice (after payment) */
const bookingConfirmedTemplate = (booking) => ({
    subject: `1APP — Booking Confirmed! #${String(booking._id).slice(-6).toUpperCase()}`,
    html: layout(`
    ${hero('BOOKING CONFIRMED', 'Your booking is confirmed!', 'Payment received. Here are the details of your upcoming service.', '&#10003;', 'confirmed')}
    <p class="greeting">Hi ${escapeHtml(booking.user.name)},</p>
    <p class="text">Thanks for choosing 1APP. We will share technician and booking updates as your service progresses.</p>
    ${bookingDetailBlock(booking)}
    ${detailCard('Payment Details', [['Payment status', 'Paid'], ...(booking.paymentDetails?.paymentId ? [['Transaction ID', escapeHtml(booking.paymentDetails.paymentId)]] : [])], 'PAYMENT')}
    ${actionButton('View Booking', '/bookings')}
    <p class="text">Questions? Contact <a href="mailto:support@1app.com">support@1app.com</a>.</p>`,
        `Your 1APP booking is confirmed. Service on ${new Date(booking.serviceDate).toDateString()}.`),
});

/** 6. Booking status updated by admin */
const bookingStatusUpdatedTemplate = (booking) => {
    const statusContent = {
        Confirmed: { eyebrow: 'BOOKING CONFIRMED', title: 'Your booking is confirmed', description: 'Your service is scheduled. We will keep you updated.', icon: '&#10003;', tone: 'confirmed' },
        Assigned: { eyebrow: 'TECHNICIAN ASSIGNED', title: 'Your technician is confirmed', description: 'A technician has been assigned to your service.', icon: '&#128100;', tone: 'action' },
        'On the Way': { eyebrow: 'TECHNICIAN EN ROUTE', title: 'Your technician is on the way', description: 'Your technician has started traveling to the service location.', icon: '&#10148;', tone: 'action' },
        'In Progress': { eyebrow: 'SERVICE IN PROGRESS', title: 'Your service is underway', description: 'Your technician has started work on your service.', icon: '&#9881;', tone: 'action' },
        Checkout: { eyebrow: 'CHECKOUT', title: 'Service work is complete', description: 'Your technician finished the work. The job is awaiting final checkout.', icon: '&#10003;', tone: 'completed' },
        Completed: { eyebrow: 'SERVICE COMPLETED', title: 'Your service is complete!', description: 'Your service has been successfully completed.', icon: '&#10003;', tone: 'completed' },
        Cancelled: { eyebrow: 'BOOKING CANCELLED', title: 'Your booking was cancelled', description: 'The booking status has been updated. See the details below.', icon: '&#10005;', tone: 'cancelled' },
        Pending: { eyebrow: 'BOOKING UPDATE', title: 'Your booking is pending', description: 'We are processing your booking and will share an update soon.', icon: '&#8987;', tone: 'action' },
    };
    const content = statusContent[booking.status] || {
        eyebrow: 'BOOKING UPDATE', title: `Booking ${booking.status || 'updated'}`,
        description: 'Your booking details have been updated.', icon: '&#9679;', tone: 'action'
    };
    const completionNote = booking.status === 'Completed'
        ? '<div class="note">We would love to hear about your experience. You can share feedback from your 1APP account.</div>'
        : '';
    const cancellationNote = booking.status === 'Cancelled'
        ? `<div class="note">${booking.paymentStatus === 'Paid' ? 'If your payment is eligible for a refund, it will be handled according to the applicable refund policy.' : 'If you have questions about this cancellation, contact our support team.'}</div>`
        : '';

    return {
        subject: `1APP — Booking Update: ${escapeHtml(booking.status)} · #${String(booking._id).slice(-6).toUpperCase()}`,
        html: layout(`
    ${hero(content.eyebrow, content.title, content.description, content.icon, content.tone)}
    <p class="greeting">Hi ${escapeHtml(booking.user.name)},</p>
    <p class="text">Your booking status is now <strong>${escapeHtml(booking.status)}</strong>.</p>
    ${bookingDetailBlock(booking)}
    ${completionNote}${cancellationNote}
    ${actionButton('View Booking', '/bookings')}
    <p class="text">Questions? Contact <a href="mailto:support@1app.com">support@1app.com</a>.</p>`,
            `Your 1APP booking is now ${booking.status}.`),
    };
};

/** 7. Booking cancelled */
const bookingCancelledTemplate = (booking) => ({
    subject: `1APP — Booking Cancelled · #${String(booking._id).slice(-6).toUpperCase()}`,
    html: layout(`
    ${hero('BOOKING CANCELLED', 'Your booking was cancelled', 'The cancellation is confirmed. Keep this email for your records.', '&#10005;', 'cancelled')}
    <p class="greeting">Hi ${escapeHtml(booking.user.name)},</p>
    <p class="text">We are sorry your plans changed. Here is a summary of the cancelled service.</p>
    ${bookingDetailBlock(booking)}
    <div class="note">${booking.paymentStatus === 'Paid' ? 'If your payment is eligible for a refund, it will be handled according to the applicable refund policy.' : 'No payment refund is due for an unpaid booking.'} For help, contact <a href="mailto:support@1app.com">support@1app.com</a>.</div>
    ${actionButton('Browse Services', '/services')}`,
        `Your 1APP booking has been cancelled.`),
});

// ─────────────────────────────────────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an email via SendGrid SMTP (nodemailer).
 * Falls back to a console log when SMTP_PASS is not configured.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
const sendEmail = async (options) => {
    const { to, subject, html, text } = options;

    if (!process.env.SMTP_PASS) {
        console.log('\n─── 📧 EMAIL (dev mode — SMTP not configured) ───');
        console.log(`To     : ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('─────────────────────────────────────────────────\n');
        return { success: true, dev: true };
    }

    const info = await getTransporter().sendMail({
        from: FROM(),
        to,
        subject,
        html: html || '',
        ...(text && { text }),
    });

    return { success: true, messageId: info.messageId };
};

// ─────────────────────────────────────────────────────────────────────────────
// Named email senders — called from controllers
// ─────────────────────────────────────────────────────────────────────────────

const sendWelcomeEmail = async (user) => {
    const { subject, html } = welcomeTemplate(user);
    return sendEmail({ to: user.email, subject, html });
};

const sendLoginNotification = async (user) => {
    const { subject, html } = loginTemplate(user);
    return sendEmail({ to: user.email, subject, html });
};

const sendForgotPasswordEmail = async (user, otp) => {
    const { subject, html } = forgotPasswordTemplate(user, otp);
    return sendEmail({ to: user.email, subject, html });
};

const sendPasswordResetSuccess = async (user) => {
    const { subject, html } = passwordResetSuccessTemplate(user);
    return sendEmail({ to: user.email, subject, html });
};

const sendBookingConfirmed = async (booking) => {
    const { subject, html } = bookingConfirmedTemplate(booking);
    return sendEmail({ to: booking.user.email, subject, html });
};

const sendBookingStatusUpdated = async (booking) => {
    const { subject, html } = bookingStatusUpdatedTemplate(booking);
    return sendEmail({ to: booking.user.email, subject, html });
};

const sendBookingCancelled = async (booking) => {
    const { subject, html } = bookingCancelledTemplate(booking);
    return sendEmail({ to: booking.user.email, subject, html });
};

module.exports = {
    sendEmail,
    renderEmailLayout: layout,
    sendWelcomeEmail,
    sendLoginNotification,
    sendForgotPasswordEmail,
    sendVerificationOTPEmail,
    sendPasswordResetSuccess,
    sendBookingConfirmed,
    sendBookingStatusUpdated,
    sendBookingCancelled,
};
