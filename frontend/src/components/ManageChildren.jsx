import { useState, useEffect } from 'react';
import { children, authStore, formatCurrency, items, reservations } from '../lib/pocketbase';

export default function ManageChildren() {
  const [childrenList, setChildrenList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [allReservations, setAllReservations] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    route: '',
    target_budget: '',
  });
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingChild, setDeletingChild] = useState(null);

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

      // Load items and reservations for equity tracking
      const itemsList = await items.list();
      setAllItems(itemsList);

      const reservationsList = await reservations.list();
      setAllReservations(reservationsList);
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
      setErrorMessage(
        'Route must contain only lowercase letters, numbers, and hyphens'
      );
      setShowErrorModal(true);
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
      setErrorMessage('Failed to save child. Please try again.');
      setShowErrorModal(true);
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

  const openDeleteModal = (child) => {
    setDeletingChild(child);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingChild) return;

    try {
      await children.delete(deletingChild.id);
      setShowDeleteModal(false);
      setDeletingChild(null);
      loadChildren();
    } catch (err) {
      console.error('Error deleting child:', err);
      setErrorMessage('Failed to delete kid.');
      setShowErrorModal(true);
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

  // Filter out parent items - only include items that belong to children for equity calculations
  const childItemsOnly = allItems.filter(item => item.child && !item.parent);

  // Calculate stats for each child
  const childStats = childrenList.map((child) => {
    const childItems = childItemsOnly.filter((item) => item.child === child.id);
    const approvedItems = childItems.filter(
      (item) => item.status === 'approved'
    );
    const reservedItems = approvedItems.filter((item) =>
      allReservations.some((res) => res.item === item.id)
    );

    const totalReservedValue = reservedItems.reduce(
      (sum, item) => sum + item.price,
      0
    );
    const totalReservedCount = reservedItems.length;

    const purchasedItems = reservedItems.filter(
      (item) => allReservations.find((res) => res.item === item.id)?.purchased
    );
    const totalPurchasedValue = purchasedItems.reduce(
      (sum, item) => sum + item.price,
      0
    );
    const totalPurchasedCount = purchasedItems.length;

    // Get list of family members who reserved for this child
    const reservers = new Set();
    reservedItems.forEach((item) => {
      const reservation = allReservations.find((res) => res.item === item.id);
      if (reservation?.expand?.reserved_by?.name) {
        reservers.add(reservation.expand.reserved_by.name);
      }
    });

    return {
      child,
      totalItems: childItems.length,
      approvedItems: approvedItems.length,
      reservedItems: totalReservedCount,
      totalReservedValue,
      purchasedItems: totalPurchasedCount,
      totalPurchasedValue,
      reservers: Array.from(reservers),
    };
  });

  // Calculate overall stats
  const totalReservedValue = childStats.reduce(
    (sum, stat) => sum + stat.totalReservedValue,
    0
  );
  const avgReservedValue =
    childStats.length > 0 ? totalReservedValue / childStats.length : 0;
  const maxReservedValue = Math.max(
    ...childStats.map((s) => s.totalReservedValue),
    0
  );
  const minReservedValue = Math.min(
    ...childStats.map((s) => s.totalReservedValue),
    Infinity
  );

  const isBalanced =
    childStats.length > 1
      ? maxReservedValue - minReservedValue < avgReservedValue * 0.3
      : true;

  return (
    <div className='page-content'>
      <div style={{ marginBottom: '30px' }}>
        <h2>Manage Kids</h2>
        <p style={{ marginBottom: '20px' }}>
          Add your kids, set up their custom login URL, and monitor gift equity.
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

      {childStats.length > 1 && (
        <div
          className='card'
          style={{
            background: isBalanced ? '#d1fae5' : '#fef3c7',
            borderLeft: `4px solid ${isBalanced ? '#48bb78' : '#f59e0b'}`,
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: isBalanced ? '#065f46' : '#92400e',
              marginBottom: '8px',
            }}
          >
            {isBalanced
              ? '✓ Gifts are well balanced'
              : '⚠️ Gift imbalance detected'}
          </div>
          <div style={{ color: isBalanced ? '#047857' : '#78350f' }}>
            Difference between highest and lowest: $
            {formatCurrency(maxReservedValue - minReservedValue)}
          </div>
        </div>
      )}

      {childStats.length > 0 && (
        <div className='stats-grid' style={{ marginBottom: '30px' }}>
          <div className='stat-card'>
            <h3>Total Reserved Value</h3>
            <div className='value'>${formatCurrency(totalReservedValue)}</div>
          </div>
          <div className='stat-card'>
            <h3>Average per Kid</h3>
            <div className='value'>${formatCurrency(avgReservedValue)}</div>
          </div>
          <div className='stat-card'>
            <h3>Total Purchased</h3>
            <div className='value'>
              {childStats.reduce((sum, s) => sum + s.purchasedItems, 0)}
            </div>
          </div>
        </div>
      )}

      {childrenList.length === 0 ? (
        <div className='empty-state'>
          <h2>No kids added yet</h2>
          <p>Add your kids to get started with their wishlists.</p>
        </div>
      ) : (
        <div className='grid grid-2'>
          {childStats.map((stat) => {
            const { child } = stat;
            const targetBudget = child.target_budget || 0;
            const percentOfTarget =
              targetBudget > 0
                ? (stat.totalReservedValue / targetBudget) * 100
                : 0;

            return (
              <div key={child.id} className='card card-bordered'>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '24px', marginBottom: '8px', color: '#165B33' }}>
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

                {targetBudget > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontSize: '14px',
                        color: '#718096',
                      }}
                    >
                      <span>Target Budget: ${formatCurrency(targetBudget)}</span>
                      <span>{percentOfTarget.toFixed(0)}% reached</span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(percentOfTarget, 100)}%`,
                          background:
                            percentOfTarget >= 100 ? '#48bb78' : '#667eea',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#718096',
                        marginBottom: '4px',
                      }}
                    >
                      Total Items
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#2d3748',
                      }}
                    >
                      {stat.totalItems}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#718096',
                        marginBottom: '4px',
                      }}
                    >
                      Approved
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#2d3748',
                      }}
                    >
                      {stat.approvedItems}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#718096',
                        marginBottom: '4px',
                      }}
                    >
                      Reserved
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#165B33',
                      }}
                    >
                      {stat.reservedItems}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#718096',
                        marginBottom: '4px',
                      }}
                    >
                      Purchased
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#48bb78',
                      }}
                    >
                      {stat.purchasedItems}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f7fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#4a5568',
                      marginBottom: '8px',
                    }}
                  >
                    <strong>Reserved Value:</strong>
                  </div>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#165B33',
                    }}
                  >
                    ${formatCurrency(stat.totalReservedValue)}
                  </div>
                  {stat.purchasedItems > 0 && (
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#48bb78',
                        marginTop: '4px',
                      }}
                    >
                      ${formatCurrency(stat.totalPurchasedValue)} purchased
                    </div>
                  )}
                </div>

                {stat.reservers.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#718096',
                        marginBottom: '8px',
                        fontWeight: 600,
                      }}
                    >
                      Family Members Contributing:
                    </div>
                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                    >
                      {stat.reservers.map((name) => (
                        <span
                          key={name}
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {stat.reservers.length === 0 && stat.approvedItems > 0 && (
                  <div
                    style={{
                      background: '#fef3c7',
                      color: '#92400e',
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      textAlign: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    No reservations yet
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
                    onClick={() => openDeleteModal(child)}
                    className='btn btn-danger'
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
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

      {showDeleteModal && (
        <div
          className='modal-overlay'
          onClick={() => setShowDeleteModal(false)}
        >
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h2>Delete Kid</h2>
            <p style={{ marginBottom: '20px' }}>
              Are you sure you want to delete {deletingChild?.name}? This will
              also delete all their wishlist items!
            </p>

            <div className='modal-actions'>
              <button
                onClick={() => setShowDeleteModal(false)}
                className='btn btn-secondary'
              >
                Cancel
              </button>
              <button onClick={handleDelete} className='btn btn-danger'>
                Delete Kid
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
