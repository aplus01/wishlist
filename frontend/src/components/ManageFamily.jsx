import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';

export default function ManageFamily() {
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    route: '',
  });

  useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    try {
      const members = await pb.collection('users').getFullList({
        filter: 'role = "family_member"',
        sort: 'created',
      });
      setFamilyMembers(members);
    } catch (err) {
      console.error('Error loading family members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate route format
    const routePattern = /^[a-z0-9-]+$/;
    if (!routePattern.test(formData.route)) {
      alert('Route must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      await pb.collection('users').create({
        name: formData.name,
        route: formData.route,
        role: 'family_member',
        email: `${formData.route}@family.local`,
        password: 'notused123',
        passwordConfirm: 'notused123',
      });

      setShowModal(false);
      setFormData({ name: '', route: '' });
      loadFamilyMembers();
    } catch (err) {
      console.error('Error creating family member:', err);
      alert('Failed to create family member. The route might already be in use.');
    }
  };

  const handleRemove = async (memberId) => {
    if (window.confirm('Are you sure you want to remove this family member? They will lose access to the wishlist.')) {
      try {
        await pb.collection('users').delete(memberId);
        loadFamilyMembers();
      } catch (err) {
        console.error('Error removing family member:', err);
        alert('Failed to remove family member.');
      }
    }
  };

  const generateRouteFromName = () => {
    const route = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, route });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-content">
      <div style={{ marginBottom: '30px' }}>
        <h2>Family Members</h2>
        <p>
          Add family members who will have access to the approved wishlist items.
          Each family member gets their own login route.
        </p>
        <button
          onClick={() => {
            setFormData({ name: '', route: '' });
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Add Family Member
        </button>
      </div>

      {familyMembers.length === 0 ? (
        <div className="empty-state">
          <h2>No family members yet</h2>
          <p>Click "Add Family Member" to create login routes for your family.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="stat-card">
              <h3>Total Family Members</h3>
              <div className="value">{familyMembers.length}</div>
            </div>
          </div>

          <div className="grid grid-2">
            {familyMembers.map(member => {
              const joinDate = new Date(member.created);
              const formattedDate = joinDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div key={member.id} className="card">
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'start',
                    marginBottom: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
                        {member.name}
                      </h3>
                      {member.route && (
                        <div style={{
                          background: '#F8F4E3',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          display: 'inline-block'
                        }}>
                          <strong>Login:</strong>{' '}
                          <a
                            href={`/${member.route}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: '#165B33',
                              textDecoration: 'none'
                            }}
                          >
                            /{member.route}
                          </a>
                        </div>
                      )}
                      <p style={{ color: '#718096', fontSize: '14px' }}>
                        Joined: {formattedDate}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(member.id)}
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                  >
                    Remove Access
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Family Member</h2>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Grandma, Nana, Katherine & Matt"
                />
              </div>

              <div className="input-group">
                <label>Login Route *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) => setFormData({ ...formData, route: e.target.value.toLowerCase() })}
                    required
                    placeholder="e.g., grandma, nana, katherine-matt"
                    pattern="[a-z0-9-]+"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={generateRouteFromName}
                    className="btn btn-secondary"
                  >
                    From Name
                  </button>
                </div>
                <small style={{ color: '#718096', marginTop: '4px', display: 'block' }}>
                  They will login at /{formData.route || 'route'} (lowercase letters, numbers, hyphens only)
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Family Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
