const round = value => Math.round((Number(value) || 0) * 100) / 100;
const isoDate = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

// Explicit public fields: never serialize the populated user or payment credentials.
const buildBookingInvoice = booking => {
    const bookingId = String(booking._id);
    const user = booking.user && typeof booking.user === 'object' ? booking.user : {};
    const rawAddress = booking.address || {};
    const address = {
        addressLine: typeof rawAddress === 'string' ? rawAddress : rawAddress.addressLine || '',
        city: rawAddress.city || '', state: rawAddress.state || '', zipcode: rawAddress.zipcode || ''
    };
    address.formatted = [address.addressLine, address.city, address.state, address.zipcode].filter(Boolean).join(', ');
    const services = (booking.services || []).map((item, index) => {
        const quantity = Number(item.quantity) || 1;
        const unitPrice = round(item.price);
        return {
            lineNumber: index + 1,
            serviceId: item.service?._id ? String(item.service._id) : typeof item.service === 'string' ? item.service : null,
            name: item.service?.name || 'Service', variantName: item.variantName || '',
            addons: (item.selectedAddons || []).map(addon => ({ name: addon.name || '', price: round(addon.price) })),
            quantity, unitPrice, amount: round(unitPrice * quantity)
        };
    });
    const subtotal = round(services.reduce((sum, item) => sum + item.amount, 0));
    const totalAmount = round(booking.totalAmount);
    const paidAmount = String(booking.paymentStatus).toLowerCase() === 'paid' ? totalAmount : 0;
    return {
        invoiceNumber: booking.invoiceNumber || `INV-${bookingId.slice(-8).toUpperCase()}`,
        bookingId, invoiceDate: isoDate(booking.createdAt), scheduledDate: isoDate(booking.serviceDate),
        status: booking.status, paymentStatus: booking.paymentStatus || 'Pending', currency: 'USD',
        company: { name: 'OneApp', website: 'www.1app.com', email: 'support@1app.com', phone: '+1 (253) 3667 557' },
        customer: { name: user.name || 'Valued Customer', email: user.email || '', phone: booking.phone || user.phone || '', address },
        services,
        totals: { subtotal, adjustments: round(totalAmount - subtotal), totalAmount, paidAmount, balanceDue: round(totalAmount - paidAmount) },
        download: { url: `/api/bookings/${bookingId}/invoice`, contentType: 'text/plain', filename: `invoice-${bookingId}.txt` }
    };
};
module.exports = { buildBookingInvoice };
