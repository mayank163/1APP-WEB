// Unprefixed US mobile numbers use +1; other numbers require a country code.
const normalizePhone = (value) => {
  const input = String(value || '').trim().replace(/[\s()-]/g, '');
  const phone = /^\d{10}$/.test(input) ? `+1${input}` : input;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    const error = new Error('Enter a valid mobile number with country code (e.g. +1 234 567 8901).');
    error.statusCode = 400;
    throw error;
  }
  return phone;
};
const phoneQuery = (phone) => {
  const localNumber = phone.startsWith('+1')
    ? phone.slice(2)
    : phone.startsWith('+91')
      ? phone.slice(3)
      : phone.replace(/^\+\d+/, '');
  return {
    phone: { $in: localNumber && localNumber !== phone ? [phone, localNumber] : [phone] }
  };
};
module.exports = { normalizePhone, phoneQuery };
