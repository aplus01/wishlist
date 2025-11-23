import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../lib/pocketbase';

export default function RouteAuth() {
  const { route } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const authenticate = async () => {
      try {
        const result = await auth.authenticateByRoute(route);

        if (result) {
          if (result.type === 'child') {
            window.location.href = '/child';
          } else if (result.type === 'family') {
            window.location.href = '/family';
          }
        } else {
          // No match found, redirect to login
          navigate('/login');
        }
      } catch (err) {
        console.error('Route authentication failed:', err);
        setError('Authentication failed');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    authenticate();
  }, [route, navigate]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div className="card">
          <h2 style={{ color: '#991b1b' }}>Authentication Error</h2>
          <p>{error}</p>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    }}>
      <div className="card">
        <h2>Authenticating...</h2>
        <p>Please wait while we log you in.</p>
      </div>
    </div>
  );
}
