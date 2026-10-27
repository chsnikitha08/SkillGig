import { BookOpen, Code2, Megaphone, Music, Palette, PenLine, Presentation, Video } from 'lucide-react';

/**
 * Display categories. A category is just a named group of skills, so browsing a
 * category is the existing skill filter (no extra data on the server).
 */
export const CATEGORIES = [
  {
    key: 'design',
    name: 'Design & Creative',
    blurb: 'Logos, posters, UI, social media graphics',
    icon: Palette,
    skills: ['design', 'figma', 'logo', 'illustration', 'canva', 'ui'],
    gradient: 'from-orange-200 via-rose-200 to-pink-300',
  },
  {
    key: 'dev',
    name: 'Development & IT',
    blurb: 'Websites, apps, scripts and bug fixes',
    icon: Code2,
    skills: ['react', 'web', 'javascript', 'python', 'java', 'app', 'html', 'css', 'node'],
    gradient: 'from-sky-200 via-cyan-200 to-teal-200',
  },
  {
    key: 'writing',
    name: 'Writing & Notes',
    blurb: 'Notes typing, content, proofreading',
    icon: PenLine,
    skills: ['writing', 'typing', 'documentation', 'notes', 'content', 'proofreading'],
    gradient: 'from-amber-100 via-yellow-200 to-lime-200',
  },
  {
    key: 'video',
    name: 'Video & Animation',
    blurb: 'Reels, promos, edits and motion graphics',
    icon: Video,
    skills: ['video', 'editing', 'animation', 'premiere', 'reels'],
    gradient: 'from-violet-200 via-purple-200 to-fuchsia-200',
  },
  {
    key: 'slides',
    name: 'Presentations',
    blurb: 'PPTs, pitch decks and report formatting',
    icon: Presentation,
    skills: ['ppt', 'presentation', 'slides', 'powerpoint'],
    gradient: 'from-emerald-200 via-green-200 to-teal-200',
  },
  {
    key: 'marketing',
    name: 'Marketing & Social',
    blurb: 'Event promotion, Instagram, campaigns',
    icon: Megaphone,
    skills: ['marketing', 'social media', 'instagram', 'seo'],
    gradient: 'from-red-200 via-orange-200 to-amber-200',
  },
  {
    key: 'tutoring',
    name: 'Tutoring & Study help',
    blurb: 'Concept explanations and exam prep',
    icon: BookOpen,
    skills: ['tutoring', 'maths', 'physics', 'dsa', 'teaching'],
    gradient: 'from-blue-200 via-indigo-200 to-violet-200',
  },
  {
    key: 'audio',
    name: 'Music & Audio',
    blurb: 'Voice-overs, jingles and audio cleanup',
    icon: Music,
    skills: ['music', 'audio', 'voice', 'podcast'],
    gradient: 'from-pink-200 via-fuchsia-200 to-purple-200',
  },
];

const FALLBACK = { name: 'Other', icon: PenLine, gradient: 'from-gray-100 via-gray-200 to-gray-300' };

/** Picks the category whose skills overlap most with a gig's skills. */
export function categoryOf(skills = []) {
  let best = null;
  let bestScore = 0;
  for (const c of CATEGORIES) {
    const score = skills.filter((s) => c.skills.includes(s)).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best ?? FALLBACK;
}

export const categoryLink = (c) => `/gigs?skill=${encodeURIComponent(c.skills.join(','))}&cat=${c.key}`;
