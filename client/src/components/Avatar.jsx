const COLORS = ['bg-brand-500', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500'];

export default function Avatar({ name = '?', size = 'h-8 w-8 text-xs' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const color = COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % COLORS.length];
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size} ${color}`}>{initials}</span>;
}
