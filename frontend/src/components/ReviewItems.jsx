import { useState, useEffect } from 'react';
import {
  items,
  children,
  authStore,
  formatCurrency,
  reservations,
  getImageUrl,
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showSantaModal, setShowSantaModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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
      setErrorMessage('Failed to approve item.');
      setShowErrorModal(true);
    }
  };

  const handleUnapprove = async (itemId) => {
    try {
      await items.unapprove(itemId);
      loadData();
    } catch (err) {
      console.error('Error unapproving item:', err);
      setErrorMessage('Failed to unapprove item.');
      setShowErrorModal(true);
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
      setErrorMessage('Failed to reject item.');
      setShowErrorModal(true);
    }
  };

  const openDeleteModal = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      await items.delete(deletingItem.id);
      setShowDeleteModal(false);
      setDeletingItem(null);
      loadData();
    } catch (err) {
      console.error('Error deleting item:', err);
      setErrorMessage('Failed to delete item.');
      setShowErrorModal(true);
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
      setErrorMessage('Failed to create Santa gift. Please try again.');
      setShowErrorModal(true);
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
      setErrorMessage('Failed to mark as purchased.');
      setShowErrorModal(true);
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
      setErrorMessage('Failed to unmark as purchased.');
      setShowErrorModal(true);
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
                color: 'var(--green-dark)',
              }}
            >
              Kid:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={kidFilter}
                onChange={(e) => setKidFilter(e.target.value)}
                style={{
                  padding: '10px 16px',
                  paddingRight: '40px',
                  fontSize: '16px',
                  border: '1px solid var(--green-dark)',
                  borderRadius: '0',
                  background: 'white',
                  color: 'var(--green-dark)',
                  cursor: 'pointer',
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  outline: 'none',
                }}
              >
                <option value='all'>All Kids</option>
                {childrenList.map((kid) => (
                  <option key={kid.id} value={kid.id}>
                    {kid.name}
                  </option>
                ))}
              </select>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24px'
                viewBox='0 0 24 24'
                width='24px'
                fill='var(--green-dark)'
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <path d='M0 0h24v24H0V0z' fill='none' />
                <path d='M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z' />
              </svg>
            </div>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: 'var(--green-dark)',
              }}
            >
              Reservation:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={reservationFilter}
                onChange={(e) => setReservationFilter(e.target.value)}
                style={{
                  padding: '10px 16px',
                  paddingRight: '40px',
                  fontSize: '16px',
                  border: '1px solid var(--green-dark)',
                  borderRadius: '0',
                  background: 'white',
                  color: 'var(--green-dark)',
                  cursor: 'pointer',
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  outline: 'none',
                }}
              >
                <option value='all'>All</option>
                <option value='reserved'>Reserved</option>
                <option value='not_reserved'>Not Reserved</option>
              </select>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24px'
                viewBox='0 0 24 24'
                width='24px'
                fill='var(--green-dark)'
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <path d='M0 0h24v24H0V0z' fill='none' />
                <path d='M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z' />
              </svg>
            </div>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: 'var(--green-dark)',
              }}
            >
              Purchase:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={purchaseFilter}
                onChange={(e) => setPurchaseFilter(e.target.value)}
                style={{
                  padding: '10px 16px',
                  paddingRight: '40px',
                  fontSize: '16px',
                  border: '1px solid var(--green-dark)',
                  borderRadius: '0',
                  background: 'white',
                  color: 'var(--green-dark)',
                  cursor: 'pointer',
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  outline: 'none',
                }}
              >
                <option value='all'>All</option>
                <option value='purchased'>Purchased</option>
                <option value='not_purchased'>Not Purchased</option>
              </select>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24px'
                viewBox='0 0 24 24'
                width='24px'
                fill='var(--green-dark)'
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <path d='M0 0h24v24H0V0z' fill='none' />
                <path d='M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z' />
              </svg>
            </div>
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
        <div
          style={{
            overflowX: 'auto',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            border: '1px solid #d4d4d4',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--green-medium)',
                  color: 'white',
                }}
              >
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: '80px',
                  }}
                >
                  Image
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  Item
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: '120px',
                  }}
                >
                  Kid
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: '100px',
                  }}
                >
                  Price
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: '100px',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: 600,
                    width: '200px',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const reservations = item.expand?.reservations_via_item
                  ? Array.isArray(item.expand.reservations_via_item)
                    ? item.expand.reservations_via_item
                    : [item.expand.reservations_via_item]
                  : [];
                const hasReservation = reservations.length > 0;
                const isPurchased = reservations.some((res) => res.purchased);

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: 'white',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      {item.image ? (
                        <img
                          src={getImageUrl(item, item.image, '100x100')}
                          alt={item.title}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            background: 'var(--placeholder-bg)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--placeholder-icon)',
                            fontSize: '24px',
                          }}
                        >
                          🎁
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
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
                          {item.from_santa && (
                            <span
                              style={{
                                background: '#991b1b',
                                color: '#ffffff',
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🎅 From Santa
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: '14px',
                              color: '#6b7280',
                              marginBottom: '4px',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                        {hasReservation && (
                          <div
                            style={{
                              background: '#dbeafe',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#1e40af',
                              marginTop: '4px',
                              display: 'inline-block',
                            }}
                          >
                            <strong>Reserved by:</strong>{' '}
                            {reservations[0].expand?.reserved_by?.name ||
                              'Family member'}
                            {isPurchased && ' • ✓ Purchased'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: 600,
                        color: '#1E7B46',
                      }}
                    >
                      {getKidName(item.child)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: 600,
                        color: '#1E7B46',
                      }}
                    >
                      ${formatCurrency(item.price)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge badge-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        {item.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className='btn btn-success'
                              style={{
                                padding: '6px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title='Approve'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                height='18px'
                                viewBox='0 -960 960 960'
                                width='18px'
                                fill='currentColor'
                              >
                                <path d='M720-120H280v-520l280-280 50 50q7 7 11.5 19t4.5 23v14l-44 174h258q32 0 56 24t24 56v80q0 7-2 15t-4 15L794-168q-9 20-30 34t-44 14Zm-360-80h360l120-280v-80H480l54-220-174 174v406Zm0-406v406-406Zm-80-34v80H160v360h120v80H80v-520h200Z' />
                              </svg>
                            </button>
                            <button
                              onClick={() => openRejectModal(item)}
                              className='btn btn-danger'
                              style={{
                                padding: '6px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title='Reject'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                height='18px'
                                viewBox='0 -960 960 960'
                                width='18px'
                                fill='currentColor'
                              >
                                <path d='M240-840h440v520L400-40l-50-50q-7-7-11.5-19t-4.5-23v-14l44-174H120q-32 0-56-24t-24-56v-80q0-7 2-15t4-15l120-282q9-20 30-34t44-14Zm360 80H240L120-480v80h360l-54 220 174-174v-406Zm0 406v-406 406Zm80 34v-80h120v-360H680v-80h200v520H680Z' />
                              </svg>
                            </button>
                          </>
                        )}
                        {item.status === 'rejected' && (
                          <button
                            onClick={() => handleUnapprove(item.id)}
                            className='btn btn-secondary'
                            style={{
                              padding: '6px 12px',
                            }}
                            title='Return to Pending'
                          >
                            Unreject
                          </button>
                        )}
                        {item.status === 'approved' &&
                          !hasReservation &&
                          !item.from_santa && (
                            <button
                              onClick={() => handleUnapprove(item.id)}
                              className='btn btn-secondary'
                              style={{
                                padding: '6px 12px',
                              }}
                            >
                              Unapprove
                            </button>
                          )}
                        {item.from_santa && item.status === 'approved' && (
                          <>
                            {isPurchased ? (
                              <button
                                onClick={() =>
                                  handleUnmarkSantaGiftPurchased(item)
                                }
                                className='btn btn-secondary'
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                }}
                              >
                                Unmark Purchase
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleMarkSantaGiftPurchased(item)
                                }
                                className='btn btn-success'
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                }}
                              >
                                Mark Purchased
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => openDeleteModal(item)}
                          className='btn'
                          style={{
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            color: '#C41E3A',
                            border: '1px solid #C41E3A',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#C41E3A';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#C41E3A';
                          }}
                          title='Delete'
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            height='18px'
                            viewBox='0 -960 960 960'
                            width='18px'
                            fill='currentColor'
                          >
                            <path d='M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {showDeleteModal && (
        <div
          className='modal-overlay'
          onClick={() => setShowDeleteModal(false)}
        >
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>Delete Item</h2>
            <p style={{ marginBottom: '20px' }}>
              Are you sure you want to permanently delete "{deletingItem?.title}
              "?
            </p>

            <div className='modal-actions'>
              <button
                onClick={() => setShowDeleteModal(false)}
                className='btn btn-secondary'
              >
                Cancel
              </button>
              <button onClick={handleDelete} className='btn btn-danger'>
                Delete Item
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

      {showErrorModal && (
        <div className='modal-overlay' onClick={() => setShowErrorModal(false)}>
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>Error</h2>
            <p style={{ marginBottom: '20px' }}>{errorMessage}</p>

            <div className='modal-actions'>
              <button
                onClick={() => setShowErrorModal(false)}
                className='btn btn-primary'
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
