import { useState, useEffect } from 'react';
import { items, children, reservations, authStore, formatCurrency } from '../lib/pocketbase';

export default function EquityDashboard() {
  const [childrenList, setChildrenList] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = authStore.user()?.id;
      const childrenData = await children.list(userId);
      setChildrenList(childrenData);

      const itemsList = await items.list();
      setAllItems(itemsList);

      const reservationsList = await reservations.list();
      setAllReservations(reservationsList);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Calculate stats for each child
  const childStats = childrenList.map(child => {
    const childItems = allItems.filter(item => item.child === child.id);
    const approvedItems = childItems.filter(item => item.status === 'approved');
    const reservedItems = approvedItems.filter(item => 
      allReservations.some(res => res.item === item.id)
    );
    
    const totalReservedValue = reservedItems.reduce((sum, item) => sum + item.price, 0);
    const totalReservedCount = reservedItems.length;
    
    const purchasedItems = reservedItems.filter(item =>
      allReservations.find(res => res.item === item.id)?.purchased
    );
    const totalPurchasedValue = purchasedItems.reduce((sum, item) => sum + item.price, 0);
    const totalPurchasedCount = purchasedItems.length;

    // Get list of family members who reserved for this child
    const reservers = new Set();
    reservedItems.forEach(item => {
      const reservation = allReservations.find(res => res.item === item.id);
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
  const totalReservedValue = childStats.reduce((sum, stat) => sum + stat.totalReservedValue, 0);
  const avgReservedValue = childStats.length > 0 ? totalReservedValue / childStats.length : 0;
  const maxReservedValue = Math.max(...childStats.map(s => s.totalReservedValue), 0);
  const minReservedValue = Math.min(...childStats.map(s => s.totalReservedValue), Infinity);

  const isBalanced = childStats.length > 1 ? 
    (maxReservedValue - minReservedValue) < (avgReservedValue * 0.3) : true;

  return (
    <div className="page-content">
      <div style={{ marginBottom: '30px' }}>
        <h2>Equity Dashboard</h2>
        <p>
          Monitor the distribution of reserved gifts across your kids to ensure fairness.
        </p>

        {childStats.length > 1 && (
          <div className="card" style={{ 
            background: isBalanced ? '#d1fae5' : '#fef3c7',
            borderLeft: `4px solid ${isBalanced ? '#48bb78' : '#f59e0b'}`
          }}>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 600,
              color: isBalanced ? '#065f46' : '#92400e',
              marginBottom: '8px'
            }}>
              {isBalanced ? '✓ Gifts are well balanced' : '⚠️ Gift imbalance detected'}
            </div>
            <div style={{ color: isBalanced ? '#047857' : '#78350f' }}>
              Difference between highest and lowest: ${formatCurrency(maxReservedValue - minReservedValue)}
            </div>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Reserved Value</h3>
          <div className="value">${formatCurrency(totalReservedValue)}</div>
        </div>
        <div className="stat-card">
          <h3>Average per Kid</h3>
          <div className="value">${formatCurrency(avgReservedValue)}</div>
        </div>
        <div className="stat-card">
          <h3>Total Purchased</h3>
          <div className="value">
            {childStats.reduce((sum, s) => sum + s.purchasedItems, 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {childStats.map(stat => {
          const { child } = stat;
          const targetBudget = child.target_budget || 0;
          const percentOfTarget = targetBudget > 0 
            ? (stat.totalReservedValue / targetBudget) * 100 
            : 0;

          return (
            <div key={child.id} className="card">
              <h3 style={{ fontSize: '24px', marginBottom: '16px', color: '#165B33' }}>
                {child.name}
              </h3>

              {targetBudget > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '14px',
                    color: '#718096'
                  }}>
                    <span>Target Budget: ${formatCurrency(targetBudget)}</span>
                    <span>{percentOfTarget.toFixed(0)}% reached</span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: '#e2e8f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(percentOfTarget, 100)}%`,
                      background: percentOfTarget >= 100 ? '#48bb78' : '#667eea',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#718096', marginBottom: '4px' }}>
                    Total Items
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#2d3748' }}>
                    {stat.totalItems}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#718096', marginBottom: '4px' }}>
                    Approved
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#2d3748' }}>
                    {stat.approvedItems}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#718096', marginBottom: '4px' }}>
                    Reserved
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#165B33' }}>
                    {stat.reservedItems}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#718096', marginBottom: '4px' }}>
                    Purchased
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#48bb78' }}>
                    {stat.purchasedItems}
                  </div>
                </div>
              </div>

              <div style={{
                background: '#f7fafc',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '8px' }}>
                  <strong>Reserved Value:</strong>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#165B33' }}>
                  ${formatCurrency(stat.totalReservedValue)}
                </div>
                {stat.purchasedItems > 0 && (
                  <div style={{ fontSize: '14px', color: '#48bb78', marginTop: '4px' }}>
                    ${formatCurrency(stat.totalPurchasedValue)} purchased
                  </div>
                )}
              </div>

              {stat.reservers.length > 0 && (
                <div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#718096', 
                    marginBottom: '8px',
                    fontWeight: 600
                  }}>
                    Family Members Contributing:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {stat.reservers.map(name => (
                      <span 
                        key={name}
                        style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: 600
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {stat.reservers.length === 0 && stat.approvedItems > 0 && (
                <div style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  No reservations yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      {childStats.length === 0 && (
        <div className="empty-state">
          <h2>No kids added yet</h2>
          <p>Add kids to track gift equity.</p>
        </div>
      )}
    </div>
  );
}
