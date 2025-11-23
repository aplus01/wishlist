import { useState, useEffect } from 'react';
import { auth, items, formatCurrency } from '../lib/pocketbase';

export default function ChildWishlist() {
  const [childData, setChildData] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    price: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const childId = sessionStorage.getItem('activeChildId');
      const childDataStr = sessionStorage.getItem('childData');

      if (childDataStr) {
        const child = JSON.parse(childDataStr);
        setChildData(child);
      }

      const itemsList = await items.list({ child: childId });
      // Filter out "from Santa" items - kids shouldn't see these
      const visibleItems = itemsList.filter(item => !item.from_santa);
      setWishlistItems(visibleItems);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const itemData = {
        ...formData,
        child: childData.id,
        price: parseFloat(formData.price),
      };

      if (editingItem) {
        await items.update(editingItem.id, itemData);
      } else {
        await items.create(itemData);
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData({
        title: '',
        description: '',
        url: '',
        price: '',
      });
      loadData();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Failed to save item. Please try again.');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      url: item.url || '',
      price: item.price.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await items.delete(itemId);
        loadData();
      } catch (err) {
        console.error('Error deleting item:', err);
        alert('Failed to delete item. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  if (loading) {
    return <div className='container'>Loading...</div>;
  }

  const pendingItems = wishlistItems.filter(
    (item) => item.status === 'pending'
  );
  const approvedItems = wishlistItems.filter(
    (item) => item.status === 'approved'
  );

  return (
    <>
      <div className='header'>
        <div className='header-content'>
          <h1>🎁 {childData?.name}'s Wishlist</h1>
          <button onClick={handleLogout} className='btn btn-secondary'>
            Logout
          </button>
        </div>
      </div>

      <div className='container'>
        <div className='stats-grid'>
          <div className='stat-card'>
            <h3>Pending</h3>
            <div className='value'>{pendingItems.length}</div>
          </div>
          <div className='stat-card'>
            <h3>Approved</h3>
            <div className='value'>{approvedItems.length}</div>
          </div>
          <div className='stat-card'>
            <h3>Total Items</h3>
            <div className='value'>{wishlistItems.length}</div>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                title: '',
                description: '',
                url: '',
                price: '',
              });
              setShowModal(true);
            }}
            className='btn btn-primary'
          >
            + Add Item to Wishlist
          </button>
        </div>

        {wishlistItems.length === 0 ? (
          <div className='empty-state'>
            <h2>Your wishlist is empty</h2>
            <p>Add items you'd like for Christmas!</p>
          </div>
        ) : (
          <div className='grid grid-2'>
            {wishlistItems.map((item) => (
              <div key={item.id} className='item-card'>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px',
                  }}
                >
                  <h3 style={{ flex: 1 }}>{item.title}</h3>
                  <span className={`badge badge-${item.status}`}>
                    {item.status}
                  </span>
                </div>

                {item.description && <p>{item.description}</p>}

                <div className='price'>${formatCurrency(item.price)}</div>

                {item.url && (
                  <a
                    href={item.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    style={{
                      color: '#1E7B46',
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: '12px',
                    }}
                  >
                    View Product →
                  </a>
                )}

                {item.status === 'pending' && (
                  <div className='item-actions'>
                    <button
                      onClick={() => handleEdit(item)}
                      className='btn btn-secondary'
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className='btn btn-danger'
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className='modal-overlay' onClick={() => setShowModal(false)}>
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>

            <form onSubmit={handleSubmit}>
              <div className='input-group'>
                <label>Item Name *</label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  placeholder='e.g., LEGO Star Wars Set'
                />
              </div>

              <div className='input-group'>
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder='Tell us why you want this...'
                />
              </div>

              <div className='input-group'>
                <label>Price *</label>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                  placeholder='0.00'
                />
              </div>

              <div className='input-group'>
                <label>Product URL</label>
                <input
                  type='url'
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder='https://...'
                />
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
                  {editingItem ? 'Update' : 'Add'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
