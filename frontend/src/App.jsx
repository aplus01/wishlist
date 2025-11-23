import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import pb, { authStore } from './lib/pocketbase';

// Import pages
import Login from './pages/Login';
import ParentDashboard from './pages/ParentDashboard';
import ChildWishlist from './pages/ChildWishlist';
import FamilyView from './pages/FamilyView';
import RouteAuth from './pages/RouteAuth';

function App() {
  const [user, setUser] = useState(authStore.user());
  const [isChild, setIsChild] = useState(!!sessionStorage.getItem('activeChildId'));
  const [isFamily, setIsFamily] = useState(!!sessionStorage.getItem('activeFamilyId'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    setUser(authStore.user());
    setIsChild(!!sessionStorage.getItem('activeChildId'));
    setIsFamily(!!sessionStorage.getItem('activeFamilyId'));
    setLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(authStore.user());
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user && !isChild && !isFamily ? <Login /> : <Navigate to="/" />} />

        {/* Parent Routes */}
        <Route
          path="/parent/*"
          element={user?.role === 'parent' ? <ParentDashboard /> : <Navigate to="/login" />}
        />

        {/* Child Routes */}
        <Route
          path="/child"
          element={isChild ? <ChildWishlist /> : <Navigate to="/login" />}
        />

        {/* Family Member Routes */}
        <Route
          path="/family"
          element={(user?.role === 'family_member' || isFamily) ? <FamilyView /> : <Navigate to="/login" />}
        />

        {/* Default redirect based on role */}
        <Route
          path="/"
          element={
            !user && !isChild && !isFamily ? <Navigate to="/login" /> :
            isChild ? <Navigate to="/child" /> :
            isFamily ? <Navigate to="/family" /> :
            user?.role === 'parent' ? <Navigate to="/parent" /> :
            user?.role === 'family_member' ? <Navigate to="/family" /> :
            <Navigate to="/login" />
          }
        />

        {/* Catch-all route for route-based authentication (MUST BE LAST) */}
        <Route path="/:route" element={<RouteAuth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
