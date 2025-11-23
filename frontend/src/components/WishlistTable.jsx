import { useState } from 'react';
import { formatCurrency, getImageUrl } from '../lib/pocketbase';

export default function WishlistTable({
  items,
  onReorder,
  onEdit,
  onDelete,
  onSendToTop,
}) {
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
          {items.map((item, itemIndex) => (
            <tr
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, itemIndex)}
              onDragOver={(e) => handleDragOver(e, itemIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, itemIndex)}
              onDragEnd={handleDragEnd}
              style={{
                borderBottom: '1px solid #e5e7eb',
                cursor: 'grab',
                background:
                  dragOverIndex === itemIndex
                    ? '#f0fdf4'
                    : draggedIndex === itemIndex
                    ? '#f3f4f6'
                    : 'white',
                opacity: draggedIndex === itemIndex ? 0.5 : 1,
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
                {itemIndex + 1}
              </td>
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
                      background: '#f3f4f6',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      fontSize: '24px',
                    }}
                  >
                    🎁
                  </div>
                )}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      style={{
                        color: '#1E7B46',
                        textDecoration: 'underline',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
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
                      onSendToTop(item.id);
                    }}
                    disabled={itemIndex === 0}
                    className='btn btn-primary'
                    style={{
                      padding: '8px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: itemIndex === 0 ? 0.5 : 1,
                      cursor: itemIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title={itemIndex === 0 ? 'Already at top' : 'Send to Top'}
                  >
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      height='18'
                      viewBox='0 -960 960 960'
                      width='18'
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item);
                    }}
                    disabled={item.status === 'approved'}
                    className='btn btn-secondary'
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    disabled={item.status === 'approved'}
                    className='btn btn-danger'
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
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
