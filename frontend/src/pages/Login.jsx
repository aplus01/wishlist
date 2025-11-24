import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb, { auth } from '../lib/pocketbase';

export default function Login() {
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingParents, setLoadingParents] = useState(true);

  useEffect(() => {
    // Load all parent accounts
    const loadParents = async () => {
      try {
        const parentList = await pb.collection('users').getFullList({
          filter: 'role = "parent"',
          sort: 'name',
        });
        console.log('Loaded parents:', parentList);
        setParents(parentList);

        if (parentList.length === 0) {
          setError('No parent accounts found. Please check your database.');
        }
      } catch (err) {
        console.error('Error loading parents:', err);
        setError('Failed to load parent accounts: ' + err.message);
      } finally {
        setLoadingParents(false);
      }
    };

    loadParents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Find the selected parent's email
      const selectedParent = parents.find((p) => p.id === selectedParentId);
      if (!selectedParent) {
        throw new Error('Please select a parent account');
      }

      await auth.loginParent(selectedParent.email, password);
      navigate('/parent');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingParents) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div className='card' style={{ maxWidth: '500px', width: '100%' }}>
          <h1
            style={{
              textAlign: 'center',
              color: '#165B33',
              marginBottom: '30px',
              fontSize: '32px',
            }}
          >
            🎄 Christmas Wishlist
          </h1>
          <p style={{ textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div className='card' style={{ maxWidth: '500px', width: '100%' }}>
        <h1
          style={{
            textAlign: 'center',
            color: '#165B33',
            marginBottom: '30px',
            fontSize: '32px',
          }}
        >
          🎄 Christmas Wishlist
        </h1>

        <h2
          style={{
            textAlign: 'center',
            marginBottom: '30px',
            fontSize: '20px',
            color: '#2D3748',
          }}
        >
          Parent Login
        </h2>

        {error && <div className='error-message'>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className='input-group'>
            <label>Parent Name</label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '40px',
                  fontSize: '16px',
                  border: '1px solid var(--green-dark)',
                  borderRadius: '0',
                  background: 'white',
                  color: 'var(--green-dark)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  outline: 'none',
                }}
              >
                <option value=''>Select parent...</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name || parent.email}
                  </option>
                ))}
              </select>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24'
                viewBox='0 -960 960 960'
                width='24'
                fill='var(--green-dark)'
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <path d='M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z' />
              </svg>
            </div>
          </div>

          <div className='input-group'>
            <label>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder='••••••••'
            />
          </div>

          <button
            type='submit'
            className='btn btn-primary'
            style={{ width: '100%', marginTop: '20px' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div
          style={{
            marginTop: '30px',
            padding: '16px',
            background: '#F8F4E3',
            borderRadius: '8px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: '#2D3748',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            <strong>Kids & Family:</strong> Use your personal login link to
            access your wishlist.
          </p>
        </div>
      </div>
    </div>
  );
}
