/**
 * Generate a text-based invoice summary
 * @param {object} booking - Mongoose Booking document populated with user and services
 * @returns {string} - Formatted text invoice
 */
const generateTextInvoice = (booking) => {
    const formattedDate = new Date(booking.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const serviceDateFormatted = new Date(booking.serviceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let invoice = `
=========================================
          1APP SERVICE INVOICE
=========================================
Invoice Date: ${formattedDate}
Booking ID  : ${booking._id}
Status      : ${booking.status}
Payment     : ${booking.paymentStatus}
-----------------------------------------
CUSTOMER DETAILS:
Name   : ${booking.user ? booking.user.name : 'Valued Customer'}
Email  : ${booking.user ? booking.user.email : 'N/A'}
Phone  : ${booking.phone}
Address: ${booking.address}
-----------------------------------------
APPOINTMENT DETAILS:
Scheduled Date: ${serviceDateFormatted}
Time Slot     : ${booking.timeSlot}
-----------------------------------------
SERVICES ORDERED:
`;

    booking.services.forEach((item, index) => {
        const name = item.service && item.service.name ? item.service.name : 'Electrical Service';
        const itemTotal = item.price * item.quantity;
        invoice += `${index + 1}. ${name.padEnd(25)} x${item.quantity}   ₹${itemTotal.toFixed(2)}\n`;
    });

    invoice += `-----------------------------------------
TOTAL AMOUNT:                   ₹${booking.totalAmount.toFixed(2)}
=========================================
      Thank you for choosing 1APP!
      For support, call +1800-1APP
=========================================
`;
    return invoice;
};

module.exports = {
    generateTextInvoice
};
