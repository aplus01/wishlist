import { useState, useEffect } from 'react';
import {
  items,
  children,
  authStore,
  formatCurrency,
  reservations,
} from '../lib/pocketbase';

export default function ReviewItems() {
  const [allItems, setAllItems] = useState([]);
  const [childrenList, setChildrenList] = useState([]);
  const [filter, setFilter] = useState('all'); // pending, approved, rejected, all
  const [kidFilter, setKidFilter] = useState('all'); // all or specific kid id
  const [reservationFilter, setReservationFilter] = useState('all'); // all, reserved, not_reserved
  const [purchaseFilter, setPurchaseFilter] = useState('all'); // all, purchased, not_purchased
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [showSantaModal, setShowSantaModal] = useState(false);
  const [santaFormData, setSantaFormData] = useState({
    title: '',
    description: '',
    url: '',
    price: '',
    child: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = authStore.user()?.id;
      const childrenData = await children.list(userId);
      setChildrenList(childrenData);

      const allItemsList = await items.list();
      setAllItems(allItemsList);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId) => {
    try {
      await items.approve(itemId);
      loadData();
    } catch (err) {
      console.error('Error approving item:', err);
      alert('Failed to approve item.');
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;

    try {
      await items.reject(rejectingItem.id);
      setShowRejectModal(false);
      setRejectingItem(null);
      loadData();
    } catch (err) {
      console.error('Error rejecting item:', err);
      alert('Failed to reject item.');
    }
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await items.delete(itemId);
        loadData();
      } catch (err) {
        console.error('Error deleting item:', err);
        alert('Failed to delete item.');
      }
    }
  };

  const handleSantaSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        title: santaFormData.title,
        description: santaFormData.description,
        url: santaFormData.url,
        price: parseFloat(santaFormData.price),
        child: santaFormData.child,
        status: 'approved',
        from_santa: true,
        approved_at: new Date().toISOString(),
      };

      await items.create(itemData);
      setShowSantaModal(false);
      setSantaFormData({
        title: '',
        description: '',
        url: '',
        price: '',
        child: '',
      });
      loadData();
    } catch (err) {
      console.error('Error creating Santa gift:', err);
      alert('Failed to create Santa gift. Please try again.');
    }
  };

  const openRejectModal = (item) => {
    setRejectingItem(item);
    setShowRejectModal(true);
  };

  const handleMarkSantaGiftPurchased = async (item) => {
    try {
      // Normalize reservations to always be an array
      const reservationsList = item.expand?.reservations_via_item
        ? Array.isArray(item.expand.reservations_via_item)
          ? item.expand.reservations_via_item
          : [item.expand.reservations_via_item]
        : [];
      const existingReservation = reservationsList[0];

      if (existingReservation) {
        // Update existing reservation to purchased
        await reservations.update(existingReservation.id, { purchased: true });
      } else {
        // Create new reservation as purchased
        const reservation = await reservations.create(item.id);
        await reservations.markPurchased(reservation.id);
      }

      loadData();
    } catch (err) {
      console.error('Error marking Santa gift as purchased:', err);
      alert('Failed to mark as purchased.');
    }
  };

  const handleUnmarkSantaGiftPurchased = async (item) => {
    try {
      // Normalize reservations to always be an array
      const reservationsList = item.expand?.reservations_via_item
        ? Array.isArray(item.expand.reservations_via_item)
          ? item.expand.reservations_via_item
          : [item.expand.reservations_via_item]
        : [];
      const existingReservation = reservationsList[0];

      if (existingReservation) {
        await reservations.update(existingReservation.id, { purchased: false });
        loadData();
      }
    } catch (err) {
      console.error('Error unmarking Santa gift as purchased:', err);
      alert('Failed to unmark as purchased.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Helper function to check if an item matches the non-status filters
  const matchesFilters = (item) => {
    // Filter by kid
    const kidMatch = kidFilter === 'all' || item.child === kidFilter;

    // Normalize reservations to always be an array
    const reservations = item.expand?.reservations_via_item
      ? Array.isArray(item.expand.reservations_via_item)
        ? item.expand.reservations_via_item
        : [item.expand.reservations_via_item]
      : [];

    // Filter by reservation status
    const hasReservation = reservations.length > 0;
    let reservationMatch = true;
    if (reservationFilter === 'reserved') reservationMatch = hasReservation;
    if (reservationFilter === 'not_reserved')
      reservationMatch = !hasReservation;

    // Filter by purchase status
    const isPurchased = reservations.some((res) => res.purchased);
    let purchaseMatch = true;
    if (purchaseFilter === 'purchased') purchaseMatch = isPurchased;
    if (purchaseFilter === 'not_purchased') purchaseMatch = !isPurchased;

    return kidMatch && reservationMatch && purchaseMatch;
  };

  const filteredItems = allItems.filter((item) => {
    // Filter by status
    const statusMatch = filter === 'all' || item.status === filter;
    return statusMatch && matchesFilters(item);
  });

  const getKidName = (childId) => {
    const child = childrenList.find((c) => c.id === childId);
    return child?.name || 'Unknown';
  };

  // Calculate counts based on current filters (kid, reservation, purchase)
  const pendingCount = allItems.filter(
    (item) => item.status === 'pending' && matchesFilters(item)
  ).length;
  const approvedCount = allItems.filter(
    (item) => item.status === 'approved' && matchesFilters(item)
  ).length;
  const rejectedCount = allItems.filter(
    (item) => item.status === 'rejected' && matchesFilters(item)
  ).length;
  const allCount = allItems.filter(matchesFilters).length;

  return (
    <div className='page-content'>
      <div style={{ marginBottom: '30px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2>Review Items</h2>
            <p>
              Review and approve items from your kids' wishlists. Approved items
              will be visible to family members.
            </p>
          </div>
          <button
            onClick={() => {
              setSantaFormData({
                title: '',
                description: '',
                url: '',
                price: '',
                child: childrenList.length > 0 ? childrenList[0].id : '',
              });
              setShowSantaModal(true);
            }}
            className='btn btn-success'
            style={{ whiteSpace: 'nowrap' }}
          >
            🎅 Add Secret Santa Gift
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: '#165B33',
              }}
            >
              Kid:
            </label>
            <select
              value={kidFilter}
              onChange={(e) => setKidFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                fontSize: '16px',
                border: '2px solid #165B33',
                background: 'white',
                color: '#165B33',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <option value='all'>All Kids</option>
              {childrenList.map((kid) => (
                <option key={kid.id} value={kid.id}>
                  {kid.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: '#165B33',
              }}
            >
              Reservation:
            </label>
            <select
              value={reservationFilter}
              onChange={(e) => setReservationFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                fontSize: '16px',
                border: '2px solid #165B33',
                background: 'white',
                color: '#165B33',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <option value='all'>All</option>
              <option value='reserved'>Reserved</option>
              <option value='not_reserved'>Not Reserved</option>
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: '#165B33',
              }}
            >
              Purchase:
            </label>
            <select
              value={purchaseFilter}
              onChange={(e) => setPurchaseFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                fontSize: '16px',
                border: '2px solid #165B33',
                background: 'white',
                color: '#165B33',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <option value='all'>All</option>
              <option value='purchased'>Purchased</option>
              <option value='not_purchased'>Not Purchased</option>
            </select>
          </div>
        </div>

        <div className='filter-buttons'>
          <button
            onClick={() => setFilter('all')}
            className='btn'
            style={{
              background: filter === 'all' ? 'var(--green-medium)' : 'white',
              color: filter === 'all' ? 'var(--white)' : 'var(--text-dark)',
              fontWeight: filter === 'all' ? 700 : 500,
              border: '1px solid #d1d5db',
            }}
          >
            All ({allCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className='btn'
            style={{
              background:
                filter === 'pending' ? 'var(--green-medium)' : 'white',
              color: filter === 'pending' ? 'var(--white)' : 'var(--text-dark)',
              fontWeight: filter === 'pending' ? 700 : 500,
              border: '1px solid #d1d5db',
            }}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className='btn'
            style={{
              background:
                filter === 'approved' ? 'var(--green-medium)' : 'white',
              color:
                filter === 'approved' ? 'var(--white)' : 'var(--text-dark)',
              fontWeight: filter === 'approved' ? 700 : 500,
              border: '1px solid #d1d5db',
            }}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className='btn'
            style={{
              background:
                filter === 'rejected' ? 'var(--green-medium)' : 'white',
              color:
                filter === 'rejected' ? 'var(--white)' : 'var(--text-dark)',
              fontWeight: filter === 'rejected' ? 700 : 500,
              border: '1px solid #d1d5db',
            }}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className='empty-state'>
          <h2>No items found</h2>
          <p>
            {filter === 'pending' && 'No items waiting for review.'}
            {filter === 'approved' && 'No approved items yet.'}
            {filter === 'rejected' && 'No rejected items.'}
            {filter === 'all' && 'No items have been added yet.'}
          </p>
        </div>
      ) : (
        <div className='grid grid-2'>
          {filteredItems.map((item) => (
            <div key={item.id} className='item-card'>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <h3 style={{ flex: 1 }}>{item.title}</h3>
                {item.from_santa && (
                  <span
                    style={{
                      background: '#991b1b',
                      color: '#ffffff',
                      padding: '4px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    🎅 From Santa
                  </span>
                )}
                <span className={`badge badge-${item.status}`}>
                  {item.status}
                </span>
              </div>

              <div
                style={{
                  fontSize: '14px',
                  color: '#1E7B46',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                {getKidName(item.child)}
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

              {(() => {
                const reservations = item.expand?.reservations_via_item
                  ? Array.isArray(item.expand.reservations_via_item)
                    ? item.expand.reservations_via_item
                    : [item.expand.reservations_via_item]
                  : [];
                return (
                  reservations.length > 0 && (
                    <div
                      style={{
                        background: '#dbeafe',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1e40af',
                        marginBottom: '12px',
                      }}
                    >
                      <strong>Reserved by:</strong>{' '}
                      {reservations[0].expand?.reserved_by?.name ||
                        'Family member'}
                    </div>
                  )
                );
              })()}

              <div className='item-actions'>
                {item.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(item.id)}
                      className='btn btn-success'
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openRejectModal(item)}
                      className='btn btn-danger'
                    >
                      Reject
                    </button>
                  </>
                )}
                {item.status === 'rejected' && (
                  <button
                    onClick={() => handleApprove(item.id)}
                    className='btn btn-success'
                  >
                    Approve
                  </button>
                )}
                {(() => {
                  const reservations = item.expand?.reservations_via_item
                    ? Array.isArray(item.expand.reservations_via_item)
                      ? item.expand.reservations_via_item
                      : [item.expand.reservations_via_item]
                    : [];
                  return (
                    item.status === 'approved' &&
                    reservations.length === 0 &&
                    !item.from_santa && (
                      <button
                        onClick={() => openRejectModal(item)}
                        className='btn btn-danger'
                      >
                        Unapprove
                      </button>
                    )
                  );
                })()}
                {(() => {
                  const reservations = item.expand?.reservations_via_item
                    ? Array.isArray(item.expand.reservations_via_item)
                      ? item.expand.reservations_via_item
                      : [item.expand.reservations_via_item]
                    : [];
                  return (
                    item.from_santa &&
                    item.status === 'approved' && (
                      <>
                        {reservations[0]?.purchased ? (
                          <>
                            <div
                              style={{
                                background: '#d1fae5',
                                padding: '8px',
                                textAlign: 'center',
                                color: '#065f46',
                                fontWeight: 600,
                                marginBottom: '8px',
                                flex: '1 0 100%',
                              }}
                            >
                              ✓ Purchased
                            </div>
                            <button
                              onClick={() =>
                                handleUnmarkSantaGiftPurchased(item)
                              }
                              className='btn btn-secondary'
                            >
                              Mark as Not Purchased
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleMarkSantaGiftPurchased(item)}
                            className='btn btn-success'
                          >
                            Mark as Purchased
                          </button>
                        )}
                      </>
                    )
                  );
                })()}
                <button
                  onClick={() => handleDelete(item.id)}
                  className='btn btn-secondary'
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRejectModal && (
        <div
          className='modal-overlay'
          onClick={() => setShowRejectModal(false)}
        >
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>Reject Item</h2>
            <p style={{ marginBottom: '20px' }}>
              Are you sure you want to reject "{rejectingItem?.title}"?
            </p>

            <div className='modal-actions'>
              <button
                onClick={() => setShowRejectModal(false)}
                className='btn btn-secondary'
              >
                Cancel
              </button>
              <button onClick={handleReject} className='btn btn-danger'>
                Reject Item
              </button>
            </div>
          </div>
        </div>
      )}

      {showSantaModal && (
        <div className='modal-overlay' onClick={() => setShowSantaModal(false)}>
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>🎅 Add Secret Santa Gift</h2>
            <p style={{ marginBottom: '20px', color: '#718096' }}>
              This gift will be approved and visible to you, but hidden from the
              kid and other family members.
            </p>

            <form onSubmit={handleSantaSubmit}>
              <div className='input-group'>
                <label>Kid *</label>
                <select
                  value={santaFormData.child}
                  onChange={(e) =>
                    setSantaFormData({
                      ...santaFormData,
                      child: e.target.value,
                    })
                  }
                  required
                >
                  <option value=''>Select a kid</option>
                  {childrenList.map((kid) => (
                    <option key={kid.id} value={kid.id}>
                      {kid.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='input-group'>
                <label>Item Name *</label>
                <input
                  type='text'
                  value={santaFormData.title}
                  onChange={(e) =>
                    setSantaFormData({
                      ...santaFormData,
                      title: e.target.value,
                    })
                  }
                  required
                  placeholder='e.g., LEGO Star Wars Set'
                />
              </div>

              <div className='input-group'>
                <label>Description</label>
                <textarea
                  value={santaFormData.description}
                  onChange={(e) =>
                    setSantaFormData({
                      ...santaFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder='Optional notes...'
                />
              </div>

              <div className='input-group'>
                <label>Price *</label>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  value={santaFormData.price}
                  onChange={(e) =>
                    setSantaFormData({
                      ...santaFormData,
                      price: e.target.value,
                    })
                  }
                  required
                  placeholder='0.00'
                />
              </div>

              <div className='input-group'>
                <label>Product URL</label>
                <input
                  type='url'
                  value={santaFormData.url}
                  onChange={(e) =>
                    setSantaFormData({ ...santaFormData, url: e.target.value })
                  }
                  placeholder='https://...'
                />
              </div>

              <div className='modal-actions'>
                <button
                  type='button'
                  onClick={() => setShowSantaModal(false)}
                  className='btn btn-secondary'
                >
                  Cancel
                </button>
                <button type='submit' className='btn btn-success'>
                  Add Santa Gift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
