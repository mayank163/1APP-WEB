export const presenceOnline = (technician, now = Date.now()) => Boolean(
  technician.isOnline && technician.accountStatus === 'active' && technician.lastActiveAt &&
  new Date(technician.lastActiveAt).getTime() > now - 90000
);

export const lastActiveText = (technician, now = Date.now()) => {
  if (presenceOnline(technician, now)) return 'Active now';
  const timestamp = new Date(technician.lastActiveAt).getTime();
  if (!technician.lastActiveAt || !Number.isFinite(timestamp)) return 'No activity recorded';
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60000);
  if (minutes < 1) return 'Last active just now';
  if (minutes < 60) return `Last active ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `Last active ${new Date(timestamp).toLocaleString()}`;
};
