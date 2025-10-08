# New Epics Summary - Messaging & Social UX Overhaul

**Created**: 2025-10-07
**Based on**: User feedback and modern chat app UX patterns

---

## 📋 Epic Overview

### Epic 34 Follow-up: UI/UX Fixes
- **Priority**: P1 (User-reported bugs)
- **Effort**: 4-6 hours
- **Status**: Ready to implement

**Fixes**:
1. ✅ Add markdown rendering to posts
2. ✅ Fix emoji picker visual issues
3. ✅ Fix/disable non-functional toolbar buttons

### Epic 40: Username System & User Discovery
- **Priority**: P1 (Foundation)
- **Effort**: 15-20 hours
- **Blocks**: Epic 41, 42

**Delivers**:
- Human-readable usernames (@alice, @bob-organizer)
- Username display everywhere (posts, feed, messages, profiles)
- Username search and autocomplete
- NIP-05 verification (username@domain.com)
- Privacy controls (who can find you)

### Epic 41: Friend System & Contacts Management
- **Priority**: P1
- **Effort**: 10-15 hours
- **Depends on**: Epic 40

**Delivers**:
- Friend requests (send/accept/decline)
- QR code friend add (in-person verification)
- Email/username/link invites
- Contacts management (tags, notes, favorites)
- Trust tiers (stranger → contact → friend → verified)
- Privacy settings per friend

### Epic 42: Messaging UX Overhaul
- **Priority**: P1 (Major UX improvement)
- **Effort**: 25-35 hours
- **Depends on**: Epic 40, 41

**Delivers**:
- **Desktop**: Bottom-anchored chat windows + buddylist sidebar
- **Mobile**: Full-screen chats with swipe gestures
- Conversation-centric model (not group-centric)
- Inline message composition (no modals)
- Flexible chat creation (DMs, group chats, multi-party)
- Online presence indicators
- Multi-window chat support

### Epic 43: Group Entity & Coalition Features
- **Priority**: P2 (Advanced organizing)
- **Effort**: 15-20 hours
- **Depends on**: Epic 42

**Delivers**:
- Groups message as collective identity
- Multi-group coalition chats
- Role-based messaging channels
- "Speak as group" toggle for admins
- Cross-group coordination
- Anonymous member screening (group entity only)

---

## 🎯 Implementation Priority

### Phase 1: Foundation (P1) - 35-42 hours
1. **Epic 34 Follow-up** (4-6h) - Fix user-reported issues
2. **Epic 40: Usernames** (15-20h) - Enable human-readable identity

### Phase 2: Social Graph (P1) - 35-50 hours
3. **Epic 41: Friends** (10-15h) - Build social connections
4. **Epic 42: Messaging UX** (25-35h) - Modernize chat interface

### Phase 3: Advanced (P2) - 15-20 hours
5. **Epic 43: Group Entity** (15-20h) - Collective organizing features

**Total Effort**: 85-112 hours (2-3 weeks full-time)

---

## 📊 Impact Analysis

### User Experience
- ✅ Modern chat UI (Discord/Signal quality)
- ✅ Easy to find and add people
- ✅ Better group coordination
- ✅ Privacy-aware social features

### Organizing Effectiveness
- ✅ Coalition building across groups
- ✅ Anonymous screening of new members
- ✅ Verified contact network
- ✅ Multi-group action coordination

### Technical Improvements
- ✅ Conversation-centric architecture
- ✅ Scalable messaging model
- ✅ NIP-05 identity verification
- ✅ Enhanced privacy controls

---

## 🚀 Next Steps

1. ✅ Review epic specifications with team
2. ✅ Add to NEXT_ROADMAP.md in priority order
3. ✅ Begin Epic 34 Follow-up (quick fixes)
4. ✅ Start Epic 40 (Username System)
5. ✅ Design mockups for desktop chat windows
6. ✅ Test QR code friend add with pilot users

---

## 📁 Epic Documents Created

1. ✅ [UX_MESSAGING_ANALYSIS.md](./UX_MESSAGING_ANALYSIS.md) - Full product analysis
2. ✅ [EPIC_34_FOLLOWUP_FIXES.md](./EPIC_34_FOLLOWUP_FIXES.md) - UI bug fixes
3. ✅ [EPIC_40_USERNAME_SYSTEM.md](./EPIC_40_USERNAME_SYSTEM.md) - Username foundation
4. ✅ [EPIC_41_42_43_MESSAGING_OVERHAUL.md](./EPIC_41_42_43_MESSAGING_OVERHAUL.md) - Messaging redesign

---

## 🎨 Design Inspiration Sources

- **Signal**: Privacy-first messaging, verification system
- **Discord**: Server/channel model, rich presence
- **Telegram**: Username system, bot integration
- **Facebook Messenger** (old desktop): Bottom chat windows, buddylist
- **BitChat**: Decentralized E2E encryption
- **Slack**: Organized channels, workflow integration

---

## ✅ Success Criteria

### Epic 34 Follow-up
- [ ] Markdown renders in posts
- [ ] Emoji picker works correctly
- [ ] No broken toolbar buttons

### Epic 40: Usernames
- [ ] 80%+ users set username in first week
- [ ] @mention usage increases 3x
- [ ] User search queries up 5x

### Epic 41: Friends
- [ ] Friend connections per user: avg 15
- [ ] 80% QR code adoption at events
- [ ] 60% in-person verification rate

### Epic 42: Messaging UX
- [ ] Daily messages sent +40%
- [ ] Time to start chat: <5 seconds
- [ ] User satisfaction: 4.5/5

### Epic 43: Group Entity
- [ ] 50% of groups use entity chat
- [ ] 20% of groups create coalition chats
- [ ] 90% QR-verified member adds

---

**Status**: Ready for roadmap inclusion
**Reviewed by**: Product/UX (pending)
**Approved for development**: [Pending]
