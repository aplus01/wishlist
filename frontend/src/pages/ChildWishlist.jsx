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
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              background: 'var(--container-header-bg-color)',
              padding: '20px 24px',
              color: '#FFFFFF',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
              My Wishlist
            </h2>
          </div>

          <div style={{ padding: '24px' }}>
            <div
              style={{
                marginBottom: '24px',
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
                onClick={() =>
                  setViewMode(viewMode === 'card' ? 'table' : 'card')
                }
                className='btn btn-secondary'
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                title={
                  viewMode === 'card'
                    ? 'Switch to List View'
                    : 'Switch to Grid View'
                }
              >
                {viewMode === 'card' ? (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    height='28px'
                    viewBox='0 -960 960 960'
                    width='28px'
                    fill='currentColor'
                  >
                    <path d='M280-600v-80h560v80H280Zm0 160v-80h560v80H280Zm0 160v-80h560v80H280ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z' />
                  </svg>
                ) : (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    height='28px'
                    viewBox='0 -960 960 960'
                    width='28px'
                    fill='currentColor'
                  >
                    <path d='M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Zm400-400Zm0 240Zm-240 0Zm0-240Z' />
                  </svg>
                )}
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
                    {item.image ? (
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
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '200px',
                          background: 'var(--placeholder-bg)',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--placeholder-icon)',
                          fontSize: '64px',
                        }}
                      >
                        🎁
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '8px',
                      }}
                    >
                      <h3>
                        {item.url ? (
                          <a
                            href={item.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            style={{
                              color: '#1E7B46',
                              textDecoration: 'underline',
                            }}
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </h3>
                    </div>

                    {item.description && <p>{item.description}</p>}

                    <div className='price'>${formatCurrency(item.price)}</div>

                    <div className='item-actions'>
                      <button
                        onClick={() => handleSendToTop(item.id)}
                        disabled={index === 0}
                        className='btn btn-primary'
                        style={{
                          width: '40px',
                          padding: '6px',
                          opacity: index === 0 ? 0.5 : 1,
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={index === 0 ? 'Already at top' : 'Send to Top'}
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          height='24'
                          viewBox='0 -960 960 960'
                          width='24'
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
                        className='btn'
                        style={{
                          width: '40px',
                          padding: '6px',
                          opacity: item.status === 'approved' ? 0.5 : 1,
                          cursor:
                            item.status === 'approved'
                              ? 'not-allowed'
                              : 'pointer',
                          background: 'transparent',
                          color: 'var(--edit-btn)',
                          border: '1px solid var(--edit-btn)',
                        }}
                        onMouseEnter={(e) => {
                          if (item.status !== 'approved') {
                            e.currentTarget.style.background =
                              'var(--edit-btn)';
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (item.status !== 'approved') {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--edit-btn)';
                          }
                        }}
                        title={
                          item.status === 'approved'
                            ? 'Cannot edit approved items'
                            : 'Edit item'
                        }
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          height='24'
                          viewBox='0 -960 960 960'
                          width='24'
                          fill='currentColor'
                        >
                          <path d='M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z' />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={item.status === 'approved'}
                        className='btn'
                        style={{
                          width: '40px',
                          padding: '6px',
                          opacity: item.status === 'approved' ? 0.5 : 1,
                          cursor:
                            item.status === 'approved'
                              ? 'not-allowed'
                              : 'pointer',
                          background: 'transparent',
                          color: '#C41E3A',
                          border: '1px solid #C41E3A',
                        }}
                        onMouseEnter={(e) => {
                          if (item.status !== 'approved') {
                            e.currentTarget.style.background = '#C41E3A';
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (item.status !== 'approved') {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#C41E3A';
                          }
                        }}
                        title={
                          item.status === 'approved'
                            ? 'Cannot delete approved items'
                            : 'Delete item'
                        }
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          height='24'
                          viewBox='0 -960 960 960'
                          width='24'
                          fill='currentColor'
                        >
                          <path d='M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                  placeholder='Include important details like size, color, model number, etc.'
                />
              </div>

              <div className='input-group'>
                <label>Price *</label>
                <input
                  type='text'
                  inputMode='decimal'
                  value={formData.price}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setFormData({ ...formData, price: value });
                  }}
                  required
                  placeholder='$0.00'
                  style={{
                    appearance: 'none',
                    MozAppearance: 'textfield',
                  }}
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
