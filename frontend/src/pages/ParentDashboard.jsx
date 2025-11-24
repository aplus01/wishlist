import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { auth } from '../lib/pocketbase';
import ManageChildren from '../components/ManageChildren';
import ReviewItems from '../components/ReviewItems';
import EquityDashboard from '../components/EquityDashboard';
import ManageFamily from '../components/ManageFamily';
import ParentWishlist from './ParentWishlist';

export default function ParentDashboard() {
  const location = useLocation();

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  const isActive = (path) => {
    if (path === '/parent' && location.pathname === '/parent') return true;
    if (path !== '/parent' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      <div className="header">
        <div className="header-content">
          <h1>🎅 Parent Dashboard</h1>
          <div className="nav">
            <Link
              to="/parent"
              className={isActive('/parent') ? 'active' : ''}
            >
              Kids
            </Link>
            <Link 
              to="/parent/review" 
              className={isActive('/parent/review') ? 'active' : ''}
            >
              Review Items
            </Link>
            <Link 
              to="/parent/equity" 
              className={isActive('/parent/equity') ? 'active' : ''}
            >
              Equity Dashboard
            </Link>
            <Link
              to="/parent/family"
              className={isActive('/parent/family') ? 'active' : ''}
            >
              Family Members
            </Link>
            <Link
              to="/parent/wishlist"
              className={isActive('/parent/wishlist') ? 'active' : ''}
            >
              My Wishlist
            </Link>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <Routes>
          <Route index element={<ManageChildren />} />
          <Route path="review" element={<ReviewItems />} />
          <Route path="equity" element={<EquityDashboard />} />
          <Route path="family" element={<ManageFamily />} />
          <Route path="wishlist" element={<ParentWishlist />} />
        </Routes>
      </div>
    </>
  );
}
