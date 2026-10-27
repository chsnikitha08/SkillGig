import { ShieldCheck } from 'lucide-react';

/** Two-column layout for login and sign-up: form on the left, photo on the right. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.06)] lg:grid-cols-2">
      <div className="p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative hidden bg-cover bg-center lg:block" style={{ backgroundImage: "url('/hero.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <ShieldCheck className="h-8 w-8 text-brand-400" />
          <p className="mt-3 text-xl font-semibold">Your payment is protected</p>
          <p className="mt-1 text-sm text-white/80">Money is held safely until the work is approved, so nobody gets cheated.</p>
        </div>
      </div>
    </div>
  );
}
