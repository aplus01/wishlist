import { useState, useEffect } from 'react';
import { auth, items, formatCurrency, getImageUrl } from '../lib/pocketbase';
import WishlistTable from '../components/WishlistTable';

export default function ChildWishlist() {
  const [childData, setChildData] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    price: '',
    image_url: '',
  });
  const [scrapingImage, setScrapingImage] = useState(false);

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

      // Fix any items missing priorities first
      await items.fixMissingPriorities(childId);

      const itemsList = await items.list({ child: childId });
      // Filter out "from Santa" items - kids shouldn't see these
      const visibleItems = itemsList.filter((item) => !item.from_santa);
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

      console.log('Submitting item with data:', itemData);

      if (editingItem) {
        const result = await items.update(editingItem.id, itemData);
        console.log('Update result:', result);
      } else {
        const result = await items.create(itemData);
        console.log('Create result:', result);
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData({
        title: '',
        description: '',
        url: '',
        price: '',
        image_url: '',
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
      image_url: item.image_url || '',
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

  const handleScrapeImage = async () => {
    if (!formData.url) {
      alert('Please enter a product URL first.');
      return;
    }

    setScrapingImage(true);
    try {
      const imageUrl = await items.scrapeImage(formData.url);
      if (imageUrl) {
        setFormData({ ...formData, image_url: imageUrl });
      } else {
        alert(
          'Could not find an image on that page. You can enter an image URL manually.'
        );
      }
    } catch (err) {
      console.error('Error scraping image:', err);
      alert('Failed to scrape image. You can enter an image URL manually.');
    } finally {
      setScrapingImage(false);
    }
  };

  const handleReorder = async (updates) => {
    try {
      // Optimistically update local state immediately
      const updatedItems = [...wishlistItems];
      updates.forEach(({ id, priority }) => {
        const item = updatedItems.find((i) => i.id === id);
        if (item) {
          item.priority = priority;
        }
      });

      // Sort by new priorities
      updatedItems.sort((a, b) => {
        const priorityA = a.priority ?? 999999;
        const priorityB = b.priority ?? 999999;
        return priorityA - priorityB;
      });

      setWishlistItems(updatedItems);

      // Then save to backend
      await items.bulkUpdatePriorities(updates);
    } catch (err) {
      console.error('Error reordering items:', err);
      alert('Failed to reorder items. Please try again.');
      // Reload on error to revert optimistic update
      loadData();
    }
  };

  const handleSendToTop = async (itemId) => {
    try {
      // Find the item and move it to priority 0, shift others down
      const updates = wishlistItems.map((item, index) => {
        if (item.id === itemId) {
          return { id: item.id, priority: 0 };
        } else {
          return { id: item.id, priority: index + 1 };
        }
      });

      // Optimistically update local state
      const updatedItems = [...wishlistItems];
      const itemToMove = updatedItems.find((i) => i.id === itemId);
      const otherItems = updatedItems.filter((i) => i.id !== itemId);

      if (itemToMove) {
        itemToMove.priority = 0;
        otherItems.forEach((item, index) => {
          item.priority = index + 1;
        });
        const newOrder = [itemToMove, ...otherItems];
        console.log(
          'New order after send to top:',
          newOrder.map((i) => ({
            id: i.id,
            title: i.title,
            priority: i.priority,
          }))
        );
        setWishlistItems(newOrder);
      }

      // Save to backend
      await items.bulkUpdatePriorities(updates);
    } catch (err) {
      console.error('Error sending item to top:', err);
      alert('Failed to move item to top. Please try again.');
      loadData();
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

        <div
          style={{
            marginBottom: '30px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                title: '',
                description: '',
                url: '',
                price: '',
                image_url: '',
              });
              setShowModal(true);
            }}
            className='btn btn-primary'
          >
            + Add Item to Wishlist
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            className='btn btn-secondary'
          >
            {viewMode === 'card' ? '📋 Table View' : '🎁 Card View'}
          </button>
        </div>

        {wishlistItems.length === 0 ? (
          <div className='empty-state'>
            <h2>Your wishlist is empty</h2>
            <p>Add items you'd like for Christmas!</p>
          </div>
        ) : viewMode === 'table' ? (
          <WishlistTable
            items={wishlistItems}
            onReorder={handleReorder}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSendToTop={handleSendToTop}
          />
        ) : (
          <div className='grid grid-2'>
            {wishlistItems.map((item, index) => (
              <div key={item.id} className='item-card'>
                {item.image && (
                  <img
                    src={getImageUrl(item, item.image, '300x300')}
                    alt={item.title}
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '12px',
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
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

                <div className='item-actions'>
                  <button
                    onClick={() => handleSendToTop(item.id)}
                    disabled={index === 0}
                    className='btn btn-primary'
                    style={{
                      padding: '10px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: index === 0 ? 0.5 : 1,
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title={index === 0 ? 'Already at top' : 'Send to Top'}
                  >
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      height='20'
                      viewBox='0 -960 960 960'
                      width='20'
                      fill='currentColor'
                      style={{
                        display: 'block',
                        transform: 'translateY(2px)',
                      }}
                    >
                      <path d='M480-544 328-392l-56-56 208-208 208 208-56 56-152-152Zm0-240L328-632l-56-56 208-208 208 208-56 56-152-152Z' />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    disabled={item.status === 'approved'}
                    className='btn btn-secondary'
                    style={{
                      opacity: item.status === 'approved' ? 0.5 : 1,
                      cursor:
                        item.status === 'approved' ? 'not-allowed' : 'pointer',
                    }}
                    title={
                      item.status === 'approved'
                        ? 'Cannot edit approved items'
                        : 'Edit item'
                    }
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={item.status === 'approved'}
                    className='btn btn-danger'
                    style={{
                      opacity: item.status === 'approved' ? 0.5 : 1,
                      cursor:
                        item.status === 'approved' ? 'not-allowed' : 'pointer',
                    }}
                    title={
                      item.status === 'approved'
                        ? 'Cannot delete approved items'
                        : 'Delete item'
                    }
                  >
                    Delete
                  </button>
                </div>
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

              <div className='input-group'>
                <label>Image URL (optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type='url'
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, image_url: e.target.value })
                    }
                    placeholder='https://...'
                    style={{ flex: 1 }}
                  />
                  <button
                    type='button'
                    onClick={handleScrapeImage}
                    disabled={!formData.url || scrapingImage}
                    className='btn btn-secondary'
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {scrapingImage ? 'Scraping...' : '🔍 Auto-find'}
                  </button>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginTop: '4px',
                    marginBottom: '8px',
                  }}
                >
                  💡 Tip: Images are automatically downloaded and saved
                </p>
                {editingItem?.image && (
                  <div style={{ marginTop: '8px' }}>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                    >
                      Current image:
                    </p>
                    <img
                      src={getImageUrl(
                        editingItem,
                        editingItem.image,
                        '300x300'
                      )}
                      alt='Current'
                      style={{
                        width: '100%',
                        maxHeight: '200px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb',
                      }}
                    />
                  </div>
                )}
                {formData.image_url && !editingItem?.image && (
                  <img
                    src={formData.image_url}
                    alt='Preview'
                    style={{
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      marginTop: '8px',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
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
