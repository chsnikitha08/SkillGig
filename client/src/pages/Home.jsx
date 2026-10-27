import { ArrowRight, BadgeCheck, MessageSquareWarning, Search, ShieldCheck, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import GigCard from '../components/GigCard';
import { Spinner } from '../components/ui';
import { CATEGORIES, categoryLink } from '../utils/categories';

const POPULAR = [
  ['Logo design', 'logo'],
  ['PPT', 'ppt'],
  ['Notes typing', 'typing'],
  ['React website', 'react'],
  ['Video editing', 'video'],
];

const TRUST = [
  [ShieldCheck, 'Payment protection', 'Your money is held safely and only paid out when you approve the work.'],
  [BadgeCheck, 'Pay in stages', 'Split bigger projects into stages and approve each one as it’s delivered.'],
  [Star, 'Real reputations', 'Every finished project builds a rating, so you can hire with confidence.'],
  [MessageSquareWarning, 'Fair disputes', 'If something goes wrong, the SkillGig team reviews both sides and decides.'],
];

export default function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <FreshGigs />
      <Trust />
      <CallToAction />
    </>
  );
}

const HERO = {
  hire: {
    title: 'Hire talented students for any task, online.',
    text: 'Logos, notes, websites, videos and more, from students on your campus. Your payment stays protected until you approve the work.',
    placeholder: 'What do you need done?',
    button: 'Search',
  },
  work: {
    title: 'Get paid for what you’re great at.',
    text: 'Pick up gigs from students around you. The payment is secured before you start, so you’ll never chase anyone for money again.',
    placeholder: 'What can you do? Try “logo” or “react”',
    button: 'Find work',
  },
};

function Hero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState(user?.role === 'freelancer' ? 'work' : 'hire');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const copy = HERO[mode];

  const search = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const c = CATEGORIES.find((x) => x.key === cat);
    if (c) {
      params.set('skill', c.skills.join(','));
      params.set('cat', c.key);
    }
    navigate(`/gigs?${params}`);
  };

  return (
    <section className="relative flex min-h-[560px] items-center bg-cover bg-center" style={{ backgroundImage: "url('/hero.jpg')" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/10" />
      <div className="container-page relative pb-16 pt-28">
        <div className="mb-6 inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur">
          {[
            ['hire', 'Hire talent'],
            ['work', 'Find work'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${mode === key ? 'bg-white text-ink shadow' : 'text-white/85 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <h1 key={mode} className="max-w-xl animate-[fadeUp_.4s_ease-out] text-4xl font-bold leading-tight text-white sm:text-5xl">
          {copy.title}
        </h1>
        <p key={`${mode}-text`} className="mt-4 max-w-lg animate-[fadeUp_.5s_ease-out] text-white/85">
          {copy.text}
        </p>
        <form onSubmit={search} className="mt-8 flex max-w-2xl flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              className="w-full py-2.5 text-sm outline-none placeholder:text-gray-400"
              placeholder={copy.placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="border-gray-200 px-3 py-2.5 text-sm text-gray-600 outline-none sm:w-48 sm:border-l"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn-primary px-8">{copy.button}</button>
        </form>
        <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/80">
          Popular:
          {POPULAR.map(([label, query]) => (
            <Link key={label} to={`/gigs?q=${query}`} className="rounded-full border border-white/30 px-3 py-0.5 text-white/90 hover:bg-white/10">
              {label}
            </Link>
          ))}
        </p>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle, link, linkLabel }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {link && (
        <Link to={link} className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:text-brand-700">
          {linkLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Categories() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    // Number of open gigs per category, using the normal search endpoint.
    Promise.all(
      CATEGORIES.map((c) =>
        http
          .get('/gigs', { params: { skill: c.skills.join(','), limit: 1 } })
          .then((r) => [c.key, r.data.total])
          .catch(() => [c.key, null]),
      ),
    ).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, []);

  return (
    <section className="container-page py-20">
      <SectionHeader title="Browse talent by category" subtitle="Find the right student for whatever you need" link="/gigs" linkLabel="All gigs" />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.key} to={categoryLink(c)} className="group rounded-xl p-4 transition hover:bg-brand-50">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-white">
                <Icon className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <p className="mt-5 text-xs text-gray-500">
                {counts[c.key] == null ? ' ' : `${counts[c.key]} open gig${counts[c.key] === 1 ? '' : 's'}`}
              </p>
              <p className="mt-1 font-semibold text-ink group-hover:text-brand-700">{c.name}</p>
              <p className="mt-1 text-sm text-gray-500">{c.blurb}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FreshGigs() {
  const { data, loading } = useFetch('/gigs?limit=8');
  return (
    <section className="bg-brand-50/60 py-20">
      <div className="container-page">
        <SectionHeader title="Fresh gigs" subtitle="The latest work posted by students" link="/gigs" linkLabel="All gigs" />
        {loading ? (
          <Spinner />
        ) : data?.items?.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((g) => (
              <GigCard key={g._id} gig={g} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
            <p className="font-semibold">No open gigs yet</p>
            <p className="mt-1 text-sm text-gray-500">Be the first to post one.</p>
            <Link to="/gigs/new" className="btn-primary mt-4">
              Post a gig
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="container-page py-20">
      <SectionHeader title="Why students trust SkillGig" subtitle="Built so nobody gets cheated, on either side" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map(([Icon, title, text]) => (
          <div key={title} className="card">
            <Icon className="h-8 w-8 text-brand-500" strokeWidth={1.6} />
            <p className="mt-4 font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CallToAction() {
  const { user } = useAuth();
  return (
    <section className="container-page">
      <div className="grid overflow-hidden rounded-2xl bg-[#1f2b24] text-white md:grid-cols-2">
        <div className="p-10 sm:p-12">
          <h2 className="text-3xl font-bold">Need something done?</h2>
          <p className="mt-3 text-white/75">Post a gig in two minutes and get applications from skilled students today.</p>
          <Link to={user?.role === 'freelancer' ? '/gigs' : user ? '/gigs/new' : '/register'} className="btn-primary mt-6">
            {user?.role === 'freelancer' ? 'Find work' : 'Post a gig'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="border-t border-white/10 p-10 sm:p-12 md:border-l md:border-t-0">
          <h2 className="text-3xl font-bold">Have a skill?</h2>
          <p className="mt-3 text-white/75">Earn from design, code, writing or video, and get paid safely every time.</p>
          <Link to={user ? '/gigs' : '/register'} className="btn-secondary mt-6 border-white/20 bg-transparent text-white hover:bg-white/10">
            Start earning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
