# Authentication System Redesign Plan

## Overview
Simplify authentication by using route-based authentication for kids and family members, and a streamlined parent login with name dropdown.

---

## User Decisions
Based on clarifying questions:
- **Parent login dropdown**: Display parent's **name** (not email)
- **Kid PINs**: **Remove entirely** - route-based auth only
- **Route format**: **Restricted** - lowercase letters, numbers, and hyphens only
- **Invalid route handling**: **Redirect to parent login**

---

## Database Changes

### 1. Add `route` field to users collection
- **Field name**: `route`
- **Type**: text
- **Required**: Yes (for family members only)
- **Unique**: Yes (must be unique across entire collection)
- **Pattern validation**: `^[a-z0-9-]+$` (lowercase, numbers, hyphens only)
- **Purpose**: Used for family member route-based authentication (e.g., `/grandma`)

### 2. Add `route` field to children collection
- **Field name**: `route`
- **Type**: text
- **Required**: Yes
- **Unique**: Yes (must be unique across entire collection)
- **Pattern validation**: `^[a-z0-9-]+$`
- **Purpose**: Used for kid route-based authentication (e.g., `/max`, `/stella`)

### 3. Remove `pin` field from children collection
- PIN authentication is being completely replaced by route-based auth
- **Migration needed**: Existing children records have PIN values that need to be replaced with routes

---

## Frontend Changes

### 1. Redesign Login.jsx
**Current state**: Three-tab interface (Parent/Kid/Family) with different form fields

**New design**: Parent-only login page
- **Remove**: Kid and family login tabs entirely
- **Add**: Dropdown to select parent by name
  - Query: `pb.collection('users').getFullList({ filter: 'role = "parent"', sort: 'name' })`
  - Display: Parent's name
  - Value: Parent's ID or email
- **Keep**: Password field
- **Remove**: All child/family login logic from submit handler
- **UI**: Clean, simple form with just dropdown + password

### 2. Update App.jsx routing
**Add dynamic catch-all route** to handle kid/family authentication:

```javascript
// Place this route LAST in the Routes component
<Route path="/:route" element={<RouteAuth />} />
```

**Logic for RouteAuth component**:
1. Extract route param from URL
2. Call `authenticateByRoute(route)`
3. If child found → Set sessionStorage + redirect to `/child`
4. If family member found → Set auth session + redirect to `/family`
5. If no match → Redirect to `/login`

**Important**: This catch-all must be placed AFTER all other routes to avoid conflicts with existing routes like `/login`, `/parent`, etc.

### 3. Update pocketbase.js auth functions

**Remove these functions**:
- `loginChild()` - No longer used (route-based auth replaces form-based)
- `loginFamily()` - No longer used
- `registerFamily()` - Moved to parent dashboard

**Add new function**:
```javascript
authenticateByRoute: async (route) => {
  // 1. Try to find child with this route
  const childResults = await pb.collection('children').getFullList({
    filter: pb.filter('route = {:route}', { route })
  });

  if (childResults.length > 0) {
    const child = childResults[0];
    sessionStorage.setItem('activeChildId', child.id);
    sessionStorage.setItem('childData', JSON.stringify(child));
    return { type: 'child', data: child };
  }

  // 2. Try to find family member with this route
  const familyResults = await pb.collection('users').getFullList({
    filter: pb.filter('route = {:route} && role = "family_member"', { route })
  });

  if (familyResults.length > 0) {
    const family = familyResults[0];
    // Create pseudo-auth session for family member
    // Store in sessionStorage similar to children
    sessionStorage.setItem('activeFamilyId', family.id);
    sessionStorage.setItem('familyData', JSON.stringify(family));
    return { type: 'family', data: family };
  }

  // 3. No match found
  return null;
}
```

**Update logout function**:
```javascript
logout: () => {
  sessionStorage.removeItem('activeChildId');
  sessionStorage.removeItem('childData');
  sessionStorage.removeItem('activeFamilyId');
  sessionStorage.removeItem('familyData');
  pb.authStore.clear();
}
```

### 4. Update ManageChildren.jsx

**Remove**: PIN field from add/edit child form

**Add**: Route field to add/edit child form
- **Label**: "Login Route"
- **Input type**: text
- **Placeholder**: "e.g., max, stella"
- **Validation**:
  - Pattern: `/^[a-z0-9-]+$/`
  - Client-side check before submit
  - Error message: "Route must contain only lowercase letters, numbers, and hyphens"
- **Helper text**: "Your child will login by going to /{route} (e.g., /max)"

**Update credentials display**:
```javascript
// OLD:
<div>PIN: {child.pin}</div>

// NEW:
<div>
  <span>Login URL:</span>
  <a href={`/${child.route}`} target="_blank">
    yoursite.com/{child.route}
  </a>
</div>
```

### 5. Update ManageFamily.jsx

**Current**: Only lists and removes family members

**Add**: Family member creation form
- **Fields**:
  - Name (text input, required)
  - Route (text input, required, validated)
- **Validation**:
  - Route pattern: `^[a-z0-9-]+$`
  - Check uniqueness against both users and children collections
- **On submit**:
  ```javascript
  await pb.collection('users').create({
    name: formData.name,
    route: formData.route,
    role: 'family_member',
    email: `${formData.route}@family.local`, // dummy email for PocketBase
    password: 'notused123', // dummy password (they won't use it)
    passwordConfirm: 'notused123'
  });
  ```

**Update display**:
- Show family member name
- Show login route (e.g., "Login: /grandma-pappap")
- Keep delete button

### 6. Delete FamilySignup.jsx
- **Remove file**: `frontend/src/pages/FamilySignup.jsx`
- **Remove route**: Delete `<Route path="/signup" element={<FamilySignup />} />` from App.jsx
- **Remove link**: Delete "Sign up here" link from Login.jsx (line 154-160)

### 7. Update App.jsx auth checks

**Current**:
```javascript
const [isChild, setIsChild] = useState(!!sessionStorage.getItem('activeChildId'));
```

**New**: Need to check for both children AND family members
```javascript
const [isChild, setIsChild] = useState(!!sessionStorage.getItem('activeChildId'));
const [isFamily, setIsFamily] = useState(!!sessionStorage.getItem('activeFamilyId'));
```

**Update route guards**:
```javascript
// Family route protection
<Route path="/family" element={
  (user?.role === 'family_member' || isFamily) ? <FamilyView /> : <Navigate to="/login" />
} />
```

### 8. Update FamilyView.jsx

**Current**: Uses `authStore.user()` to get family member info

**New**: Check both authStore AND sessionStorage
```javascript
const getFamilyUser = () => {
  // First check PocketBase auth (for parents viewing as family)
  if (authStore.user()?.role === 'family_member') {
    return authStore.user();
  }

  // Then check sessionStorage (for route-based auth)
  const familyDataStr = sessionStorage.getItem('familyData');
  if (familyDataStr) {
    return JSON.parse(familyDataStr);
  }

  return null;
};
```

---

## PocketBase Configuration Changes

### 1. Update users collection API rules

**Create rule**:
- **Current**: `""` (empty = public can create)
- **New**: `@request.auth.role = 'parent'`
- **Effect**: Only parents can create family members (via dashboard), removes public self-registration

### 2. Update children collection API rules

**List rule**:
- **Current**: `@request.auth.id != ""`
- **New**: `@request.auth.id != "" || route != ""`
- **Effect**: Allows unauthenticated queries when filtering by route (for route-based auth)

### 3. Update users collection fields

**Email field**:
- **Issue**: PocketBase auth collections require unique emails
- **Solution**: For family members created via dashboard, use dummy emails like `{route}@family.local`
- **Note**: These emails won't be used for login, only for PocketBase constraints

---

## Implementation Order

1. **Database schema updates**:
   - Add `route` field to users collection
   - Add `route` field to children collection
   - Update validation rules (unique, pattern)
   - Update API rules

2. **Auth logic (pocketbase.js)**:
   - Add `authenticateByRoute()` function
   - Update `logout()` function
   - Remove `loginChild()`, `loginFamily()`, `registerFamily()`

3. **Route handling (App.jsx)**:
   - Add catch-all `/:route` route at the end
   - Create `RouteAuth` component
   - Update auth state to track family sessionStorage
   - Update route guards

4. **Parent Dashboard**:
   - Update ManageChildren: Remove PIN field, add route field
   - Update ManageFamily: Add creation form with name + route

5. **Login page redesign (Login.jsx)**:
   - Remove kid/family tabs
   - Add parent name dropdown
   - Simplify to parent-only login

6. **Family view updates (FamilyView.jsx)**:
   - Update to check sessionStorage for route-based auth
   - Maintain backward compatibility with PocketBase auth

7. **Cleanup**:
   - Delete FamilySignup.jsx
   - Remove signup route from App.jsx
   - Remove signup link from Login.jsx

8. **Testing**:
   - Test parent login with dropdown
   - Test kid route authentication (e.g., /max)
   - Test family route authentication (e.g., /grandma)
   - Test invalid route handling (redirect to login)
   - Test logout for all user types

---

## Data Migration

### Existing Children (with PINs)
**Manual migration needed**:
1. Go to PocketBase admin
2. For each child record:
   - Add route field value (e.g., "max", "stella")
   - Can remove PIN field after route is added

**OR create migration script**:
```javascript
// Convert name to route: lowercase, replace spaces with hyphens
const generateRoute = (name) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};
```

### Existing Family Members
**Manual migration needed**:
1. Go to PocketBase admin
2. For each family member:
   - Add route field (e.g., "grandma-pappap", "nana")
   - Ensure uniqueness across all users and children

---

## Security Considerations

### 1. Route Uniqueness
- Routes must be unique across BOTH children and users collections
- Prevent collisions (can't have child "max" and family "max")
- Implement cross-collection uniqueness check in creation forms

### 2. Route Format Validation
- Client-side: Validate before form submission
- Server-side: PocketBase schema validation with pattern `^[a-z0-9-]+$`
- Prevents special characters, uppercase, spaces

### 3. No Passwords for Family Members
- Family members authenticate via route only (no password)
- Acceptable trade-off: Simpler UX vs. slightly lower security
- Anyone with the route can access that family member's view
- Consider: Add optional PIN for family members if needed later

### 4. Rate Limiting
- Consider rate limiting on route-based auth attempts
- Prevents brute-force route discovery
- Implement in PocketBase middleware or proxy

### 5. Reserved Routes
- Prevent using routes that conflict with existing paths
- Reserved: "login", "parent", "child", "family", "signup"
- Add validation to check against reserved route list

---

## Testing Checklist

### Parent Login
- [ ] Dropdown shows all parents by name
- [ ] Can select parent and enter password
- [ ] Successful login redirects to /parent
- [ ] Failed login shows error message
- [ ] Dropdown is empty if no parents exist

### Kid Route Auth
- [ ] Navigating to /max (valid kid route) logs in as Max
- [ ] Navigating to /stella (valid kid route) logs in as Stella
- [ ] Navigating to /invalid-kid redirects to /login
- [ ] Kid sees their own wishlist after route login
- [ ] Kid logout clears session and redirects

### Family Route Auth
- [ ] Navigating to /grandma logs in as Grandma
- [ ] Navigating to /nana logs in as Nana
- [ ] Navigating to /invalid-family redirects to /login
- [ ] Family member sees approved items after route login
- [ ] Family logout clears session and redirects

### Parent Dashboard
- [ ] Can create kids with route field
- [ ] Route validation prevents invalid characters
- [ ] Can't create duplicate routes
- [ ] Kids display with login URL instead of PIN
- [ ] Can create family members with name + route
- [ ] Can't create duplicate family routes
- [ ] Family members display with login URL

### Route Conflicts
- [ ] Can't create kid route that matches family route
- [ ] Can't create family route that matches kid route
- [ ] Can't use reserved routes (login, parent, child, family)

### Logout
- [ ] Parent logout clears PocketBase auth
- [ ] Kid logout clears sessionStorage
- [ ] Family logout clears sessionStorage
- [ ] All logouts redirect to /login

---

## Rollback Plan

If issues arise during implementation:

1. **Keep old login code** in a separate branch before starting
2. **Feature flag**: Add `VITE_USE_NEW_AUTH` env variable to toggle between old/new
3. **Database**: Don't delete PIN field immediately - mark as optional
4. **Gradual rollout**:
   - Deploy route-based auth alongside existing auth
   - Test with small group first
   - Fully migrate once stable

---

## Future Enhancements

### Optional Improvements (Not in initial scope):
1. **QR Codes**: Generate QR codes for kid/family routes for easy mobile access
2. **Custom Domains**: Allow routes like `max.wishlist.family` instead of `/max`
3. **Route Analytics**: Track which routes are accessed most frequently
4. **Route Expiration**: Optional time-limited routes for temporary family access
5. **PIN Option**: Add optional PIN for family members who want extra security
