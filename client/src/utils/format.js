export const money = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function timeLeft(d) {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return 'deadline passed';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `${hours} hour${hours > 1 ? 's' : ''} left`;
}

export const rating = (u) => (u?.ratingCount ? `★ ${(u.ratingSum / u.ratingCount).toFixed(1)} (${u.ratingCount})` : 'No ratings yet');
