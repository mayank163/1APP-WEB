// Match full IDs or the suffixes displayed in admin job and booking views.
function bookingIdSearch(search) {
  const value = String(search || '').trim().replace(/^#/, '').replace(/^(?:JB|BK|BOOKING)[-\s:]*/i, '');
  if (!/^[a-f\d]{6,24}$/i.test(value)) return null;
  return { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${value}$`, options: 'i' } } };
}
module.exports = { bookingIdSearch };
