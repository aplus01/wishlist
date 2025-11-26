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
  const [showUnreserveModal, setShowUnreserveModal] = useState(false);
  const [unreservingId, setUnreservingId] = useState(null);
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

      // Get all items to find parents with wishlists
      const allItemsList = await items.list();

      // Extract unique parent IDs from items that have a parent field
      const parentIds = [...new Set(
        allItemsList
          .filter(item => item.parent)
          .map(item => item.parent)
      )];

      // Combine children with parents who have wishlists
      // Map children to have type 'child' and parents to have type 'parent'
      const childrenWithType = childrenData.map(child => ({
        ...child,
        type: 'child',
        displayName: child.name
      }));

      const parentsWithWishlists = allItemsList
        .filter(item => item.parent && item.expand?.parent)
        .reduce((acc, item) => {
          const parent = item.expand.parent;
          if (!acc.find(p => p.id === parent.id)) {
            acc.push({
              id: parent.id,
              name: parent.name,
              type: 'parent',
              displayName: parent.name
            });
          }
          return acc;
        }, []);

      setChildrenList([...childrenWithType, ...parentsWithWishlists]);
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


  const handleSantaSubmit = async (e) => {
    e.preventDefault();
    try {
      // Normalize URL - prepend https:// if it doesn't start with it
      let normalizedUrl = santaFormData.url;
      if (normalizedUrl && !normalizedUrl.startsWith('https://') && !normalizedUrl.startsWith('http://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      const itemData = {
        title: santaFormData.title,
        description: santaFormData.description,
        url: normalizedUrl,
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


  const handleReserve = async (itemId) => {
    try {
      const currentUser = authStore.user();
      await reservations.create(itemId, currentUser?.id);
      loadData();
    } catch (err) {
      console.error('Error reserving item:', err);
      const errMsg =
        err.message || 'Failed to reserve item. It may already be reserved.';
      setErrorMessage(errMsg);
      setShowErrorModal(true);
    }
  };

  const openUnreserveModal = (reservationId) => {
    setUnreservingId(reservationId);
    setShowUnreserveModal(true);
  };

  const handleUnreserve = async () => {
    if (!unreservingId) return;

    try {
      await reservations.delete(unreservingId);
      setShowUnreserveModal(false);
      setUnreservingId(null);
      loadData();
    } catch (err) {
      console.error('Error unreserving item:', err);
      setErrorMessage('Failed to unreserve item.');
      setShowErrorModal(true);
      setShowUnreserveModal(false);
      setUnreservingId(null);
    }
  };

  const handleMarkPurchased = async (reservationId) => {
    try {
      await reservations.markPurchased(reservationId);
      loadData();
    } catch (err) {
      console.error('Error marking as purchased:', err);
      setErrorMessage('Failed to mark as purchased.');
      setShowErrorModal(true);
    }
  };

  const handleMarkNotPurchased = async (reservationId) => {
    try {
      await reservations.update(reservationId, { purchased: false });
      loadData();
    } catch (err) {
      console.error('Error marking as not purchased:', err);
      setErrorMessage('Failed to mark as not purchased.');
      setShowErrorModal(true);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Helper function to check if an item matches the non-status filters
  const matchesFilters = (item) => {
    // Filter by kid (or parent)
    const kidMatch = kidFilter === 'all' || item.child === kidFilter || item.parent === kidFilter;

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

  const getPersonName = (item) => {
    // Check if item belongs to parent
    if (item.parent) {
      return item.expand?.parent?.name || 'Unknown Parent';
    }

    // Otherwise, it's a child item
    const child = childrenList.find((c) => c.id === item.child);
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
        <div className='review-header'>
          <h2>Review Items</h2>
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
        <p className='review-description'>
          Review and approve items from your kids' wishlists. Approved items
          will be visible to family members.
        </p>

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
                <option value='all'>All</option>
                {[...childrenList]
                  .sort((a, b) => a.displayName.localeCompare(b.displayName))
                  .map((kid) => (
                    <option key={kid.id} value={kid.id}>
                      {kid.displayName}
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
        <>
          {/* Table View - Desktop Only */}
          <div className='review-items-table-wrapper'>
            <table className='review-items-table'>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Image</th>
                  <th>Item</th>
                  <th style={{ width: '120px' }}>Kid</th>
                  <th style={{ width: '100px' }}>Price</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const itemReservations = item.expand?.reservations_via_item
                    ? Array.isArray(item.expand.reservations_via_item)
                      ? item.expand.reservations_via_item
                      : [item.expand.reservations_via_item]
                    : [];
                  const hasReservation = itemReservations.length > 0;
                  const currentUser = authStore.user();
                  const myReservation = itemReservations.find(
                    (res) => res.reserved_by === currentUser?.id
                  );
                  const isMyOwnItem = item.parent === currentUser?.id && !item.from_santa;

                  return (
                    <tr key={item.id}>
                      <td>
                        {item.image ? (
                          <img
                            src={getImageUrl(item, item.image, '100x100')}
                            alt={item.title}
                            style={{
                              width: '60px',
                              height: '60px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '32px' }}>🎁</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                          {item.url ? (
                            <a
                              href={item.url}
                              target='_blank'
                              rel='noopener noreferrer'
                              style={{ color: '#1E7B46', textDecoration: 'underline' }}
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                          {item.from_santa && (
                            <span className='santa-badge' style={{ marginLeft: '8px' }}>
                              🎅 From Santa
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '14px', color: 'var(--text-medium)' }}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>{getPersonName(item)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--green-dark)' }}>
                        ${formatCurrency(item.price)}
                      </td>
                      <td>
                        <span className={`badge badge-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className='btn btn-success'
                                style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                                title='Approve'
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 -960 960 960' width='16px' fill='currentColor'>
                                  <path d='M720-120H280v-520l280-280 50 50q7 7 11.5 19t4.5 23v14l-44 174h258q32 0 56 24t24 56v80q0 7-2 15t-4 15L794-168q-9 20-30 34t-44 14Zm-360-80h360l120-280v-80H480l54-220-174 174v406Zm0-406v406-406Zm-80-34v80H160v360h120v80H80v-520h200Z' />
                                </svg>
                              </button>
                              <button
                                onClick={() => openRejectModal(item)}
                                className='btn btn-danger'
                                style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                                title='Reject'
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 -960 960 960' width='16px' fill='currentColor'>
                                  <path d='M240-840h440v520L400-40l-50-50q-7-7-11.5-19t-4.5-23v-14l44-174H120q-32 0-56-24t-24-56v-80q0-7 2-15t4-15l120-282q9-20 30-34t44-14Zm360 80H240L120-480v80h360l-54 220 174-174v-406Zm0 406v-406 406Zm80 34v-80h120v-360H680v-80h200v520H680Z' />
                                </svg>
                              </button>
                            </>
                          )}
                          {item.status === 'approved' && !isMyOwnItem && !hasReservation && (
                            <button
                              onClick={() => handleReserve(item.id)}
                              className='btn btn-primary'
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                              title='Reserve'
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 0 24 24' width='16px' fill='currentColor'>
                                <path d='M0 0h24v24H0z' fill='none'/>
                                <path d='M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'/>
                              </svg>
                            </button>
                          )}
                          {item.status === 'approved' && myReservation && !myReservation.purchased && (
                            <>
                              <button
                                onClick={() => handleMarkPurchased(myReservation.id)}
                                className='btn btn-success'
                                style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                                title='Mark as Purchased'
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 0 24 24' width='16px' fill='currentColor'>
                                  <path d='M0 0h24v24H0z' fill='none'/>
                                  <path d='M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z'/>
                                </svg>
                              </button>
                              <button
                                onClick={() => openUnreserveModal(myReservation.id)}
                                className='btn btn-secondary'
                                style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                                title='Unreserve'
                              >
                                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='16px' height='16px'>
                                  <defs>
                                    <mask id='giftMask'>
                                      <rect width='24' height='24' fill='white'/>
                                      <line x1='4' y1='4' x2='20' y2='20' stroke='black' stroke-width='3.5' stroke-linecap='round'/>
                                    </mask>
                                  </defs>
                                  <path mask='url(#giftMask)' fill='currentColor' d='M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'/>
                                  <line x1='4' y1='4' x2='20' y2='20' stroke='currentColor' stroke-width='2' stroke-linecap='round'/>
                                </svg>
                              </button>
                            </>
                          )}
                          {item.status === 'approved' && myReservation && myReservation.purchased && (
                            <button
                              onClick={() => handleMarkNotPurchased(myReservation.id)}
                              className='btn btn-secondary'
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                              title='Mark Not Purchased'
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 0 24 24' width='16px' fill='currentColor'>
                                <path d='M0 0h24v24H0z' fill='none'/>
                                <path d='M12.5 6.9c1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-.53.12-1.03.3-1.48.54l1.47 1.47c.41-.17.91-.27 1.51-.27zM5.33 4.06L4.06 5.33 7.5 8.77c0 2.08 1.56 3.21 3.91 3.91l3.51 3.51c-.34.48-1.05.91-2.42.91-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c.96-.18 1.82-.55 2.45-1.12l2.22 2.22 1.27-1.27L5.33 4.06z'/>
                              </svg>
                            </button>
                          )}
                          {item.status === 'approved' && item.child && !item.parent && (
                            <button
                              onClick={() => handleUnapprove(item.id)}
                              className='btn btn-secondary'
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                              title='Unapprove'
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 -960 960 960' width='16px' fill='currentColor'>
                                <path d='M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z'/>
                              </svg>
                            </button>
                          )}
                          {item.status === 'rejected' && item.child && !item.parent && (
                            <button
                              onClick={() => handleUnapprove(item.id)}
                              className='btn btn-secondary'
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center' }}
                              title='Unreject'
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 -960 960 960' width='16px' fill='currentColor'>
                                <path d='M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z'/>
                              </svg>
                            </button>
                          )}
                          {((item.from_santa && item.status === 'approved') || (item.child && !item.parent) || (item.parent === currentUser?.id)) && (
                            <button
                              onClick={() => openDeleteModal(item)}
                              className='btn'
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', background: 'transparent', color: '#C41E3A', border: '1px solid #C41E3A' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#C41E3A'; e.currentTarget.style.color = '#ffffff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C41E3A'; }}
                              title='Delete'
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' height='16px' viewBox='0 -960 960 960' width='16px' fill='currentColor'>
                                <path d='M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grid View - Mobile Only */}
          <div className='review-items-grid'>
          {filteredItems.map((item) => {
                const itemReservations = item.expand?.reservations_via_item
              ? Array.isArray(item.expand.reservations_via_item)
                ? item.expand.reservations_via_item
                : [item.expand.reservations_via_item]
              : [];
            const hasReservation = itemReservations.length > 0;
            const isPurchased = itemReservations.some((res) => res.purchased);

            // Check if this item is reserved by the current parent
            const currentUser = authStore.user();
            const myReservation = itemReservations.find(
              (res) => res.reserved_by === currentUser?.id
            );

            // Parents can reserve Santa gifts (even though they created them) to coordinate purchases
            // Parents should not see reservation buttons on non-Santa items they created
            const isMyOwnItem = item.parent === currentUser?.id && !item.from_santa;

            // Only show reservation actions on approved items (not on parent's own non-Santa items)
            const canReserve = item.status === 'approved' && !isMyOwnItem;

            return (
              <div key={item.id} className='review-item-card'>
                <div className='review-item-image'>
                  {item.image ? (
                    <img
                      src={getImageUrl(item, item.image, '200x200')}
                      alt={item.title}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className='review-item-placeholder'>
                      🎁
                    </div>
                  )}
                </div>

                <div className='review-item-content'>
                  <div className='review-item-header'>
                    <div className='review-item-title-row'>
                      {item.url ? (
                        <a
                          href={item.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='review-item-title'
                        >
                          {item.title}
                        </a>
                      ) : (
                        <h3 className='review-item-title'>{item.title}</h3>
                      )}
                      {item.from_santa && (
                        <span className='santa-badge'>
                          🎅 From Santa
                        </span>
                      )}
                    </div>
                    <span className={`badge badge-${item.status}`}>
                      {item.status}
                    </span>
                  </div>

                  {item.description && (
                    <p className='review-item-description'>
                      {item.description}
                    </p>
                  )}

                  <div className='review-item-meta'>
                    <div className='review-item-meta-item'>
                      <strong>Kid:</strong> {getPersonName(item)}
                    </div>
                    <div className='review-item-meta-item'>
                      <strong>Price:</strong> ${formatCurrency(item.price)}
                    </div>
                  </div>

                  {hasReservation && !item.parent && (
                    <div className='review-item-reservation'>
                      <strong>Reserved by:</strong>{' '}
                      {itemReservations[0].expand?.reserved_by?.name ||
                        'Family member'}
                      {isPurchased && ' • ✓ Purchased'}
                    </div>
                  )}

                  <div className='review-item-actions'>
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
                                gap: '6px',
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
                              <span className='btn-text-mobile'>Approve</span>
                            </button>
                            <button
                              onClick={() => openRejectModal(item)}
                              className='btn btn-danger'
                              style={{
                                padding: '6px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
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
                              <span className='btn-text-mobile'>Reject</span>
                            </button>
                          </>
                        )}
                        {/* Reservation action buttons for approved items (including Santa gifts) */}
                        {canReserve && !hasReservation && (
                          <button
                            onClick={() => handleReserve(item.id)}
                            className='btn btn-primary'
                            style={{
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            title='Reserve'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              height='18px'
                              viewBox='0 0 24 24'
                              width='18px'
                              fill='currentColor'
                            >
                              <path d='M0 0h24v24H0z' fill='none'/>
                              <path d='M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'/>
                            </svg>
                            <span className='btn-text-mobile'>Reserve</span>
                          </button>
                        )}

                        {/* Reservation buttons when item is reserved */}
                        {canReserve && myReservation && !myReservation.purchased && (
                          <>
                            <button
                              onClick={() => handleMarkPurchased(myReservation.id)}
                              className='btn btn-success'
                              style={{
                                padding: '6px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                              }}
                              title='Mark as Purchased'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                height='18px'
                                viewBox='0 0 24 24'
                                width='18px'
                                fill='currentColor'
                              >
                                <path d='M0 0h24v24H0z' fill='none'/>
                                <path d='M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z'/>
                              </svg>
                              <span className='btn-text-mobile'>Purchased</span>
                            </button>
                            <button
                              onClick={() => openUnreserveModal(myReservation.id)}
                              className='btn btn-secondary'
                              style={{
                                padding: '6px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                              }}
                              title='Unreserve'
                            >
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                width='18px'
                                height='18px'
                              >
                                <defs>
                                  <mask id='giftMask'>
                                    <rect width='24' height='24' fill='white'/>
                                    <line x1='4' y1='4' x2='20' y2='20' stroke='black' stroke-width='3.5' stroke-linecap='round'/>
                                  </mask>
                                </defs>
                                <path mask='url(#giftMask)' fill='currentColor' d='M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'/>
                                <line x1='4' y1='4' x2='20' y2='20' stroke='currentColor' stroke-width='2' stroke-linecap='round'/>
                              </svg>
                              <span className='btn-text-mobile'>Unreserve</span>
                            </button>
                          </>
                        )}

                        {canReserve && myReservation && myReservation.purchased && (
                          <button
                            onClick={() => handleMarkNotPurchased(myReservation.id)}
                            className='btn btn-secondary'
                            style={{
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            title='Mark Not Purchased'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              height='18px'
                              viewBox='0 0 24 24'
                              width='18px'
                              fill='currentColor'
                            >
                              <path d='M0 0h24v24H0z' fill='none'/>
                              <path d='M12.5 6.9c1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-.53.12-1.03.3-1.48.54l1.47 1.47c.41-.17.91-.27 1.51-.27zM5.33 4.06L4.06 5.33 7.5 8.77c0 2.08 1.56 3.21 3.91 3.91l3.51 3.51c-.34.48-1.05.91-2.42.91-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c.96-.18 1.82-.55 2.45-1.12l2.22 2.22 1.27-1.27L5.33 4.06z'/>
                            </svg>
                            <span className='btn-text-mobile'>Not Purchased</span>
                          </button>
                        )}

                        {/* Unapprove button - only for child items that are approved */}
                        {item.status === 'approved' && item.child && !item.parent && (
                          <button
                            onClick={() => handleUnapprove(item.id)}
                            className='btn btn-secondary'
                            style={{
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            title='Unapprove'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              height='18px'
                              viewBox='0 -960 960 960'
                              width='18px'
                              fill='currentColor'
                            >
                              <path d='M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z'/>
                            </svg>
                            <span className='btn-text-mobile'>Unapprove</span>
                          </button>
                        )}

                        {/* Unreject button - only for child items that are rejected */}
                        {item.status === 'rejected' && item.child && !item.parent && (
                          <button
                            onClick={() => handleUnapprove(item.id)}
                            className='btn btn-secondary'
                            style={{
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            title='Unreject'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              height='18px'
                              viewBox='0 -960 960 960'
                              width='18px'
                              fill='currentColor'
                            >
                              <path d='M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z'/>
                            </svg>
                            <span className='btn-text-mobile'>Unreject</span>
                          </button>
                        )}

                        {/* Delete button - for child items, Santa gifts, and parent's own wishlist items */}
                        {((item.from_santa && item.status === 'approved') ||
                          (item.child && !item.parent) ||
                          (item.parent === currentUser?.id)) && (
                          <button
                            onClick={() => openDeleteModal(item)}
                            className='btn'
                            style={{
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
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
                            <span className='btn-text-mobile'>Delete</span>
                          </button>
                        )}

                        {/* Info message when reservation not available */}
                        {item.status === 'approved' && isMyOwnItem && (
                          <div className='action-info-message'>
                            This is your own item
                          </div>
                        )}

                        {/* Info message when item is reserved by someone else */}
                        {item.status === 'approved' && hasReservation && !myReservation && !isMyOwnItem && (
                          <div className='action-info-message'>
                            Reserved by {itemReservations[0].expand?.reserved_by?.name || 'another family member'}
                          </div>
                        )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
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
        <div className='modal-overlay'>
          <div className='modal' onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button
              type='button'
              onClick={() => setShowSantaModal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: '1',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#1f2937';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              title="Close"
            >
              ×
            </button>
            <h2>🎅 Add Secret Santa Gift</h2>
            <p style={{ marginBottom: '20px', color: '#718096' }}>
              This gift will be approved and visible to you, but hidden from the
              kid and other family members.
            </p>

            <form onSubmit={handleSantaSubmit}>
              <div className='input-group'>
                <label>Kid *</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={santaFormData.child}
                    onChange={(e) =>
                      setSantaFormData({
                        ...santaFormData,
                        child: e.target.value,
                      })
                    }
                    required
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
                    <option value=''>Select a kid</option>
                    {[...childrenList]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((kid) => (
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
                  type='text'
                  inputMode='decimal'
                  value={santaFormData.price ? `$${santaFormData.price}` : ''}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^0-9.]/g, '');
                    // Limit to 2 decimal places
                    const parts = value.split('.');
                    if (parts.length > 2) {
                      value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (parts[1] && parts[1].length > 2) {
                      value = parts[0] + '.' + parts[1].substring(0, 2);
                    }
                    setSantaFormData({
                      ...santaFormData,
                      price: value,
                    });
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
                  value={santaFormData.url}
                  onChange={(e) => {
                    let value = e.target.value;
                    // Auto-prepend https:// if user starts with www.
                    if (value.startsWith('www.') && !value.includes('://')) {
                      value = 'https://' + value;
                    }
                    setSantaFormData({ ...santaFormData, url: value });
                  }}
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

      {showUnreserveModal && (
        <div
          className='modal-overlay'
          onClick={() => setShowUnreserveModal(false)}
        >
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>Unreserve Item</h2>
            <p style={{ marginBottom: '20px' }}>
              Are you sure you want to unreserve this item?
            </p>

            <div className='modal-actions'>
              <button
                onClick={() => setShowUnreserveModal(false)}
                className='btn btn-secondary'
              >
                Cancel
              </button>
              <button onClick={handleUnreserve} className='btn btn-danger'>
                Unreserve
              </button>
            </div>
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
