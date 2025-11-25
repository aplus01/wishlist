# SMS Notifications Implementation Plan

**Status:** Planned - Not Yet Implemented
**Estimated Effort:** 6-8 hours
**Monthly Cost:** ~$1.79 (or ~$3.58/year if only active during holiday season)

## Overview

Add SMS notifications to the wishlist app to alert:
- **Parents** when children add items (requiring approval)
- **Family members** when wishlists are ready to shop

## Cost Analysis

### Selected Provider: Twilio

| Item | Cost |
|------|------|
| SMS Messages | $0.0079 per message |
| Phone Number | $1.00/month |
| **100 msgs/month** | **$1.79/month** |

**Seasonal Usage:**
- Active (Nov-Dec): $1.79/month
- Paused (Jan-Oct): $0/month (release phone number)
- **Annual cost: ~$3.58**

### Why Twilio over AWS SNS (Free)?

While AWS SNS offers 100 free messages/month, Twilio is recommended because:
- AWS requires complex Signature v4 authentication (6+ hours extra dev time)
- PocketBase hooks only support basic JavaScript (no crypto libraries)
- Twilio uses simple HTTP Basic Auth
- For $3.58/year, the time savings justify the cost

## Architecture

**Approach:** PocketBase JavaScript Hooks (Server-Side)

```
PocketBase Events
  └── pb_hooks/sms-notifications.pb.js
      ├── onRecordAfterCreateSuccess('items') → Notify parents
      └── onRecordAfterUpdateSuccess('items') → Notify family
          └── Twilio HTTP API
```

**Why server-side hooks?**
- Guaranteed execution (not dependent on client)
- Secure (API keys never exposed to frontend)
- Reliable event triggering
- No separate infrastructure needed

## Implementation Steps

### Phase 1: Database Schema Changes

Add to `users` collection via PocketBase Admin UI (http://127.0.0.1:8090/_/):

1. **phone_number** field:
   - Type: `text`
   - Required: `false`
   - Pattern: `^\+?[1-9]\d{1,14}$` (E.164 format)
   - Min: 10, Max: 15

2. **sms_notifications** field:
   - Type: `bool`
   - Required: `false`
   - Default: `false`

### Phase 2: Twilio Setup

1. **Create Account:**
   - Sign up at https://www.twilio.com/try-twilio
   - Get $15 trial credit (enough for ~1,900 test messages)

2. **Get Phone Number:**
   - Purchase a US local number (~$1/month)
   - Note the phone number in E.164 format (e.g., +12345678900)

3. **Get Credentials:**
   - Account SID (found on dashboard)
   - Auth Token (found on dashboard)

4. **Configure Environment:**
   Create/edit `backend/.env`:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+12345678900
   APP_URL=http://localhost:3000  # Or production URL
   ```

### Phase 3: Backend - PocketBase Hooks

Create `backend/pb_hooks/sms-notifications.pb.js`:

```javascript
/// <reference path="../pb_data/types.d.ts" />

// Notification when child adds item
onRecordAfterCreateSuccess((e) => {
  const record = e.record

  // Only notify for pending items (child-created)
  if (record.get('status') !== 'pending' || !record.get('child')) {
    return
  }

  try {
    // Get child and parent info
    const child = $app.dao().findRecordById('children', record.get('child'))
    const parent = $app.dao().findRecordById('users', child.get('parent'))

    // Check if parent has SMS enabled
    if (!parent.get('phone_number') || !parent.get('sms_notifications')) {
      return
    }

    // Send SMS notification
    const message = `${child.get('name')} added "${record.get('title')}" to their wishlist! Review at ${process.env.APP_URL}/dashboard`
    sendSMS(parent.get('phone_number'), message)

  } catch (err) {
    console.error('Error sending parent notification:', err)
  }

}, 'items')

// Notification when parent approves items
onRecordAfterUpdateSuccess((e) => {
  const record = e.record

  // Check if status changed to approved
  if (record.get('status') !== 'approved' || record.originalCopy().get('status') === 'approved') {
    return
  }

  try {
    // Get all family members with SMS enabled
    const familyMembers = $app.dao().findRecordsByFilter(
      'users',
      'role = "family_member" && sms_notifications = true && phone_number != ""'
    )

    if (familyMembers.length === 0) {
      return
    }

    const child = $app.dao().findRecordById('children', record.get('child'))
    const childRoute = child.get('route')

    // Notify each family member
    familyMembers.forEach((member) => {
      const message = `${child.get('name')}'s wishlist has been updated! View at ${process.env.APP_URL}/${member.get('route')}`
      try {
        sendSMS(member.get('phone_number'), message)
      } catch (err) {
        console.error(`Error sending SMS to ${member.get('name')}:`, err)
      }
    })

  } catch (err) {
    console.error('Error sending family notifications:', err)
  }

}, 'items')

// Helper function to send SMS via Twilio
function sendSMS(phoneNumber, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured')
  }

  // Create Basic Auth header
  const auth = btoa(`${accountSid}:${authToken}`)

  // Send SMS via Twilio API
  const response = $http.send({
    url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `From=${encodeURIComponent(fromNumber)}&To=${encodeURIComponent(phoneNumber)}&Body=${encodeURIComponent(message)}`,
    timeout: 10
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Twilio API error: ${response.statusCode} - ${response.raw}`)
  }

  console.log(`SMS sent to ${phoneNumber}: ${message}`)
  return response
}
```

### Phase 4: Frontend Changes

#### 4.1 Update ManageFamily Component

File: `frontend/src/components/ManageFamily.jsx`

In the family member form (around line 210-260), add phone number fields:

```jsx
<div className='input-group'>
  <label>Phone Number (optional)</label>
  <input
    type="tel"
    value={formData.phone_number || ''}
    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
    placeholder="+12345678900"
    pattern="^\+?[1-9]\d{1,14}$"
  />
  <small>For SMS notifications (include country code, e.g., +1 for US)</small>
</div>

<div className='input-group'>
  <label>
    <input
      type="checkbox"
      checked={formData.sms_notifications || false}
      onChange={(e) => setFormData({...formData, sms_notifications: e.target.checked})}
    />
    Enable SMS notifications
  </label>
</div>
```

Also update the `formData` initialization to include these fields:

```jsx
const [formData, setFormData] = useState({
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  route: '',
  role: 'family_member',
  phone_number: '',
  sms_notifications: false
})
```

When editing existing users, load phone number and SMS preference:

```jsx
const handleEdit = (member) => {
  setFormData({
    email: member.email,
    password: '',
    passwordConfirm: '',
    name: member.name,
    route: member.route,
    role: member.role,
    phone_number: member.phone_number || '',
    sms_notifications: member.sms_notifications || false
  })
  setEditingId(member.id)
  setShowForm(true)
}
```

#### 4.2 Add Parent Settings Page (Optional)

Create `frontend/src/pages/ParentSettings.jsx` to allow parents to manage their phone number:

```jsx
import { useState, useEffect } from 'react'
import pb from '../lib/pocketbase'

export default function ParentSettings() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const user = pb.authStore.model
      setPhoneNumber(user.phone_number || '')
      setSmsNotifications(user.sms_notifications || false)
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      await pb.collection('users').update(pb.authStore.model.id, {
        phone_number: phoneNumber,
        sms_notifications: smsNotifications
      })
      setMessage('Settings saved successfully!')
    } catch (err) {
      setMessage('Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="container">
      <h1>Notification Settings</h1>

      <form onSubmit={handleSave} className="settings-form">
        <div className="input-group">
          <label>Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+12345678900"
            pattern="^\+?[1-9]\d{1,14}$"
          />
          <small>Include country code (e.g., +1 for US)</small>
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              checked={smsNotifications}
              onChange={(e) => setSmsNotifications(e.target.checked)}
            />
            Receive SMS notifications when children add items
          </label>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {message && <p className="message">{message}</p>}
      </form>
    </div>
  )
}
```

Add route in `frontend/src/App.jsx`:

```jsx
import ParentSettings from './pages/ParentSettings'

// In the routes:
<Route path="/settings" element={<ParentSettings />} />
```

### Phase 5: Testing

1. **Test Hook Execution:**
   ```bash
   cd backend
   ./pocketbase serve
   # Watch console for "SMS sent to..." logs
   ```

2. **Test Parent Notification:**
   - Log in as child
   - Add new wishlist item
   - Check parent's phone for SMS

3. **Test Family Notification:**
   - Log in as parent
   - Approve child's item
   - Check family member's phone for SMS

4. **Test Opt-Out:**
   - Disable SMS notifications for a user
   - Verify they don't receive messages

5. **Test Error Handling:**
   - Remove TWILIO_AUTH_TOKEN from .env
   - Try creating item
   - Verify error logged but app continues working

## Notification Examples

### Parent Notification
```
Emma added "LEGO Star Wars Set" to their wishlist! Review at http://localhost:3000/dashboard
```

### Family Notification
```
Emma's wishlist has been updated! View at http://localhost:3000/santa
```

## Seasonal Pause/Resume

### To Pause (After Holiday Season):
1. Log into Twilio console
2. Release phone number → **$0/month**
3. Keep account active (no cost)

### To Resume (Next Holiday Season):
1. Purchase new phone number (~$1/month)
2. Update `TWILIO_PHONE_NUMBER` in `.env`
3. Restart PocketBase

## Security Considerations

✅ **API keys stored server-side** (never exposed to frontend)
✅ **Opt-in required** (users must enable SMS notifications)
✅ **Phone number validation** (E.164 format)
✅ **Error handling** (app continues working if SMS fails)
✅ **Rate limiting** (handled by Twilio)

## Troubleshooting

### SMS Not Sending

1. **Check PocketBase logs:**
   ```bash
   cd backend
   ./pocketbase serve
   # Watch for "SMS sent to..." or error messages
   ```

2. **Verify Twilio credentials:**
   - Check Account SID and Auth Token are correct
   - Ensure phone number is in E.164 format (+12345678900)

3. **Test Twilio directly:**
   ```bash
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
     --data-urlencode "From=+12345678900" \
     --data-urlencode "To=+19876543210" \
     --data-urlencode "Body=Test message" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
   ```

4. **Check phone number format:**
   - Must include country code: +1 for US
   - Example: +12345678900 (not 234-567-8900)

### Hook Not Triggering

1. **Verify pb_hooks directory location:**
   ```
   backend/
     ├── pocketbase
     ├── pb_hooks/
     │   └── sms-notifications.pb.js
     └── pb_data/
   ```

2. **Check JavaScript syntax:**
   - Use ES5 syntax (no arrow functions in function declarations)
   - Use `var` instead of `const`/`let` if issues occur

3. **Restart PocketBase:**
   ```bash
   # Hooks are loaded on startup
   cd backend
   ./pocketbase serve
   ```

## Alternative Providers

If Twilio doesn't work for your needs:

| Provider | Cost | Complexity |
|----------|------|------------|
| **Plivo** | ~$1.05/month | Low-Medium |
| **AWS SNS** | FREE | High (signature v4 auth) |
| **MessageBird** | Varies | Medium |

## Future Enhancements

- [ ] Batch notifications (avoid SMS spam when approving multiple items)
- [ ] Customizable message templates
- [ ] SMS delivery status tracking
- [ ] Support for international phone numbers
- [ ] WhatsApp integration (via Twilio)
- [ ] Test mode (log SMS instead of sending)

## References

- [Twilio SMS API Documentation](https://www.twilio.com/docs/sms)
- [PocketBase JavaScript Hooks](https://pocketbase.io/docs/js-event-hooks/)
- [PocketBase HTTP Requests](https://pocketbase.io/docs/js-sending-http-requests/)
- [E.164 Phone Number Format](https://en.wikipedia.org/wiki/E.164)

---

**Last Updated:** 2025-11-24
**Implementation Status:** Not started
