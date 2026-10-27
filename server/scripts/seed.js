/**
 * Creates demo accounts and gigs in every state so evaluators can try the app at once.
 * All money moves through escrowService, so the seeded ledger reconciles exactly.
 *
 *   npm run seed            # only if the database has no users yet
 *   npm run seed -- --reset # wipe everything first
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Gig } from '../src/models/Gig.js';
import { Application } from '../src/models/Application.js';
import { Review } from '../src/models/Review.js';
import { Message } from '../src/models/Message.js';
import { approveMilestone, fundGig, submitMilestone, topUp } from '../src/services/escrowService.js';
import { leaveReview } from '../src/services/ratingService.js';
import { flushNotifications } from '../src/services/notificationService.js';
import { scaleAmounts } from '../src/utils/money.js';

const PASSWORD = 'demo1234';
const days = (d) => new Date(Date.now() + d * 86400000);

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  if (process.argv.includes('--reset')) {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
    console.log('Database wiped');
  } else if (await User.exists({})) {
    console.log('Database already has users; run with --reset to start over.');
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mk = (name, email, role, extra = {}) => User.create({ name, email, role, passwordHash, ...extra });

  const admin = await mk('Admin', 'admin@skillgig.dev', 'admin');
  const rahul = await mk('Rahul Sharma', 'rahul@skillgig.dev', 'client', { bio: 'Final-year CSE, runs the robotics club.' });
  const sneha = await mk('Sneha Iyer', 'sneha@skillgig.dev', 'client', { bio: 'Cultural committee lead.' });
  const priya = await mk('Priya Verma', 'priya@skillgig.dev', 'freelancer', {
    bio: 'UI designer and React developer. 2 years of club and fest work.',
    skills: ['design', 'figma', 'react', 'web'],
  });
  const arjun = await mk('Arjun Mehta', 'arjun@skillgig.dev', 'freelancer', {
    bio: 'Video editor and motion graphics. Premiere and After Effects.',
    skills: ['video', 'editing', 'design'],
  });

  await topUp(rahul, 10000, 'seed');
  await topUp(sneha, 5000, 'seed');

  const gig = (client, data) =>
    Gig.create({
      client: client._id,
      milestones: data.milestones ?? [{ title: 'Full delivery', amount: data.budget }],
      ...data,
    });

  // Helper that walks a gig through apply + accept the same way the API does.
  async function hire(g, freelancer, quote, pitch) {
    const app = await Application.create({ gig: g._id, freelancer: freelancer._id, pitch, quotedPrice: quote, status: 'accepted' });
    const amounts = scaleAmounts(g.milestones.map((m) => m.amount), quote);
    g.milestones.forEach((m, i) => {
      m.amount = amounts[i];
    });
    Object.assign(g, { status: 'accepted', freelancer: freelancer._id, agreedAmount: quote, acceptedAt: new Date(), applicationCount: 1 });
    await g.save();
    return app;
  }

  // 1. Open gigs to browse and apply to
  const logo = await gig(rahul, {
    title: 'Logo for the Robotics Club',
    description: 'We need a modern, minimal logo for our robotics club. Should work on t-shirts and on a dark background. Vector files required.',
    skillsRequired: ['design', 'figma'],
    budget: 1500,
    deadline: days(10),
    milestones: [
      { title: '3 concept sketches', amount: 500 },
      { title: 'Final logo + vector files', amount: 1000 },
    ],
  });
  await Application.create({ gig: logo._id, freelancer: arjun._id, pitch: 'I did the fest logo last year, happy to share samples in chat.', quotedPrice: 1400 });
  await Gig.updateOne({ _id: logo._id }, { applicationCount: 1 });

  await gig(rahul, {
    title: 'Type handwritten DBMS notes',
    description: 'About 40 pages of handwritten DBMS notes (normalisation, transactions, indexing) to be typed into a clean Google Doc with headings.',
    skillsRequired: ['typing', 'documentation'],
    budget: 400,
    deadline: days(4),
  });
  await gig(sneha, {
    title: 'Edit a 2-minute fest promo video',
    description: 'Raw clips from last year\'s cultural fest need to be cut into a 2-minute Instagram promo with music, captions and transitions.',
    skillsRequired: ['video', 'editing'],
    budget: 2500,
    deadline: days(14),
    milestones: [
      { title: 'First cut', amount: 1000 },
      { title: 'Final with captions and music', amount: 1500 },
    ],
  });

  // 2. In progress: funded, first milestone submitted and waiting for approval
  const site = await gig(rahul, {
    title: 'Portfolio website in React',
    description: 'A personal portfolio site with projects, resume download and a contact form. Deployed on Vercel with a custom domain.',
    skillsRequired: ['react', 'web'],
    budget: 3000,
    deadline: days(12),
    milestones: [
      { title: 'Design mockup', amount: 1000 },
      { title: 'Frontend built', amount: 1000 },
      { title: 'Deployment', amount: 1000 },
    ],
  });
  await hire(site, priya, 3000, 'I have built 5 portfolio sites in React; I can share links.');
  await fundGig(site._id, rahul);
  const fresh = await Gig.findById(site._id);
  await submitMilestone(site._id, fresh.milestones[0]._id, priya, {
    note: 'Figma mockup with desktop and mobile layouts. Comments welcome!',
    link: 'https://www.figma.com/',
  });
  await Message.create([
    { gig: site._id, sender: rahul._id, text: 'Hi Priya, excited to work with you. Dark theme please!' },
    { gig: site._id, sender: priya._id, text: 'Sure! Mockup is up, have a look.' },
  ]);

  // 3. Completed and reviewed, so Priya has a reputation
  const poster = await gig(sneha, {
    title: 'Hackathon poster design',
    description: 'A3 poster for our 24-hour hackathon, with sponsors strip and QR code to the registration form.',
    skillsRequired: ['design'],
    budget: 800,
    deadline: days(6),
  });
  await hire(poster, priya, 800, 'Posters are my favourite, can deliver in 2 days.');
  await fundGig(poster._id, sneha);
  const p = await Gig.findById(poster._id);
  await submitMilestone(poster._id, p.milestones[0]._id, priya, { note: 'Final poster PDF and PNG.', link: 'https://drive.google.com/' });
  await approveMilestone(poster._id, p.milestones[0]._id, sneha);
  await leaveReview(poster._id, sneha, { rating: 5, comment: 'Fast, clean and exactly what we asked for.' });
  await leaveReview(poster._id, priya, { rating: 5, comment: 'Clear brief and quick approval.' });

  console.log(`Seeded. Users: ${await User.countDocuments()}, gigs: ${await Gig.countDocuments()}, reviews: ${await Review.countDocuments()}`);
  console.log(`Demo password for every account: ${PASSWORD}`);
  console.log([admin, rahul, sneha, priya, arjun].map((u) => `  ${u.role.padEnd(10)} ${u.email}`).join('\n'));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushNotifications();
    await mongoose.disconnect();
  });
