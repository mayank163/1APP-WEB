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

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout wrapper
// ─────────────────────────────────────────────────────────────────────────────
const layout = (bodyHtml, previewText = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>1APP</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; }
    a { color: #1a1a1a; text-decoration: none; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a1a1a; padding: 28px 40px; text-align: center; }
    .header-logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 2px; }
    .header-sub { font-size: 11px; color: rgba(255,255,255,0.45); letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 20px; font-weight: 700; margin-bottom: 10px; }
    .text { font-size: 14.5px; color: #444; line-height: 1.7; margin-bottom: 14px; }
    .highlight-box { background: #f8f8f8; border-left: 4px solid #1a1a1a; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .highlight-box p { font-size: 13.5px; color: #333; line-height: 1.6; margin: 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
    .badge-confirmed  { background: #d1fae5; color: #065f46; }
    .badge-pending    { background: #fef3c7; color: #92400e; }
    .badge-inprogress { background: #dbeafe; color: #1e40af; }
    .badge-completed  { background: #d1fae5; color: #065f46; }
    .badge-cancelled  { background: #fee2e2; color: #991b1b; }
    .table-wrap { margin: 20px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    table th { background: #1a1a1a; color: #fff; padding: 10px 14px; text-align: left; font-weight: 600; }
    table td { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; color: #333; }
    table tr:last-child td { border-bottom: none; }
    table tr:nth-child(even) td { background: #fafafa; }
    .total-row td { font-weight: 700; background: #f3f4f6 !important; font-size: 14px; }
    .detail-grid { display: table; width: 100%; margin: 16px 0; }
    .detail-row { display: table-row; }
    .detail-label { display: table-cell; font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 12px 5px 0; white-space: nowrap; width: 130px; }
    .detail-value { display: table-cell; font-size: 13.5px; color: #1a1a1a; padding: 5px 0; }
    .btn { display: inline-block; background: #1a1a1a; color: #fff !important; padding: 13px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; margin: 22px 0 8px; letter-spacing: 0.3px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { background: #f8f8f8; padding: 22px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #aaa; line-height: 1.6; }
    .footer a { color: #888; }
    .status-banner { text-align: center; padding: 18px; margin-bottom: 24px; border-radius: 8px; }
    .status-banner.confirmed  { background: #d1fae5; }
    .status-banner.cancelled  { background: #fee2e2; }
    .status-banner.updated    { background: #dbeafe; }
    .status-banner.welcome    { background: #f0fdf4; }
    .status-banner h2 { font-size: 17px; font-weight: 800; margin-top: 6px; }
    .icon { font-size: 30px; line-height: 1; }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}</div>` : ''}
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">1APP</div>
      <div class="header-sub">Home Services Platform</div>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} 1APP Services. All rights reserved.</p>
      <p style="margin-top:6px;">Need help? <a href="mailto:support@1app.com">support@1app.com</a> · <a href="tel:+180001APP">+1800-1APP</a></p>
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Booking detail block (shared across booking emails)
// ─────────────────────────────────────────────────────────────────────────────
const bookingDetailBlock = (booking) => {
    const serviceDate = new Date(booking.serviceDate).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const createdAt = new Date(booking.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    const serviceRows = booking.services.map((item, i) => {
        const name = item.service?.name || 'Service';
        const itemTotal = (item.price * item.quantity).toFixed(2);
        return `
        <tr>
          <td>${i + 1}. ${name}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">$${item.price.toFixed(2)}</td>
          <td style="text-align:right;">$${itemTotal}</td>
        </tr>`;
    }).join('');

    const technicianHtml = booking.assignedTechnician?.name ? `
    <div class="detail-row">
      <div class="detail-label">Technician</div>
      <div class="detail-value">${booking.assignedTechnician.name}${booking.assignedTechnician.phone ? ` · ${booking.assignedTechnician.phone}` : ''}</div>
    </div>` : '';

    return `
    <div class="detail-grid">
      <div class="detail-row">
        <div class="detail-label">Booking ID</div>
        <div class="detail-value" style="font-family:monospace;font-size:12px;">${booking._id}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Booked On</div>
        <div class="detail-value">${createdAt}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Service Date</div>
        <div class="detail-value">${serviceDate}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Time Slot</div>
        <div class="detail-value">${booking.timeSlot}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Address</div>
        <div class="detail-value">${booking.address}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Phone</div>
        <div class="detail-value">${booking.phone}</div>
      </div>
      ${technicianHtml}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${serviceRows}
          <tr class="total-row">
            <td colspan="3">Total Amount</td>
            <td style="text-align:right;">$${booking.totalAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Template builders
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Welcome email — sent on registration */
const welcomeTemplate = (user) => ({
    subject: 'Welcome to 1APP — Your Account is Ready!',
    html: layout(`
    <div class="status-banner welcome">
      <div class="icon">🎉</div>
      <h2>Welcome to 1APP!</h2>
    </div>
    <p class="greeting">Hi ${user.name},</p>
    <p class="text">
      Your account has been created successfully. We're excited to have you on board.
      1APP connects you with trusted home service professionals — fast, reliable, and hassle-free.
    </p>
    <div class="highlight-box">
      <p><strong>Your registered email:</strong> ${user.email}</p>
      <p style="margin-top:6px;"><strong>Phone:</strong> ${user.phone}</p>
    </div>
    <p class="text">
      You can now browse services, book appointments, and track everything from your dashboard.
    </p>
    <hr class="divider" />
    <p class="text" style="font-size:13px;color:#888;">
      If you didn't create this account, please contact us immediately at
      <a href="mailto:support@1app.com">support@1app.com</a>.
    </p>`,
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
    <p class="greeting">Hi ${user.name},</p>
    <p class="text">
      We detected a new sign-in to your 1APP account. If this was you, no action is needed.
    </p>
    <div class="highlight-box">
      <p><strong>Time:</strong> ${time}</p>
      <p style="margin-top:6px;"><strong>Account:</strong> ${user.email}</p>
    </div>
    <p class="text">
      If you did <strong>not</strong> sign in, please change your password immediately and
      contact our support team at <a href="mailto:support@1app.com">support@1app.com</a>.
    </p>`,
            `New login detected on your 1APP account.`),
    };
};

/** 3. Forgot-password OTP email */
const forgotPasswordTemplate = (user, otp) => ({
    subject: '1APP — Your Password Reset OTP',
    html: layout(`
    <p class="greeting">Hi ${user.name},</p>
    <p class="text">
      We received a request to reset the password for your 1APP account.
      Use the OTP below to proceed. This code is valid for <strong>10 minutes</strong>.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#1a1a1a;color:#fff;font-size:32px;font-weight:800;
                  letter-spacing:10px;padding:18px 36px;border-radius:10px;font-family:monospace;">
        ${otp}
      </div>
    </div>
    <p class="text" style="text-align:center;font-size:13px;color:#888;">
      Do not share this OTP with anyone.
    </p>
    <hr class="divider" />
    <p class="text" style="font-size:13px;color:#888;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>`,
        `Your 1APP password reset OTP: ${otp}`),
});

/** 4. Password reset success */
const passwordResetSuccessTemplate = (user) => ({
    subject: '1APP — Your Password Has Been Reset',
    html: layout(`
    <div class="status-banner welcome">
      <div class="icon">🔐</div>
      <h2>Password Changed</h2>
    </div>
    <p class="greeting">Hi ${user.name},</p>
    <p class="text">
      Your 1APP account password was successfully reset. You can now log in with your new password.
    </p>
    <div class="highlight-box">
      <p><strong>Account:</strong> ${user.email}</p>
      <p style="margin-top:6px;"><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
    </div>
    <p class="text">
      If you did not make this change, please contact us immediately at
      <a href="mailto:support@1app.com">support@1app.com</a>.
    </p>`,
        `Your 1APP password has been successfully reset.`),
});

/** 5. Booking confirmed + invoice (after payment) */
const bookingConfirmedTemplate = (booking) => ({
    subject: `1APP — Booking Confirmed! #${String(booking._id).slice(-6).toUpperCase()}`,
    html: layout(`
    <div class="status-banner confirmed">
      <div class="icon">✅</div>
      <h2>Booking Confirmed</h2>
    </div>
    <p class="greeting">Hi ${booking.user.name},</p>
    <p class="text">
      Great news! Your payment was successful and your booking is now confirmed.
      Here are your booking details:
    </p>
    ${bookingDetailBlock(booking)}
    <div class="highlight-box" style="margin-top:20px;">
      <p>Payment Status: <strong style="color:#065f46;">PAID</strong></p>
      ${booking.paymentDetails?.paymentId
        ? `<p style="margin-top:4px;font-size:12px;">Transaction ID: <code>${booking.paymentDetails.paymentId}</code></p>`
        : ''}
    </div>
    <p class="text" style="margin-top:16px;">
      We'll notify you once a technician is assigned. For any queries, contact us at
      <a href="mailto:support@1app.com">support@1app.com</a> or call <strong>+1800-1APP</strong>.
    </p>`,
        `Your 1APP booking is confirmed. Service on ${new Date(booking.serviceDate).toDateString()}.`),
});

/** 6. Booking status updated by admin */
const bookingStatusUpdatedTemplate = (booking) => {
    const statusBadgeMap = {
        Confirmed:   'confirmed',
        'In Progress': 'updated',
        Completed:   'confirmed',
        Cancelled:   'cancelled',
        Pending:     'updated',
    };
    const iconMap = {
        Confirmed:   '✅',
        'In Progress': '🔧',
        Completed:   '🎉',
        Cancelled:   '❌',
        Pending:     '⏳',
    };
    const bannerClass = statusBadgeMap[booking.status] || 'updated';
    const icon = iconMap[booking.status] || '📋';

    const technicianSection = booking.assignedTechnician?.name ? `
    <div class="highlight-box" style="margin-top:4px;">
      <p><strong>🔧 Assigned Technician</strong></p>
      <p style="margin-top:6px;">${booking.assignedTechnician.name}</p>
      ${booking.assignedTechnician.phone
        ? `<p style="margin-top:4px;">📞 ${booking.assignedTechnician.phone}</p>`
        : ''}
    </div>` : '';

    return {
        subject: `1APP — Booking Update: ${booking.status} · #${String(booking._id).slice(-6).toUpperCase()}`,
        html: layout(`
    <div class="status-banner ${bannerClass}">
      <div class="icon">${icon}</div>
      <h2>Booking ${booking.status}</h2>
    </div>
    <p class="greeting">Hi ${booking.user.name},</p>
    <p class="text">
      Your booking status has been updated to
      <span class="badge badge-${booking.status.toLowerCase().replace(' ', '')}">
        ${booking.status}
      </span>.
    </p>
    ${technicianSection}
    ${bookingDetailBlock(booking)}
    <p class="text" style="margin-top:16px;">
      Questions? Reach us at <a href="mailto:support@1app.com">support@1app.com</a>
      or call <strong>+1800-1APP</strong>.
    </p>`,
            `Your 1APP booking is now ${booking.status}.`),
    };
};

/** 7. Booking cancelled */
const bookingCancelledTemplate = (booking) => ({
    subject: `1APP — Booking Cancelled · #${String(booking._id).slice(-6).toUpperCase()}`,
    html: layout(`
    <div class="status-banner cancelled">
      <div class="icon">❌</div>
      <h2>Booking Cancelled</h2>
    </div>
    <p class="greeting">Hi ${booking.user.name},</p>
    <p class="text">
      Your booking has been cancelled as requested. We're sorry to see you go —
      here's a summary for your records:
    </p>
    ${bookingDetailBlock(booking)}
    <div class="highlight-box" style="margin-top:8px;">
      <p>If you paid online and are eligible for a refund, it will be processed within <strong>5–7 business days</strong> to your original payment method.</p>
    </div>
    <p class="text" style="margin-top:16px;">
      We hope to serve you again soon. Book a new service anytime from your dashboard.
    </p>`,
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
    sendWelcomeEmail,
    sendLoginNotification,
    sendForgotPasswordEmail,
    sendPasswordResetSuccess,
    sendBookingConfirmed,
    sendBookingStatusUpdated,
    sendBookingCancelled,
};
