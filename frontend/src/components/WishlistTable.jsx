import { useState } from 'react';
import { formatCurrency } from '../lib/pocketbase';

export default function WishlistTable({ items, onReorder, onEdit, onDelete }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Create new array with reordered items
    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    // Update priorities based on new positions
    const updates = newItems.map((item, index) => ({
      id: item.id,
      priority: index,
    }));

    onReorder(updates);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <thead>
          <tr
            style={{
              background: '#165B33',
              color: 'white',
            }}
          >
            <th
              style={{
                padding: '12px 16px',
                textAlign: 'left',
                fontWeight: 600,
                width: '40px',
              }}
            >
              #
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
              Price
            </th>
            <th
              style={{
                padding: '12px 16px',
                textAlign: 'center',
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
                width: '150px',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                borderBottom: '1px solid #e5e7eb',
                cursor: 'grab',
                background:
                  dragOverIndex === index
                    ? '#f0fdf4'
                    : draggedIndex === index
                    ? '#f3f4f6'
                    : 'white',
                opacity: draggedIndex === index ? 0.5 : 1,
                transition: 'background 0.2s',
              }}
            >
              <td
                style={{
                  padding: '12px 16px',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {item.title}
                </div>
                {item.description && (
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      maxWidth: '400px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.description}
                  </div>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    style={{
                      color: '#1E7B46',
                      textDecoration: 'none',
                      fontSize: '14px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Product →
                  </a>
                )}
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
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <span className={`badge badge-${item.status}`}>
                  {item.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                {item.status === 'pending' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item);
                      }}
                      className='btn btn-secondary'
                      style={{
                        padding: '6px 12px',
                        fontSize: '14px',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className='btn btn-danger'
                      style={{
                        padding: '6px 12px',
                        fontSize: '14px',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          No items in your wishlist
        </div>
      )}
    </div>
  );
}
