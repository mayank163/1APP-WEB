const dateOnly = value => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
};

// Licences remain valid throughout their expiry day in the admin's local timezone.
export function isDrivingLicenseExpired(value, now = new Date()) {
  const expiry = dateOnly(value);
  if (!expiry) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return today > expiry;
}

export function formatLicenseDate(value) {
  const date = dateOnly(value);
  return date ? new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not provided';
}
