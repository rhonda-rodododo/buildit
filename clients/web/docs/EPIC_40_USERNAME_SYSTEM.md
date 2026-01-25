# Epic 40: Username System & User Discovery

**Priority**: P1 (Foundation for social features)
**Effort**: 15-20 hours
**Dependencies**: Epic 34 complete
**Assignable to subagent**: Yes (`feature-implementer`)

---

## 📋 Context

Users currently identified only by pubkeys (npub1xxx... or hex). This is cryptographically secure but poor UX:
- Hard to remember who is who
- Can't easily find/add people
- No human-readable identity in feeds/posts

Modern chat apps (Signal, Telegram, Discord) all use usernames. We need the same for BuildIt Network while maintaining privacy controls.

**Key Design Principles**:
1. **Optional** - High-security users can remain pubkey-only
2. **Privacy-aware** - Granular controls on discoverability
3. **Decentralized** - Username registry via Nostr (NIP-05)
4. **Conflict-resilient** - Handle username collisions across relays

---

## 🎯 Goals

1. ✅ Human-readable usernames (@alice, @bob-organizer)
2. ✅ Username display in all social contexts (posts, feed, messages, profiles)
3. ✅ Username search and autocomplete
4. ✅ NIP-05 verification (username@domain.com)
5. ✅ Privacy controls (who can find you by username)
6. ✅ Migration path for existing users

---

## ✅ Tasks

### Task 1: Username Schema & Storage (3-4h)
- [ ] Create Username schema in database:
  ```typescript
  interface DBUsername {
    pubkey: string;           // User's nostr pubkey
    username: string;         // Unique handle (e.g., "alice-organizer")
    displayName?: string;     // Human name (e.g., "Alice Martinez")
    nip05?: string;          // Verified identifier (alice@domain.com)
    nip05Verified: boolean;  // Verification status
    createdAt: number;
    updatedAt: number;
  }

  interface UsernameSettings {
    pubkey: string;
    allowUsernameSearch: boolean;        // Can be found by username
    allowEmailDiscovery: boolean;        // Can be found by email
    visibleTo: 'public' | 'friends' | 'groups' | 'none';
    showInDirectory: boolean;            // Appear in user directory
  }
  ```

- [ ] Add username fields to Identity schema
- [ ] Create indexes for fast username lookup
- [ ] Implement username validation:
  - 3-20 characters
  - Alphanumeric + hyphens only
  - No offensive/reserved words
  - Unique per relay

### Task 2: Username Registration & Management (4-5h)
- [ ] Create UsernameSettings component:
  - Choose username field
  - Real-time availability check
  - Display name field
  - NIP-05 verification input
  - Privacy controls (toggles)
- [ ] Implement username claim flow:
  - Check availability across relays
  - Reserve username (kind:0 metadata update)
  - Update local database
  - Broadcast to relays
- [ ] Add username change functionality:
  - Confirm identity (password/biometric)
  - Release old username
  - Claim new username
  - Update all references
- [ ] Create NIP-05 verification flow:
  - Input domain/.well-known URL
  - Verify DNS TXT record
  - Display verification badge

### Task 3: Username Display & UX (3-4h)
- [ ] Update all components to show username:
  - PostCard: Show @username instead of pubkey
  - ActivityFeed: Display @username on posts
  - Comments: Author as @username
  - User profile cards
  - Message threads
  - Member lists
- [ ] Create UserHandle component:
  ```tsx
  <UserHandle
    pubkey={pubkey}
    showAvatar={true}
    showBadge={true}  // NIP-05 verified badge
    format="@username" | "display-name" | "full"
  />
  ```
- [ ] Add username hover cards:
  - Quick profile preview
  - Follow button
  - Message button
  - View profile link

### Task 4: Username Search & Autocomplete (3-4h)
- [ ] Create UsernameSearch component:
  - Search input with debounce
  - Fuzzy matching
  - Filter by verification status
  - Respect privacy settings
- [ ] Implement autocomplete for @mentions:
  - Trigger on @ character
  - Show dropdown of matching users
  - Insert @username on select
  - Link to profile on click
- [ ] Create UserDirectory page:
  - Browse all discoverable users
  - Filter by group, verified, online
  - Sort by name, join date, activity
  - Pagination
- [ ] Add username to message compose:
  - "To:" field with autocomplete
  - Show matching users as you type
  - Respect privacy (only show allowed users)

### Task 5: Privacy & Security (2-3h)
- [ ] Implement privacy controls:
  - Allow username search (yes/no)
  - Visible to (public/friends/groups/none)
  - Show in directory (yes/no)
  - Allow email discovery (yes/no)
- [ ] Add username enumeration protection:
  - Rate limit username searches
  - Obfuscate "user not found" responses
  - Log suspicious search patterns
- [ ] Create reserved username list:
  - admin, moderator, system, support, etc.
  - Prevent impersonation
- [ ] Implement username migration:
  - Prompt existing users to set username
  - Graceful degradation (show pubkey if no username)
  - Background sync of usernames from relays

---

## 🧪 Acceptance Criteria

- [ ] Users can set unique usernames
- [ ] Username displays in posts, feed, comments, messages, profiles
- [ ] Can search for users by username (with privacy controls)
- [ ] @mention autocomplete works in posts and comments
- [ ] NIP-05 verification working with badge display
- [ ] Privacy controls functional (who can find you)
- [ ] Username conflicts handled gracefully
- [ ] Existing users can migrate to usernames
- [ ] All tests passing

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] Username validation (format, length, reserved words)
- [ ] Username uniqueness check
- [ ] Privacy filter logic
- [ ] NIP-05 verification

### Integration Tests
- [ ] Username claim flow end-to-end
- [ ] Search respects privacy settings
- [ ] @mention autocomplete
- [ ] Username display in all contexts

### Manual Testing
- [ ] Set username → Appears everywhere
- [ ] Search for user by username
- [ ] @mention someone in post → Links to profile
- [ ] Verify NIP-05 → Badge appears
- [ ] Change privacy → Search results update
- [ ] Try to claim taken username → Error message

---

## 📚 Reference Docs

- **NIP-05**: Nostr DNS-based verification
- **NIP-02**: Contact lists (for friends/followers)
- `/src/stores/authStore.ts` - Identity management
- `/src/components/social/` - Social components
- [UX_MESSAGING_ANALYSIS.md](./UX_MESSAGING_ANALYSIS.md) - Full product analysis

---

## 🏷️ Git Commit Format

```
feat: implement username system with NIP-05 verification (Epic 40)
```

---

## 🏷️ Git Tag

```
v0.40.0-usernames
```

---

## 📊 Success Metrics

- 80%+ of users set a username within first week
- 60%+ of users enable username search
- 30%+ of users complete NIP-05 verification
- @mention usage increases 3x
- User search queries up 5x
- Friend connections up 2x (easier to find people)

---

## 🔗 Dependencies

**Blocks**:
- Epic 41: Friend System (needs username search)
- Epic 42: Messaging UX Overhaul (needs username display)

**Blocked by**: None (can start immediately)

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Username conflicts across relays | Medium | First-come-first-served per relay, show relay in UI |
| Privacy leaks via username enumeration | High | Rate limiting, privacy controls, obfuscated responses |
| Users want to change username often | Low | Allow changes but log history, show "formerly @oldname" |
| Offensive usernames | Medium | Reserved word list, report/ban system |
| NIP-05 verification complexity | Low | Make optional, provide clear instructions |

---

**Status**: Ready for implementation
**Created**: 2025-10-07
