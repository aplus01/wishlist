import { useState, useEffect } from 'react';
import pb, { children, authStore, formatCurrency } from '../lib/pocketbase';

export default function ManageChildren() {
  const [childrenList, setChildrenList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    route: '',
    target_budget: '',
  });

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      const userId = authStore.user()?.id;
      console.log('Loading children for parent ID:', userId);
      const list = await children.list(userId);
      console.log('Children loaded:', list);
      setChildrenList(list);
    } catch (err) {
      console.error('Error loading children:', err);
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
      const childData = {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        route: formData.route,
        target_budget: formData.target_budget
          ? parseFloat(formData.target_budget)
          : null,
        parent: editingChild ? editingChild.parent : [authStore.user()?.id],
      };

      if (editingChild) {
        await children.update(editingChild.id, childData);
      } else {
        await children.create(childData);
      }

      setShowModal(false);
      setEditingChild(null);
      setFormData({
        name: '',
        age: '',
        route: '',
        target_budget: '',
      });
      loadChildren();
    } catch (err) {
      console.error('Error saving child:', err);
      alert('Failed to save child. Please try again.');
    }
  };

  const handleEdit = (child) => {
    setEditingChild(child);
    setFormData({
      name: child.name,
      age: child.age?.toString() || '',
      route: child.route || '',
      target_budget: child.target_budget?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (childId) => {
    if (
      window.confirm(
        'Are you sure? This will delete the kid and all their wishlist items.'
      )
    ) {
      try {
        await children.delete(childId);
        loadChildren();
      } catch (err) {
        console.error('Error deleting child:', err);
        alert('Failed to delete kid.');
      }
    }
  };

  const generateRouteFromName = () => {
    const route = formData.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, route });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className='page-content'>
      <div style={{ marginBottom: '30px' }}>
        <h2>Manage Kids</h2>
        <p style={{ marginBottom: '20px' }}>
          Add your kids set up their custom login URL.
        </p>
        <button
          onClick={() => {
            setEditingChild(null);
            setFormData({
              name: '',
              age: '',
              route: '',
              target_budget: '',
            });
            setShowModal(true);
          }}
          className='btn btn-primary'
        >
          + Add Kid
        </button>
      </div>

      {childrenList.length === 0 ? (
        <div className='empty-state'>
          <h2>No kids added yet</h2>
          <p>Add your kids to get started with their wishlists.</p>
        </div>
      ) : (
        <div className='grid grid-2'>
          {childrenList.map((child) => (
            <div
              key={child.id}
              className='card card-bordered'
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>
                    {child.name}
                  </h3>
                  {child.age && (
                    <p style={{ color: '#718096' }}>Age: {child.age}</p>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: '#F8F4E3',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <strong>Login URL:</strong>
                </div>
                <div>
                  <a
                    href={`/${child.route}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: '#165B33',
                      textDecoration: 'none',
                      fontSize: '18px',
                    }}
                  >
                    /{child.route}
                  </a>
                </div>
              </div>

              {child.target_budget && (
                <div style={{ marginBottom: '16px' }}>
                  <strong>Target Budget:</strong>
                  <div
                    style={{
                      fontSize: '20px',
                      color: '#165B33',
                      marginTop: '4px',
                    }}
                  >
                    ${formatCurrency(child.target_budget)}
                  </div>
                </div>
              )}

              <div className='item-actions'>
                <button
                  onClick={() => handleEdit(child)}
                  className='btn btn-primary'
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(child.id)}
                  className='btn btn-danger'
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className='modal-overlay' onClick={() => setShowModal(false)}>
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>{editingChild ? 'Edit Kid' : 'Add New Kid'}</h2>

            <form onSubmit={handleSubmit}>
              <div className='input-group'>
                <label>Name *</label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="Kid's name"
                />
              </div>

              <div className='input-group'>
                <label>Age</label>
                <input
                  type='number'
                  min='0'
                  max='18'
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  placeholder='Optional'
                />
              </div>

              <div className='input-group'>
                <label>Login Route *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type='text'
                    value={formData.route}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        route: e.target.value.toLowerCase(),
                      })
                    }
                    required
                    placeholder='e.g., max, stella'
                    pattern='[a-z0-9-]+'
                    style={{ flex: 1 }}
                  />
                  <button
                    type='button'
                    onClick={generateRouteFromName}
                    className='btn btn-secondary'
                  >
                    From Name
                  </button>
                </div>
                <small
                  style={{
                    color: '#718096',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Your kid will login at /{formData.route || 'route'} (lowercase
                  letters, numbers, hyphens only)
                </small>
              </div>

              <div className='input-group'>
                <label>Target Budget (Optional)</label>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  value={formData.target_budget}
                  onChange={(e) =>
                    setFormData({ ...formData, target_budget: e.target.value })
                  }
                  placeholder='e.g., 300.00'
                />
                <small
                  style={{
                    color: '#718096',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Used for equity tracking
                </small>
              </div>

              <div className='modal-actions'>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  className='btn btn-secondary'
                >
                  Cancel
                </button>
                <button type='submit' className='btn btn-primary'>
                  {editingChild ? 'Update' : 'Add'} Kid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
