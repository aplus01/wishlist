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

// Utility function to get image URL from PocketBase record
export const getImageUrl = (record, filename, size = '300x300') => {
  if (!record || !filename) return null;
  // If size is specified and available, use thumbnail
  if (size) {
    return pb.files.getUrl(record, filename, { thumb: size });
  }
  return pb.files.getUrl(record, filename);
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
    const options = {
      expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by',
      sort: '-created',
    };

    // Build filter using PocketBase's filter builder for safety
    if (Object.keys(filters).length > 0) {
      const filterConditions = Object.entries(filters).map(([key, value]) => {
        return `${key} = {:${key}}`;
      });
      const filterStr = filterConditions.join(' && ');
      options.filter = pb.filter(filterStr, filters);
    }

    const results = await pb.collection('items').getFullList(options);

    // Sort by priority on the client side, handling missing priority values
    return results.sort((a, b) => {
      const priorityA = a.priority ?? 999999;
      const priorityB = b.priority ?? 999999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // If priorities are equal (or both missing), sort by creation date (newest first)
      return new Date(b.created) - new Date(a.created);
    });
  },

  listApproved: async () => {
    return pb.collection('items').getFullList({
      filter: 'status = "approved"',
      expand: 'child,parent,reservations_via_item,reservations_via_item.reserved_by',
      sort: '-approved_at',
    });
  },

  create: async (data) => {
    // Validation: must have exactly one of child or parent
    if (!data.child && !data.parent) {
      throw new Error('Item must have either a child or parent');
    }
    if (data.child && data.parent) {
      throw new Error('Item cannot have both child and parent');
    }

    // Get all items for this child/parent to find max priority
    let filterExpression;
    if (data.child) {
      filterExpression = pb.filter('child = {:childId}', { childId: data.child });
    } else {
      filterExpression = pb.filter('parent = {:parentId}', { parentId: data.parent });
    }

    const existingItems = await pb.collection('items').getFullList({
      filter: filterExpression,
    });

    // Find max priority, handling items that might not have priority set
    let maxPriority = -1;
    existingItems.forEach((item) => {
      if (
        item.priority !== undefined &&
        item.priority !== null &&
        item.priority > maxPriority
      ) {
        maxPriority = item.priority;
      }
    });

    // Handle image download if image_url is provided
    const formData = new FormData();

    // Auto-approve parent items, pending for child items
    if (data.parent) {
      formData.append('status', 'approved');
      formData.append('approved_at', new Date().toISOString());
    } else {
      formData.append('status', 'pending');
    }

    formData.append('priority', maxPriority + 1);

    let hasImage = false;
    for (const [key, value] of Object.entries(data)) {
      if (key === 'image_url' && value) {
        // Download and upload image
        console.log('Downloading image for upload...');
        const imageFile = await items.downloadImage(value);
        if (imageFile) {
          console.log('Appending image file to formData:', imageFile);
          formData.append('image', imageFile);
          hasImage = true;
        } else {
          console.error('Failed to download image');
        }
      } else if (key !== 'image_url') {
        formData.append(key, value);
      }
    }

    console.log('Creating item with formData, hasImage:', hasImage);
    const result = await pb.collection('items').create(formData);
    console.log('Created item:', result);
    return result;
  },

  // Helper function for creating parent wishlist items
  createParentItem: async (parentId, itemData) => {
    return items.create({
      ...itemData,
      parent: parentId,
      from_santa: false, // Parent items are not secret gifts
    });
  },

  update: async (id, data) => {
    // Handle image download if image_url is provided
    if (data.image_url) {
      const formData = new FormData();

      let hasImage = false;
      for (const [key, value] of Object.entries(data)) {
        if (key === 'image_url' && value) {
          // Download and upload image
          console.log('Downloading image for update...');
          const imageFile = await items.downloadImage(value);
          if (imageFile) {
            console.log(
              'Appending image file to formData for update:',
              imageFile
            );
            formData.append('image', imageFile);
            hasImage = true;
          } else {
            console.error('Failed to download image for update');
          }
        } else if (key !== 'image_url') {
          formData.append(key, value);
        }
      }

      console.log('Updating item with formData, hasImage:', hasImage);
      const result = await pb.collection('items').update(id, formData);
      console.log('Updated item:', result);
      return result;
    }

    return pb.collection('items').update(id, data);
  },

  approve: async (id) => {
    return pb.collection('items').update(id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
  },

  unapprove: async (id) => {
    return pb.collection('items').update(id, {
      status: 'pending',
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

  updatePriority: async (id, priority) => {
    return pb.collection('items').update(id, { priority });
  },

  bulkUpdatePriorities: async (updates) => {
    // updates is an array of { id, priority }
    const promises = updates.map(({ id, priority }) =>
      pb.collection('items').update(id, { priority })
    );
    return Promise.all(promises);
  },

  // Fix items without priorities - assigns priorities based on creation date
  fixMissingPriorities: async (childId = null) => {
    const filter = childId ? pb.filter('child = {:childId}', { childId }) : '';
    const allItems = await pb.collection('items').getFullList({
      filter,
      sort: 'created',
    });

    const updates = allItems
      .filter((item) => item.priority === undefined || item.priority === null)
      .map((item, index) => ({
        id: item.id,
        priority: allItems.length + index,
      }));

    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ id, priority }) =>
          pb.collection('items').update(id, { priority })
        )
      );
    }

    return updates.length;
  },

  // Download image from URL and return as blob
  downloadImage: async (imageUrl) => {
    console.log('Attempting to download image from:', imageUrl);
    try {
      // Try with CORS proxy first
      const proxies = [
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => url, // Try direct as fallback
      ];

      for (const proxy of proxies) {
        try {
          const proxyUrl = proxy(imageUrl);
          console.log('Trying proxy:', proxyUrl);
          const response = await fetch(proxyUrl);
          console.log('Response status:', response.status, response.ok);

          if (!response.ok) continue;

          const blob = await response.blob();
          console.log('Downloaded blob:', blob.size, 'bytes, type:', blob.type);

          // Get file extension from URL or content type
          const contentType = blob.type || 'image/jpeg';
          const ext = contentType.split('/')[1] || 'jpg';
          const filename = `product-${Date.now()}.${ext}`;

          const file = new File([blob], filename, { type: contentType });
          console.log('Created file:', file.name, file.size, file.type);
          return file;
        } catch (err) {
          console.error('Download attempt failed:', err);
          continue;
        }
      }

      console.error('All download attempts failed');
      return null;
    } catch (err) {
      console.error('Error downloading image:', err);
      return null;
    }
  },

  // Scrape image from URL using Open Graph tags
  scrapeImage: async (url) => {
    // Try multiple CORS proxies
    const proxies = [
      (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url) =>
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    ];

    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy(url), {
          headers: {
            Accept: 'text/html',
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Create a temporary DOM element to parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Try Open Graph image first (most reliable)
        let imageUrl = doc.querySelector('meta[property="og:image"]')?.content;

        // Try Twitter card image
        if (!imageUrl) {
          imageUrl = doc.querySelector('meta[name="twitter:image"]')?.content;
        }

        // Try product schema image
        if (!imageUrl) {
          const productSchemas = doc.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          for (const schema of productSchemas) {
            try {
              const data = JSON.parse(schema.textContent);
              if (data.image) {
                imageUrl = Array.isArray(data.image)
                  ? data.image[0]
                  : data.image;
                if (imageUrl) break;
              }
            } catch {}
          }
        }

        // For Amazon specifically, look for main product image
        if (!imageUrl && url.includes('amazon.com')) {
          // Amazon uses specific IDs for main product images
          const mainImage = doc.querySelector(
            '#landingImage, #imgBlkFront, #main-image, img[data-a-image-name="landingImage"]'
          );
          if (mainImage) {
            imageUrl =
              mainImage.src ||
              mainImage.getAttribute('data-old-hires') ||
              mainImage.getAttribute('data-a-dynamic-image');
            // data-a-dynamic-image contains JSON with image URLs
            if (imageUrl && imageUrl.startsWith('{')) {
              try {
                const imageData = JSON.parse(imageUrl);
                imageUrl = Object.keys(imageData)[0]; // Get first (largest) image
              } catch {}
            }
          }
        }

        // Try looking for large product images (common pattern)
        if (!imageUrl) {
          const imgs = doc.querySelectorAll('img[src], img[data-src]');
          for (const img of imgs) {
            const src =
              img.src ||
              img.getAttribute('data-src') ||
              img.getAttribute('data-lazy-src');
            // Skip tracking pixels, icons, and logos - look for actual product images
            if (
              src &&
              !src.includes('1x1') &&
              !src.includes('pixel') &&
              !src.includes('icon') &&
              !src.includes('logo') &&
              !src.includes('csi') &&
              !src.includes('tracking') &&
              !src.includes('sprite') &&
              src.length > 50 &&
              (src.includes('image') ||
                src.includes('product') ||
                src.includes('media'))
            ) {
              imageUrl = src;
              break;
            }
          }
        }

        if (imageUrl) {
          // Make sure image URL is absolute
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            const urlObj = new URL(url);
            imageUrl = urlObj.origin + imageUrl;
          }

          // Final validation - skip if looks like a tracking pixel
          if (
            imageUrl.includes('1x1') ||
            imageUrl.includes('pixel') ||
            imageUrl.includes('csi')
          ) {
            continue;
          }

          return imageUrl;
        }
      } catch (err) {
        console.error('Proxy failed:', err);
        continue;
      }
    }

    console.error('Could not find image for URL:', url);
    return null;
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
