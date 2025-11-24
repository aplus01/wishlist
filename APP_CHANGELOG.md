# Christmas Wishlist App - Changelog

All notable changes to the Christmas Wishlist application will be documented in this file.

## [Unreleased]

### Added (Recent UI Improvements)

- **Comprehensive CSS Variable System**: Introduced 20+ CSS variables for easy theming
  - Color variables: `--green-dark`, `--green-medium`, `--green-light`, `--red-dark`, `--red-medium`, `--red-light`, `--gold`, `--cream`
  - Functional variables: `--edit-btn`, `--delete-btn`, `--item-bg`, `--header-bg-color`, `--heading-font-color`
- **Reusable Card Styling**: Created `.card-bordered` class for consistent 1px borders across all cards
- **Custom Material Design Icons**: Implemented custom SVG dropdown arrows for select inputs
- **Modern Input Styling**:
  - Squared borders (border-radius: 0) for all inputs
  - Consistent 1px border width across all form elements
  - Custom dropdown appearance with appearance: none
- **Stroked Button Style**: Updated secondary buttons with transparent backgrounds and 1px borders
- **Edit Button Theming**: Centralized edit button colors using `--edit-btn` CSS variable
- **Enhanced Table View**:
  - Added borders and shadows to wishlist table
  - Updated header to use `--green-medium` color
- **Improved Select Inputs**: Custom styled dropdowns with green borders and Material Design arrows throughout the app
- **Card Consistency**: Applied uniform border styling across all dashboard views (Review Items, Equity Dashboard, Family Management, Children Management)

### Changed

- Updated primary button hover effect to remove translateY animation for cleaner interaction
- Changed button borders from 2px to 1px throughout the app for more refined appearance
- Modified item cards to include borders on all sides (with green left border accent preserved)
- Standardized form input styling with `--green-dark` borders

### Design System

- **Color Palette**:
  - Primary: Green (#3d5a40 dark, #6b8a6e medium, #c4d5c5 light)
  - Accent: Gold (#d4af37)
  - Background: Cream (#f8f4e3)
  - Feedback: Red (#c41e3a dark, #d85971 medium, #ffd6d6 light)
- **Shadow System**:
  - Cards: `0 4px 6px rgba(0, 0, 0, 0.2)`
  - Items: `0 2px 4px rgba(0, 0, 0, 0.1)`
- **Border System**: Consistent 1px solid borders with rounded or squared corners depending on component type

## [1.0.0] - Initial Release

### Core Features

- **Multi-Role Authentication**: Parent, Child (PIN-based), and Family Member login
- **Parent Dashboard**:
  - Manage children with PIN authentication
  - Review and approve/reject wishlist items
  - Equity dashboard for monitoring gift distribution
  - Manage family member access with custom routes
- **Child Interface**:
  - Add wishlist items with title, description, price, URL, and images
  - Drag-and-drop priority ordering
  - Card and table view layouts
  - Status tracking (Pending, Approved, Rejected)
- **Family View**:
  - Browse approved wishlist items by child
  - Reserve gifts to prevent duplicates
  - Mark items as purchased
  - Filter by child and reservation status
- **Custom Family Routes**: Personalized login URLs for each family member (e.g., /grandma)

### Technical Implementation

- React 18 with Vite for fast development
- PocketBase self-hosted backend with row-level security
- Responsive design with mobile-first approach
- Docker support with multi-stage builds
- Nginx reverse proxy configuration
- Real-time updates via PocketBase subscriptions

### Security

- PIN authentication for children (no email required)
- Role-based access control (Parent, Child, Family Member)
- Cascading deletes for data integrity
- Row-level security rules in PocketBase

### Documentation

- Comprehensive README with setup instructions
- Quick start guide for 5-minute setup
- Docker deployment guide
- Project architecture documentation
- API documentation with code examples

---

## Version History

- **v1.0.0** - Initial stable release with core features
- **v1.1.0** - UI/UX improvements with comprehensive design system (unreleased)

## Upgrade Notes

### From v1.0.0 to v1.1.0 (Unreleased)

- CSS variables have been introduced - custom styling may need updates
- Button styles have changed - check custom button implementations
- Input borders are now 1px instead of 2px - may affect layout calculations
