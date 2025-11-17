# Alternative Verification Testing Notes

## Issues Found & Fixed

### 1. **Email Verification Issue**
**Problem:** Email lookup failed even though record exists in DB

**Root Cause:** Need to verify how email is stored in Payload. The normalization converts to lowercase:
```typescript
normalizeEmail("jacobnpalmer@proton.me") → "jacobnpalmer@proton.me"
```

**Fix Applied:** Added debug logging to see:
- Input email
- Normalized email
- Query result count
- Email in DB (if found)

**Test:** Call with email `jacobnpalmer@proton.me` and check logs for exact email format in DB

---

### 2. **DOB Verification Issue**
**Problem:** No customers found with DOB `2000-12-05`

**Root Cause:** Payload stores `type: 'date'` fields as ISO timestamps (e.g., `"2000-12-05T00:00:00.000Z"`), not plain date strings

**Fix Applied:**
- Get all customers with `dob: { exists: true }`
- Filter in-memory by comparing date parts only:
  ```typescript
  storedDob.split('T')[0] === "2000-12-05"
  ```
- Added logging for each DOB match found

**Test:** Should now match customers even with timezone/timestamp differences

---

### 3. **Redis JSON Parse Error**
**Problem:** 
```
SyntaxError: "[object Object]" is not valid JSON
at JSON.parse (<anonymous>)
```

**Root Cause:** Upstash Redis client auto-deserializes JSON when using `.get()`, but we were calling `JSON.parse()` again

**Fix Applied:**
```typescript
const data = await this.redis.get(key);
if (typeof data === 'object') {
  return data; // Already deserialized
}
return JSON.parse(data); // Fallback for string
```

---

## Test Scenarios

### Scenario 1: Email Verification
```bash
1. Call with wrong phone: "314-325-6906"
2. Agent asks for email
3. Provide: "jacob n palmer at proton dot me"
4. Agent confirms: "jacobnpalmer@proton.me"
5. EXPECTED: Should find customer if email matches DB exactly
```

**Check logs for:**
```
📧 Normalized email: jacobnpalmer@proton.me
📊 Query result: Found 1 customer(s)
   Email in DB: [actual email in database]
```

### Scenario 2: Name + DOB Verification
```bash
1. Provide name: "Jacob Palmer"
2. Provide DOB: "December 5, 2000" → AI should format as "2000-12-05"
3. EXPECTED: Should find customer if DOB matches
```

**Check logs for:**
```
📊 Found X total customers with DOB set
   ✓ DOB match: Jacob Palmer - 2000-12-05
📊 Found 1 customers with matching DOB: 2000-12-05
```

---

## Database Verification Commands

### Check actual email in Payload:
```bash
# Open Payload admin
# Go to Customers collection
# Find customer by name: "Jacob Palmer"
# Verify email field exactly
```

### Check DOB format:
```bash
# In Payload admin, check DOB field
# Note: Should show date picker
# Internal format: ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
```

---

## Security Notes

### Email Matching
- ✅ **EXACT match only** (no fuzzy matching)
- ✅ **Case-insensitive** (normalized to lowercase)
- ✅ **Whitespace trimmed**
- ❌ **No typo tolerance** (security requirement)

### Name + DOB Matching
- ✅ **DOB must be exact** (date part only, ignores time)
- ✅ **Name similarity ≥90%** (handles "Jon"→"John" but not "John"→"Jane")
- ✅ **Explicit confirmation required** after match

### Escalation Path
```
Phone fails → Email fails → Name+DOB fails → Escalate to human
```

No more than 2-3 attempts per method before escalation.
