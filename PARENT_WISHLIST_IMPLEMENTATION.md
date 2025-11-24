# Parent Wishlist Implementation Guide

## Overview
This document outlines the implementation plan for adding parent wishlist support to the Christmas Wishlist App. Parents will be able to create their own wishlists that family members can view and reserve items from, while keeping these items hidden from children.

## Requirements Summary

### Functional Requirements
- Each parent can maintain their own separate wishlist
- Parent wishlist items are automatically approved (no approval workflow)
- Parent items are visible to family members for reservations
- Parent items are hidden from children's views
- Parent items are excluded from equity tracking calculations
- Multiple parents can each have independent wishlists

### Technical Approach
- **Schema**: Add optional `parent` relation field to `items` collection, make `child` field optional
- **Validation**: Items must have exactly one of `child` OR `parent` (not both, not neither)
- **Auto-approval**: Parent items created with `status='approved'`

---

## Phase 1: Schema Changes

### File: `backend/pb_schema.json`

#### Modifications to `items` Collection

**Current State** (lines 173-322):
```json
{
  "name": "child",
  "type": "relation",
  "required": true,
  "options": {
    "collectionId": "children",
    "cascadeDelete": false,
    "minSelect": null,
    "maxSelect": 1,
    "displayFields": ["name"]
  }
}
```

**Changes Needed**:

1. **Make `child` field optional**:
   - Change `required: true` → `required: false`
   - Location: items collection, child field definition

2. **Add new `parent` field**:
   - Add after the `child` field definition
   - Schema structure:
   ```json
   {
     "name": "parent",
     "type": "relation",
     "required": false,
     "options": {
       "collectionId": "<users_collection_id>",
       "cascadeDelete": false,
       "minSelect": null,
       "maxSelect": 1,
       "displayFields": ["name"]
     }
   }
   ```

**Note**: After schema changes, restart PocketBase to apply migrations.

---

## Phase 2: API Layer Updates

### File: `frontend/src/lib/pocketbase.js`

#### 2.1 Update `items.list()` (lines 124-151)

**Current Issue**:
- Always expands `'child,reservations_via_item,reservations_via_item.reserved_by'`
- Assumes child relation always exists

**Solution**:
- Expand both `child` AND `parent` relations
- Use optional chaining in components when accessing expanded data

**Updated expand string**:
```javascript
expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by'
```

**Code Changes**:
```javascript
// Line 124-151
list: async (filters = {}) => {
  try {
    const records = await pb.collection('items').getFullList({
      filter: buildFilter(filters),
      expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by', // UPDATED
      sort: '-created',
    });
    return records;
  } catch (error) {
    console.error('Error listing items:', error);
    throw error;
  }
},
```

#### 2.2 Update `items.listApproved()` (lines 153-159)

**Same changes as above** - add `parent` to expand string:

```javascript
// Line 153-159
listApproved: async () => {
  try {
    const records = await pb.collection('items').getFullList({
      filter: 'status = "approved"',
      expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by', // UPDATED
      sort: '-created',
    });
    return records;
  } catch (error) {
    console.error('Error listing approved items:', error);
    throw error;
  }
},
```

#### 2.3 Update `items.create()` (lines 161-206)

**Current Issue**:
- Line 164: Queries by `child` filter (assumes child exists)
- Line 182: Hardcodes `status: 'pending'`
- Requires `child` in data parameter

**Solution**:
- Accept either `child` or `parent` in data
- If `parent` exists, set `status: 'approved'` (auto-approve)
- If `child` exists, set `status: 'pending'` (requires approval)
- Handle duplicate checking for both child and parent items

**Updated Code**:
```javascript
// Line 161-206
create: async (data) => {
  try {
    // Validation: must have exactly one of child or parent
    if (!data.child && !data.parent) {
      throw new Error('Item must have either a child or parent');
    }
    if (data.child && data.parent) {
      throw new Error('Item cannot have both child and parent');
    }

    // Check for existing item with same URL
    let existingFilter;
    if (data.child) {
      existingFilter = `child = "${data.child}" && url = "${data.url}"`;
    } else {
      existingFilter = `parent = "${data.parent}" && url = "${data.url}"`;
    }

    const existing = await pb.collection('items').getFullList({
      filter: existingFilter,
    });

    if (existing.length > 0) {
      throw new Error('An item with this URL already exists in this wishlist');
    }

    // Handle image upload if present
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'image' && data[key]) {
        formData.append(key, data[key]);
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    // Auto-approve parent items, pending for child items
    formData.append('status', data.parent ? 'approved' : 'pending');
    if (data.parent) {
      formData.append('approved_at', new Date().toISOString());
    }

    const record = await pb.collection('items').create(formData);
    return record;
  } catch (error) {
    console.error('Error creating item:', error);
    throw error;
  }
},
```

#### 2.4 Add Helper Function `items.createParentItem()`

**Purpose**: Convenience function for creating parent wishlist items

**Add after `items.create()`**:
```javascript
// Add around line 207
createParentItem: async (parentId, itemData) => {
  return items.create({
    ...itemData,
    parent: parentId,
    from_santa: false, // Parent items are not secret gifts
  });
},
```

---

## Phase 3: Critical Component Fixes

### 3.1 EquityDashboard.jsx

**File**: `frontend/src/components/EquityDashboard.jsx`

**Current Issue** (line 44):
- Assumes all items belong to children
- Calculation: `allItems.filter((item) => item.child === child.id)`

**Solution**:
- Filter out parent items BEFORE any calculations
- Only include items that have a `child` field (exclude items with `parent` field)

**Code Changes**:
```javascript
// Around line 43-50, before calculating stats
const childItemsOnly = allItems.filter(item => item.child && !item.parent);

const stats = childrenList.map((child) => {
  const childItems = childItemsOnly.filter((item) => item.child === child.id); // Use filtered list
  const approvedItems = childItems.filter((item) => item.status === 'approved');
  const reservedItems = approvedItems.filter(
    (item) => item.expand?.reservations_via_item?.length > 0
  );
  // ... rest of calculation
});
```

**Critical**: This ensures parent items don't affect equity calculations.

---

### 3.2 ChildWishlist.jsx

**File**: `frontend/src/pages/ChildWishlist.jsx`

**Current Behavior**:
- Line 43: Loads items filtered by `child: childId`
- Line 45: Filters out `from_santa` items

**Potential Issue**:
- If query returns parent items somehow, they could leak to children

**Solution** (defensive filtering):
```javascript
// Around line 43-54
useEffect(() => {
  const loadItems = async () => {
    if (!childData) return;
    try {
      const fetchedItems = await itemsAPI.list({ child: childId });

      // DEFENSE IN DEPTH: Ensure only this child's items are shown
      // Filter out items with parent field and from_santa items
      const childOnlyItems = fetchedItems.filter(
        (item) => !item.parent && !item.from_santa && item.child === childId
      );

      setItems(childOnlyItems);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load wishlist items');
    } finally {
      setLoading(false);
    }
  };
  loadItems();
}, [childData, childId]);
```

**Why**: Extra safety layer to prevent parent items from being visible to children.

---

### 3.3 FamilyView.jsx

**File**: `frontend/src/pages/FamilyView.jsx`

**Current Behavior**:
- Line 52: Loads all approved items
- Line 54: Filters out `from_santa` items
- Lines 185-221: Groups items by child name
- Line 219: Creates kid filter from `item.expand?.child?.name`

**Required Changes**:

#### Change 1: Update Item Grouping Logic (lines 185-221)

**Current**:
```javascript
const groupedItems = items.reduce((acc, item) => {
  const kidName = item.expand?.child?.name || 'Unknown';
  if (!acc[kidName]) {
    acc[kidName] = [];
  }
  acc[kidName].push(item);
  return acc;
}, {});
```

**Updated**:
```javascript
const groupedItems = items.reduce((acc, item) => {
  // Determine person name: child or parent
  const personName = item.expand?.child?.name || item.expand?.parent?.name || 'Unknown';

  if (!acc[personName]) {
    acc[personName] = [];
  }
  acc[personName].push(item);
  return acc;
}, {});
```

#### Change 2: Update Kid Filter List (line 219)

**Current**:
```javascript
const uniqueKids = [...new Set(items.map((item) => item.expand?.child?.name))].filter(Boolean);
```

**Updated**:
```javascript
const uniquePeople = [
  ...new Set(
    items.map((item) => item.expand?.child?.name || item.expand?.parent?.name)
  )
].filter(Boolean);
```

**Also update**:
- Line 226: `kidFilter` state variable → rename to `personFilter`
- Line 360: Header text logic should work as-is since it uses the grouped key

#### Change 3: Update Filter Logic (line 210)

**Current**:
```javascript
const filteredItems = kidFilter === 'all'
  ? items
  : items.filter((item) => item.expand?.child?.name === kidFilter);
```

**Updated**:
```javascript
const filteredItems = personFilter === 'all'
  ? items
  : items.filter((item) => {
      const personName = item.expand?.child?.name || item.expand?.parent?.name;
      return personName === personFilter;
    });
```

---

### 3.4 ReviewItems.jsx

**File**: `frontend/src/components/ReviewItems.jsx`

**Current Behavior**:
- Line 44: Loads all items
- Line 201: Optional kid filter
- Lines 232-235: `getKidName()` function to display child name
- Line 744: Displays kid name in table

**Required Changes**:

#### Change 1: Update `getKidName()` Function (lines 232-235)

**Current**:
```javascript
const getKidName = (childId) => {
  const child = childrenList.find((c) => c.id === childId);
  return child ? child.name : 'Unknown';
};
```

**Updated** (rename to `getPersonName()`):
```javascript
const getPersonName = (item) => {
  // Check if item belongs to parent
  if (item.parent) {
    return item.expand?.parent?.name || 'Unknown Parent';
  }

  // Otherwise, it's a child item
  const child = childrenList.find((c) => c.id === item.child);
  return child ? child.name : 'Unknown';
};
```

#### Change 2: Update Kid Filter Dropdown (around line 201)

**Add logic to include parents in filter options**:
```javascript
// Get unique people (children + parents)
const uniqueChildren = childrenList.map(c => ({ id: c.id, name: c.name, type: 'child' }));

const parentItems = allItems.filter(item => item.parent);
const uniqueParents = [...new Set(parentItems.map(item => ({
  id: item.parent,
  name: item.expand?.parent?.name || 'Unknown',
  type: 'parent'
})))];

const allPeople = [...uniqueChildren, ...uniqueParents];
```

#### Change 3: Update Table Display (line 744)

**Current**:
```javascript
<td>{getKidName(item.child)}</td>
```

**Updated**:
```javascript
<td>{getPersonName(item)}</td>
```

#### Change 4: Update "Add Gift" Modal (lines 110-138)

**Current**: Creates items with `child` field
**Update**: Allow parents to add items to their own wishlist

**Add UI Option**:
- Radio buttons or dropdown: "Add to: [Child Name] / My Wishlist"
- If "My Wishlist" selected, create with `parent: currentUser.id`

---

## Phase 4: New Parent Wishlist Page

### File: `frontend/src/pages/ParentWishlist.jsx` (NEW FILE)

**Purpose**: Dedicated page for parents to manage their own wishlist

**Template**: Base this on `ChildWishlist.jsx` structure

**Key Differences**:
- No PIN authentication needed
- Uses logged-in parent's user ID
- Items created with `parent: userId` instead of `child: childId`
- Items auto-approved (status='approved')
- No "from santa" filter needed

**Implementation**:
```javascript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb, { items as itemsAPI } from '../lib/pocketbase';

export default function ParentWishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = pb.authStore.model;

  // Ensure user is a parent
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'parent') {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // Load parent's items
  useEffect(() => {
    const loadItems = async () => {
      if (!currentUser) return;
      try {
        const fetchedItems = await itemsAPI.list({ parent: currentUser.id });
        setItems(fetchedItems);
      } catch (err) {
        console.error('Failed to load items:', err);
        setError('Failed to load your wishlist');
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [currentUser]);

  // Add item handler
  const handleAddItem = async (itemData) => {
    try {
      await itemsAPI.createParentItem(currentUser.id, itemData);
      // Reload items
      const updatedItems = await itemsAPI.list({ parent: currentUser.id });
      setItems(updatedItems);
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add item to wishlist');
    }
  };

  // Delete item handler
  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await itemsAPI.delete(itemId);
      setItems(items.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('Failed to delete item');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="parent-wishlist">
      <h1>My Wishlist</h1>

      <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>

      {/* Add Item Form Component */}
      {/* Reuse or create similar to ChildWishlist */}

      {/* Items List */}
      <div className="items-list">
        {items.length === 0 ? (
          <p>You haven't added any items yet.</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="item-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {item.url && <a href={item.url}>Link</a>}
              {item.price && <p>Price: ${item.price}</p>}
              <button onClick={() => handleDeleteItem(item.id)}>Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Phase 5: Routing & Navigation

### File: `frontend/src/App.jsx` (or routing file)

#### Add Route for Parent Wishlist

**Add route**:
```javascript
<Route path="/parent-wishlist" element={<ParentWishlist />} />
```

**Import**:
```javascript
import ParentWishlist from './pages/ParentWishlist';
```

---

### File: Parent Dashboard Navigation

**Add Link to Parent Wishlist**:
- Location: Wherever parent navigation menu exists
- Link text: "My Wishlist" or "Manage My Wishlist"
- Route: `/parent-wishlist`

Example:
```javascript
<button onClick={() => navigate('/parent-wishlist')}>
  My Wishlist
</button>
```

---

## Phase 6: Validation & Testing

### Frontend Validation

**Add to `items.create()` in pocketbase.js**:
- Already included in Phase 2.3 above
- Ensures items have exactly one of `child` or `parent`

### Manual Testing Checklist

#### Test 1: Parent Creates Wishlist Item
- [ ] Parent can navigate to their wishlist page
- [ ] Parent can add items with title, description, URL, price
- [ ] Items appear immediately (no approval needed)
- [ ] Items have `status='approved'`

#### Test 2: Visibility - Family View
- [ ] Family members can see parent wishlist items
- [ ] Items grouped under parent's name (e.g., "Mom's Wishlist")
- [ ] Family members can reserve parent items
- [ ] Reservations work correctly for parent items

#### Test 3: Visibility - Children View
- [ ] Children CANNOT see parent wishlist items
- [ ] Children can only see their own items
- [ ] No parent items leak into child views

#### Test 4: Equity Dashboard
- [ ] Parent items excluded from equity calculations
- [ ] Equity metrics only count child items
- [ ] Dashboard doesn't crash with parent items present

#### Test 5: Parent Review Page
- [ ] Parents can see both child items AND parent items
- [ ] Kid filter includes parent names
- [ ] Parent can approve/reject child items
- [ ] Parent items show correct owner name

#### Test 6: Multiple Parents
- [ ] Multiple parents can each create separate wishlists
- [ ] Parent A cannot edit Parent B's items
- [ ] Each parent's items appear under their own name

#### Test 7: Edge Cases
- [ ] Cannot create item with both child and parent
- [ ] Cannot create item with neither child nor parent
- [ ] Deleting parent doesn't crash (test cascade behavior)

---

## Implementation Order (Recommended)

### Step 1: Schema & API Foundation
1. Update `backend/pb_schema.json` (make child optional, add parent field)
2. Restart PocketBase
3. Update `frontend/src/lib/pocketbase.js` (expand strings, create function)

### Step 2: Fix Existing Components (Critical)
4. Update `EquityDashboard.jsx` (filter parent items)
5. Update `ChildWishlist.jsx` (defensive filtering)
6. Update `FamilyView.jsx` (handle parent items in grouping)

### Step 3: Parent Management
7. Update `ReviewItems.jsx` (display logic)
8. Create `ParentWishlist.jsx` (new page)
9. Add routing and navigation

### Step 4: Testing & Refinement
10. Manual testing per checklist
11. Bug fixes and UI polish

---

## Rollback Plan

If issues arise:

1. **Schema rollback**: Change `items.child` back to `required: true`, remove `parent` field
2. **Code rollback**: Revert API and component changes via git
3. **Data cleanup**: Delete any items with `parent` field set (if needed)

---

## Future Enhancements (Out of Scope)

- Parent items in equity tracking (separate tracking)
- Budget targets for parents
- Parent-to-parent gift reservations (hidden from each other)
- Mobile responsiveness for parent wishlist page
- Bulk import for parent items

---

## Questions & Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Schema approach | Add `parent` field to `items` | Maximal code reuse, clean model |
| Parent item visibility to children | Hidden | Privacy - children shouldn't see parent gifts |
| Parent item visibility to family | Visible | Family needs to reserve parent gifts |
| Equity tracking | Exclude parent items | Equity is for children only |
| Multiple parents | Yes, separate wishlists | Each parent independent |
| Auto-approval | Yes, status='approved' | Parents don't need approval workflow |
| Display in Family View | Grouped with children by name | Consistent UX pattern |

---

## Contact & Support

For implementation questions or issues:
- Review existing code patterns in codebase
- Check PocketBase documentation: https://pocketbase.io/docs/
- Refer to this document for design decisions

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Status**: Ready for Implementation
