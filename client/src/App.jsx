import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import DisputeDetail from './pages/DisputeDetail';
import Disputes from './pages/Disputes';
import GigDetail from './pages/GigDetail';
import Gigs from './pages/Gigs';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import PostGig from './pages/PostGig';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Wallet from './pages/Wallet';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/gigs" element={<Gigs />} />
            <Route path="/gigs/:id" element={<GigDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users/:id" element={<Profile />} />
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/disputes/:id" element={<DisputeDetail />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} />}>
            <Route path="/gigs/new" element={<PostGig />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client', 'freelancer']} />}>
            <Route path="/wallet" element={<Wallet />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<Disputes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
