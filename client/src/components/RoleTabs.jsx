import { Briefcase, Laptop } from 'lucide-react';

const ROLES = [
  { value: 'client', label: 'Client', hint: 'I want to hire', icon: Briefcase },
  { value: 'freelancer', label: 'Freelancer', hint: 'I want to work', icon: Laptop },
];

/** Client / Freelancer switch used on the login and sign-up pages. */
export default function RoleTabs({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
      {ROLES.map(({ value: v, label, hint, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
              active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className={`block text-sm font-semibold ${active ? 'text-brand-800' : 'text-ink'}`}>{label}</span>
              <span className="block text-xs text-gray-500">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
