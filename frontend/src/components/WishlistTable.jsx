import { useState } from 'react';
import { formatCurrency, getImageUrl } from '../lib/pocketbase';

export default function WishlistTable({
  items,
  onReorder,
  onEdit,
  onDelete,
  onSendToTop,
  onEditImage,
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

    // Update priorities based on new positions (1-based)
    const updates = newItems.map((item, index) => ({
      id: item.id,
      priority: index + 1,
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditImage(item);
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      background: 'var(--green-dark)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                    title="Edit image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                  </button>
                </div>
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
                    className='btn'
                    style={{
                      padding: '8px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: item.status === 'approved' ? 0.5 : 1,
                      cursor:
                        item.status === 'approved' ? 'not-allowed' : 'pointer',
                      background: 'transparent',
                      color: 'var(--edit-btn)',
                      border: '1px solid var(--edit-btn)',
                    }}
                    onMouseEnter={(e) => {
                      if (item.status !== 'approved') {
                        e.currentTarget.style.background = 'var(--edit-btn)';
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
                      height='18'
                      viewBox='0 -960 960 960'
                      width='18'
                      fill='currentColor'
                    >
                      <path d='M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z' />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    disabled={item.status === 'approved'}
                    className='btn'
                    style={{
                      padding: '8px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: item.status === 'approved' ? 0.5 : 1,
                      cursor:
                        item.status === 'approved' ? 'not-allowed' : 'pointer',
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
                      height='18'
                      viewBox='0 -960 960 960'
                      width='18'
                      fill='currentColor'
                    >
                      <path d='M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' />
                    </svg>
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
