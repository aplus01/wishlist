import { useState, useEffect } from 'react';
import {
  auth,
  authStore,
  items as itemsAPI,
  reservations as reservationsAPI,
  formatCurrency,
  getImageUrl,
} from '../lib/pocketbase';

export default function FamilyView() {
  const [approvedItems, setApprovedItems] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, available, reserved
  const [kidFilter, setKidFilter] = useState('all'); // all or specific kid name
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showUnreserveModal, setShowUnreserveModal] = useState(false);
  const [unreservingId, setUnreservingId] = useState(null);

  // Get current family user from either PocketBase auth or sessionStorage
  const getCurrentUser = () => {
    // First check PocketBase auth (for existing family members who logged in before the change)
    const pbUser = authStore.user();
    if (pbUser?.role === 'family_member') {
      return pbUser;
    }

    // Then check sessionStorage (for route-based auth)
    const familyData = sessionStorage.getItem('familyData');
    if (familyData) {
      try {
        return JSON.parse(familyData);
      } catch (err) {
        console.error('Error parsing family data:', err);
      }
    }

    return null;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load approved items
      let visibleItems = [];
      try {
        const pb = (await import('../lib/pocketbase.js')).default;
        // Fetch with proper expansion for both child and parent items
        const allApprovedItems = await pb.collection('items').getFullList({
          filter: 'status = "approved"',
          expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by',
          sort: 'priority,-approved_at',
        });

        // Fetch all parent users separately (in case expand didn't work due to viewRule)
        const parentIds = [...new Set(allApprovedItems.filter(item => item.parent).map(item => item.parent))];
        let parentsMap = {};

        if (parentIds.length > 0) {
          try {
            const parents = await pb.collection('users').getFullList({
              filter: parentIds.map(id => `id = "${id}"`).join(' || ')
            });
            parentsMap = parents.reduce((acc, parent) => {
              acc[parent.id] = parent;
              return acc;
            }, {});
          } catch (err) {
            console.warn('Could not fetch parent users:', err);
          }
        }

        // Manually attach parent data if expand didn't work
        allApprovedItems.forEach(item => {
          if (item.parent && !item.expand?.parent && parentsMap[item.parent]) {
            if (!item.expand) item.expand = {};
            item.expand.parent = parentsMap[item.parent];
          }
        });

        // Filter out "from Santa" items - family shouldn't see these
        visibleItems = allApprovedItems.filter((item) => !item.from_santa);
      } catch (err) {
        console.warn('Error loading items:', err);
      }

      // Load ALL reservations to manually attach to items
      let allReservations = [];
      try {
        const pb = (await import('../lib/pocketbase.js')).default;
        allReservations = await pb.collection('reservations').getFullList({
          expand: 'item,reserved_by',
        });
      } catch (err) {
        console.warn('Error loading all reservations:', err);
      }

      // Manually attach reservations to items
      visibleItems = visibleItems.map((item) => {
        const itemReservations = allReservations.filter(
          (res) => res.item === item.id
        );
        return {
          ...item,
          expand: {
            ...item.expand,
            reservations_via_item: itemReservations,
          },
        };
      });

      setApprovedItems(visibleItems);

      // Load user's reservations
      const currentUser = getCurrentUser();
      const userId = currentUser?.id;
      if (userId) {
        const myRes = allReservations.filter(
          (res) => res.reserved_by === userId
        );
        setMyReservations(myRes);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (itemId) => {
    try {
      const currentUser = getCurrentUser();
      await reservationsAPI.create(itemId, currentUser?.id);
      // Force reload to get updated expand data
      setLoading(true);
      await loadData();
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
      await reservationsAPI.delete(unreservingId);
      setShowUnreserveModal(false);
      setUnreservingId(null);
      setLoading(true);
      await loadData();
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
      await reservationsAPI.markPurchased(reservationId);
      loadData();
    } catch (err) {
      console.error('Error marking as purchased:', err);
      setErrorMessage('Failed to mark as purchased.');
      setShowErrorModal(true);
    }
  };

  const handleMarkNotPurchased = async (reservationId) => {
    try {
      await reservationsAPI.update(reservationId, { purchased: false });
      loadData();
    } catch (err) {
      console.error('Error marking as not purchased:', err);
      setErrorMessage('Failed to mark as not purchased.');
      setShowErrorModal(true);
    }
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  if (loading) {
    return <div className='container'>Loading...</div>;
  }

  const isItemReserved = (item) => {
    return item.expand?.reservations_via_item?.length > 0;
  };

  const getMyReservation = (item) => {
    const currentUser = getCurrentUser();
    const userId = currentUser?.id;
    return item.expand?.reservations_via_item?.find(
      (res) => res.reserved_by === userId
    );
  };

  // Filter by kid first
  const itemsFilteredByKid = approvedItems.filter((item) => {
    const personName = item.expand?.child?.name || item.expand?.parent?.name || 'Unknown';
    return kidFilter === 'all' || personName === kidFilter;
  });

  // Calculate counts based on kid filter
  const allCount = itemsFilteredByKid.length;
  const availableCount = itemsFilteredByKid.filter(
    (item) => !isItemReserved(item)
  ).length;
  const myReservationsCount = itemsFilteredByKid.filter(
    (item) => !!getMyReservation(item)
  ).length;

  const filteredItems = itemsFilteredByKid.filter((item) => {
    // Filter by reservation status
    let statusMatch = true;
    if (filter === 'available') statusMatch = !isItemReserved(item);
    if (filter === 'reserved') statusMatch = !!getMyReservation(item);

    return statusMatch;
  });

  // Group items by person (kid or parent), maintaining priority order
  const itemsByKid = filteredItems.reduce((acc, item) => {
    const personName = item.expand?.child?.name || item.expand?.parent?.name || 'Unknown';
    if (!acc[personName]) acc[personName] = [];
    acc[personName].push(item);
    return acc;
  }, {});

  // Sort items within each person's list by priority (1 = highest priority, null = lowest)
  Object.values(itemsByKid).forEach(items => {
    items.sort((a, b) => {
      const aPriority = a.priority || 999;
      const bPriority = b.priority || 999;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // Secondary sort: most recently approved first
      return new Date(b.approved_at || 0) - new Date(a.approved_at || 0);
    });
  });

  // Get unique person names (kids and parents) for filter dropdown
  const allKidNames = [
    ...new Set(
      approvedItems.map((item) => item.expand?.child?.name || item.expand?.parent?.name || 'Unknown')
    ),
  ].sort();

  return (
    <>
      <div className='header'>
        <div className='header-content'>
          <h1>🎄 Family Gift List</h1>
          <button onClick={handleLogout} className='btn btn-secondary' style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/>
            </svg>
            Logout
          </button>
        </div>
      </div>

      <div className='container'>
        <div className='card' style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '16px', color: 'var(--green-dark)' }}>
            Welcome, {getCurrentUser()?.name}!
          </h2>
          <p style={{ marginBottom: '20px' }}>
            Browse the approved wishlist items and reserve gifts you'd like to
            purchase. Once reserved, no one else can claim that item!
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                color: 'var(--green-dark)',
              }}
            >
              Filter by Person:
            </label>
            <div style={{ position: 'relative', minWidth: '200px' }}>
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
                <option value='all'>Everyone</option>
                {allKidNames.map((kidName) => (
                  <option key={kidName} value={kidName}>
                    {kidName}
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilter('all')}
              className={`btn ${
                filter === 'all' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              All Items ({allCount})
            </button>
            <button
              onClick={() => setFilter('available')}
              className={`btn ${
                filter === 'available' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              onClick={() => setFilter('reserved')}
              className={`btn ${
                filter === 'reserved' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              My Reservations ({myReservationsCount})
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className='empty-state'>
            <h2>No items found</h2>
            <p>
              {filter === 'available' && 'All items have been reserved!'}
              {filter === 'reserved' && "You haven't reserved any items yet."}
              {filter === 'all' && 'No approved items available yet.'}
            </p>
          </div>
        ) : (
          Object.entries(itemsByKid)
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .map(([kidName, kidItems]) => (
            <div
              key={kidName}
              style={{
                marginBottom: '40px',
                background: '#FFFFFF',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: 'var(--container-header-bg-color)',
                  padding: '16px 24px',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: '#FFFFFF',
                    fontSize: '24px',
                    fontWeight: 700,
                  }}
                >
                  {kidName}'s Wishlist
                </h2>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '14px',
                  }}
                >
                  ★ Listed in order of priority
                </p>
              </div>

              <div className='grid grid-2' style={{ padding: '24px' }}>
                {kidItems.map((item, index) => {
                  const reserved = isItemReserved(item);
                  const myReservation = getMyReservation(item);

                  return (
                    <div key={item.id} className='item-card' style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          left: '-8px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: index === 0 ? 'var(--gold)' : index === 1 ? '#a0aec0' : index === 2 ? '#cd7f32' : 'var(--green-dark)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          zIndex: 1,
                        }}
                        title={`Priority #${index + 1}`}
                      >
                        {index + 1}
                      </div>
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
                      <h3 style={{ marginBottom: '8px' }}>
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
                      {reserved && (
                        <div style={{ marginBottom: '8px' }}>
                          <span className='badge badge-reserved'>
                            {myReservation ? 'Reserved by You' : 'Reserved'}
                          </span>
                        </div>
                      )}

                      {item.description && <p>{item.description}</p>}

                      <div className='price'>${formatCurrency(item.price)}</div>

                      <div className='item-actions'>
                        {!reserved && (
                          <button
                            onClick={() => handleReserve(item.id)}
                            className='btn btn-success'
                            style={{ width: '100%' }}
                          >
                            Reserve This Gift
                          </button>
                        )}

                        {myReservation && (
                          <>
                            {!myReservation.purchased && (
                              <>
                                <button
                                  onClick={() =>
                                    handleMarkPurchased(myReservation.id)
                                  }
                                  className='btn btn-primary'
                                >
                                  Mark Purchased
                                </button>
                                <button
                                  onClick={() =>
                                    openUnreserveModal(myReservation.id)
                                  }
                                  className='btn btn-secondary'
                                >
                                  Unreserve
                                </button>
                              </>
                            )}
                            {myReservation.purchased && (
                              <>
                                <div
                                  style={{
                                    background: '#d1fae5',
                                    padding: '10px 20px',
                                    textAlign: 'center',
                                    color: '#065f46',
                                    fontWeight: 600,
                                    fontSize: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  ✓ Purchased
                                </div>
                                <button
                                  onClick={() =>
                                    handleMarkNotPurchased(myReservation.id)
                                  }
                                  className='btn btn-secondary'
                                  style={{ width: '100%' }}
                                >
                                  Mark as Not Purchased
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {reserved && !myReservation && (
                          <div
                            style={{
                              background: '#e2e8f0',
                              padding: '8px',
                              textAlign: 'center',
                              color: '#4a5568',
                              fontWeight: 600,
                            }}
                          >
                            Reserved by Another Family Member
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

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
    </>
  );
}
