import PocketBase from 'pocketbase';

const pb = new PocketBase(
  import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
);

// Utility function to format currency with commas
export const formatCurrency = (amount) => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Enable auto cancellation for duplicate requests
pb.autoCancellation(false);

export default pb;

// Helper functions
export const authStore = {
  isValid: () => pb.authStore.isValid,
  token: () => pb.authStore.token,
  user: () => pb.authStore.model,
  clear: () => pb.authStore.clear(),
};

export const auth = {
  // Parent login
  loginParent: async (email, password) => {
    const authData = await pb
      .collection('users')
      .authWithPassword(email, password);
    if (authData.record.role !== 'parent') {
      pb.authStore.clear();
      throw new Error('Invalid credentials for parent account');
    }
    return authData;
  },

  // Route-based authentication for kids and family members
  authenticateByRoute: async (route) => {
    try {
      // 1. Try to find child with this route
      const childResults = await pb.collection('children').getFullList({
        filter: pb.filter('route = {:route}', { route }),
      });

      if (childResults.length > 0) {
        const child = childResults[0];
        sessionStorage.setItem('activeChildId', child.id);
        sessionStorage.setItem('childData', JSON.stringify(child));
        return { type: 'child', data: child };
      }

      // 2. Try to find family member with this route
      const familyResults = await pb.collection('users').getFullList({
        filter: pb.filter('route = {:route} && role = "family_member"', {
          route,
        }),
      });

      if (familyResults.length > 0) {
        const family = familyResults[0];
        sessionStorage.setItem('activeFamilyId', family.id);
        sessionStorage.setItem('familyData', JSON.stringify(family));
        return { type: 'family', data: family };
      }

      // 3. No match found
      return null;
    } catch (err) {
      console.error('Route authentication error:', err);
      return null;
    }
  },

  logout: () => {
    sessionStorage.removeItem('activeChildId');
    sessionStorage.removeItem('childData');
    sessionStorage.removeItem('activeFamilyId');
    sessionStorage.removeItem('familyData');
    pb.authStore.clear();
  },
};

export const children = {
  list: async (parentId) => {
    const filter = `parent ~ "${parentId}"`;
    const results = await pb.collection('children').getFullList({
      filter: filter,
      sort: 'created',
    });
    return results;
  },

  create: async (data) => {
    return pb.collection('children').create(data);
  },

  update: async (id, data) => {
    return pb.collection('children').update(id, data);
  },

  delete: async (id) => {
    return pb.collection('children').delete(id);
  },

  getOne: async (id) => {
    return pb.collection('children').getOne(id);
  },
};

export const items = {
  list: async (filters = {}) => {
    const filterStr = Object.entries(filters)
      .map(([key, value]) => `${key} = "${value}"`)
      .join(' && ');

    const options = {
      expand: 'child,reservations_via_item,reservations_via_item.reserved_by',
      sort: '-created',
    };

    if (filterStr) {
      options.filter = filterStr;
    }

    return pb.collection('items').getFullList(options);
  },

  listApproved: async () => {
    return pb.collection('items').getFullList({
      filter: 'status = "approved"',
      expand: 'child,reservations_via_item,reservations_via_item.reserved_by',
      sort: '-approved_at',
    });
  },

  create: async (data) => {
    return pb.collection('items').create({
      status: 'pending',
      ...data,
    });
  },

  update: async (id, data) => {
    return pb.collection('items').update(id, data);
  },

  approve: async (id) => {
    return pb.collection('items').update(id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
  },

  reject: async (id) => {
    return pb.collection('items').update(id, {
      status: 'rejected',
    });
  },

  delete: async (id) => {
    return pb.collection('items').delete(id);
  },
};

export const reservations = {
  list: async (filters = {}) => {
    const filterStr = Object.entries(filters)
      .map(([key, value]) => `${key} = "${value}"`)
      .join(' && ');

    const options = {
      expand: 'item,item.child,reserved_by',
      sort: '-created',
    };

    if (filterStr) {
      options.filter = filterStr;
    }

    return pb.collection('reservations').getFullList(options);
  },

  create: async (itemId, userId = null) => {
    // Support both PocketBase auth and sessionStorage auth
    const reservedBy = userId || pb.authStore.model?.id;
    if (!reservedBy) {
      throw new Error('User ID not found. Please log in again.');
    }

    // Check if item is already reserved
    const existingReservations = await pb
      .collection('reservations')
      .getFullList({
        filter: pb.filter('item = {:itemId}', { itemId }),
      });

    if (existingReservations.length > 0) {
      throw new Error('This item has already been reserved.');
    }

    try {
      return await pb.collection('reservations').create({
        item: itemId,
        reserved_by: reservedBy,
        purchased: false,
      });
    } catch (error) {
      // If creation fails (e.g., due to race condition), check again and provide clear error
      const checkAgain = await pb.collection('reservations').getFullList({
        filter: pb.filter('item = {:itemId}', { itemId }),
      });

      if (checkAgain.length > 0) {
        throw new Error(
          'This item was just reserved by another family member.'
        );
      }
      throw error; // Re-throw if it's a different error
    }
  },

  update: async (id, data) => {
    return pb.collection('reservations').update(id, data);
  },

  delete: async (id) => {
    return pb.collection('reservations').delete(id);
  },

  markPurchased: async (id) => {
    return pb.collection('reservations').update(id, {
      purchased: true,
    });
  },
};

// Real-time subscriptions
export const subscribe = {
  items: (callback) => {
    return pb.collection('items').subscribe('*', callback);
  },

  reservations: (callback) => {
    return pb.collection('reservations').subscribe('*', callback);
  },

  unsubscribe: (subscription) => {
    if (subscription) {
      pb.collection(subscription.collection).unsubscribe(subscription.id);
    }
  },
};
