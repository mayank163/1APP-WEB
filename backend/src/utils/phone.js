// Unprefixed Indian mobile numbers use +91; other numbers require a country code.
const normalizePhone = (value) => {
  const input = String(value || '').trim().replace(/[\s()-]/g, '');
  const phone = /^\d{10}$/.test(input) ? `+91${input}` : input;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    const error = new Error('Enter a valid mobile number with country code (e.g. +919876543210).');
    error.statusCode = 400;
    throw error;
  }
  return phone;
};
const phoneQuery = (phone) => ({ phone: { $in: phone.startsWith('+91') ? [phone, phone.slice(3)] : [phone] } });
module.exports = { normalizePhone, phoneQuery };
