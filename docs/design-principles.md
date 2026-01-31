# BuildIt Design Principles

**Version**: 1.0.0
**Last Updated**: 2026-01-31
**Applies to**: Web/Desktop (React + Tailwind), iOS (SwiftUI), Android (Jetpack Compose)

This document is the canonical cross-platform design reference for BuildIt. All platforms must adhere to these principles regardless of their native toolkit.

---

## Core Values

Every design decision flows from these five values, listed in priority order:

1. **Privacy-first** -- End-to-end encryption, zero-knowledge architecture, and minimal data exposure are non-negotiable. The UI must reinforce, never undermine, user safety.
2. **Offline-capable** -- Local-first data storage means the app must always render useful content. Network availability is a bonus, not a requirement.
3. **Activist-focused** -- Real-world organizing under pressure demands fast access to critical features. Every tap and keystroke matters.
4. **Accessible** -- WCAG 2.1 AA compliance across all platforms. Internationalized. Usable by everyone regardless of ability, device, or language.
5. **Mobile-first** -- Design for the smallest screen first, then enhance for larger viewports. Phones are the primary organizing tool.

---

## Design Foundations

### Mobile-First Progression

Design for the phone viewport first, then scale up. This is not just a CSS strategy -- it applies to information architecture, interaction design, and feature scoping.

- Start with a single-column layout and essential content.
- Add supplementary panels, sidebars, and richer controls at larger breakpoints.
- Never require a desktop to complete any core workflow.

### Offline and Local-First

- Always render locally cached data immediately. Never show an empty screen while waiting for a network response.
- Use optimistic updates for user actions (writes succeed locally and sync later).
- Display a clear but non-intrusive offline indicator when the network is unavailable.
- Queue outgoing actions and resolve conflicts on reconnect without user intervention when possible.

### Privacy-Aware UI

- Minimize displayed sensitive data by default. Use progressive disclosure to reveal details on demand.
- Show encryption indicators (lock icons, shield badges) on all encrypted content so users can verify protection at a glance.
- Provide visibility toggles (public, group, private) with sensible defaults that favor privacy.
- Default to the most private option for each content type. Users opt into broader visibility, never the reverse.
- Never cache decrypted sensitive content to disk unless explicitly protected by the platform keychain.

---

## Navigation

### Platform Patterns

| Viewport | Primary Navigation | Secondary Navigation |
|----------|-------------------|---------------------|
| Phone | Bottom tab bar (max 5 items) | In-page tabs, pull-to-navigate |
| Tablet | Bottom tab bar or sidebar (orientation-dependent) | Split-view panels |
| Desktop | Persistent left sidebar | Breadcrumbs, module switcher |

### Principles

- The current location must always be obvious. Use active-state indicators on nav items and breadcrumbs for nested views.
- Module switching (Events, Governance, Mutual Aid, etc.) uses the same navigation region on every platform.
- Back navigation must be predictable: system back button on Android, swipe-back on iOS, breadcrumb trail on desktop.
- Deep links must resolve to the correct screen with full navigation context intact.

---

## Layout and Spacing

- Use an 8px base grid for all spacing and sizing. Margins, padding, and component dimensions should be multiples of 8.
- Maintain consistent content insets: 16px horizontal padding on mobile, 24px on tablet, 32px on desktop.
- Group related elements with proximity; separate unrelated groups with whitespace, not dividers, where possible.
- Limit content width to a readable measure (roughly 65-75 characters for body text) on wide screens.

---

## Typography

- Use a single type scale across the app with clearly differentiated heading levels (h1 through h4 maximum).
- Body text must be at least 16px (1rem) on mobile to ensure legibility without zooming.
- Maintain a minimum line height of 1.5 for body text and 1.2 for headings.
- Use font weight and size -- not color alone -- to establish visual hierarchy.
- Support dynamic type / user font-size preferences on all platforms.

---

## Color and Theming

- Support both light and dark modes. Respect the system preference by default; allow manual override.
- Ensure a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (WCAG AA).
- Do not use color as the sole indicator of state. Pair color with icons, text labels, or patterns.
- Define a semantic color palette (success, warning, error, info, muted) that maps correctly in both themes.
- Encryption and privacy indicators use a consistent, recognizable color (e.g., a distinct "secure" accent) across all platforms.

---

## Interactive Elements

### Touch and Click Targets

- Minimum interactive target size: 44x44px on touch devices, 32x32px on pointer devices.
- Maintain at least 8px spacing between adjacent interactive targets to prevent mis-taps.
- Optimize for the thumb zone on mobile: place primary actions in the lower two-thirds of the screen.

### Buttons and Actions

- Primary actions use a filled, high-contrast button. One primary action per screen region.
- Destructive actions require explicit confirmation. Use a two-step pattern (tap, then confirm) or a dialog.
- Disabled buttons remain visible but visually muted, with a tooltip or label explaining why they are disabled.

### Forms

- Validate inline as the user completes each field. Show errors adjacent to the relevant input, not in a banner.
- Mark required fields clearly (asterisk or explicit label). Do not rely on placeholder text as the sole label.
- Provide distinct visual states: default, focused, filled, error, disabled.
- Submit buttons reflect loading state (spinner or progress) and disable to prevent double submission.

---

## Accessibility

All platforms must meet WCAG 2.1 AA. These are hard requirements, not aspirational goals.

### Structure

- Use semantic elements (headings, landmarks, lists) so assistive technology can parse the page structure.
- Maintain a logical heading order (h1, h2, h3) with no skipped levels.
- Provide skip links on web/desktop to jump past navigation to main content.

### Keyboard and Focus

- Every interactive element must be reachable via keyboard (Tab, Shift+Tab).
- Focus indicators must be visible on all interactive elements. Never remove the focus ring without providing an equivalent.
- Support standard keyboard shortcuts: Enter to activate, Escape to dismiss dialogs and popovers, Arrow keys for lists and menus.

### Screen Readers

- All images have descriptive alt text. Decorative images use an empty alt attribute.
- Icon-only buttons have an accessible label (aria-label on web, accessibilityLabel on native).
- Dynamic content changes are announced via live regions (aria-live on web, accessibility announcements on native).
- Error messages are programmatically associated with their inputs.

### Motion and Animation

- Respect the "reduce motion" system preference. Replace animations with instant state changes when this preference is active.
- Keep transitions under 300ms. Avoid animations that are purely decorative and add no informational value.

---

## Loading and Error States

### Loading

- Use skeleton screens for initial content loads. Skeletons mirror the layout of the expected content.
- Use inline spinners for discrete actions (submitting a form, loading a single component).
- Never block the entire screen with a full-page spinner. The user should always be able to navigate away.

### Errors

- Provide actionable error messages: explain what went wrong and what the user can do about it.
- Offer retry affordances for transient failures (network errors, sync conflicts).
- Degrade gracefully. If a module fails to load, the rest of the app continues to function.

### Empty States

- When a list or view has no content, show a helpful message and a clear call to action (e.g., "No events yet. Create one.").
- Distinguish between "no data exists" and "data is loading" with distinct visual treatments.

---

## Privacy UI Patterns

These patterns are specific to BuildIt's activist user base and threat model.

### Engagement Ladder

- New users start with minimal data exposure. As trust builds, the UI progressively reveals more powerful (and more sensitive) features.
- First-time flows emphasize privacy controls and explain what is encrypted versus visible.

### Progressive Disclosure

- Default views show only essential information. Details expand on tap or click.
- Sensitive metadata (timestamps, participant lists, location data) is hidden behind an explicit "show details" action.

### Smart Privacy Defaults

- Direct messages: encrypted, private, no relay metadata leakage.
- Group posts: visible to group members only, encrypted at rest.
- Public content: requires explicit opt-in with a clear warning about visibility.
- Each module defines its own sensible default privacy level appropriate to its content type.

### Context-Aware Indicators

- Show the current privacy context (which group, which visibility level) persistently in the UI so the user always knows who can see what.
- When switching between groups or contexts, provide a clear visual transition to prevent accidental cross-posting.

---

## Responsive Breakpoints

Use these breakpoints consistently across all platforms that support responsive layouts:

| Name | Min Width | Typical Devices |
|------|-----------|-----------------|
| sm | 0px | Phones (portrait) |
| md | 768px | Tablets, large phones (landscape) |
| lg | 1024px | Small laptops, tablets (landscape) |
| xl | 1280px | Desktops, large laptops |

Native platforms (iOS, Android) should use equivalent size-class or window-size APIs to achieve the same adaptive behavior.

---

## Iconography and Visual Language

- Use a single, consistent icon set across all platforms. Prefer outlined icons at default weight; use filled variants for active/selected states.
- Icons must always be paired with a text label in navigation. Icon-only buttons are acceptable only for universally understood actions (close, back, search) and must have accessible labels.
- Use established conventions for privacy and security indicators: a lock for encryption, a shield for verified identity, an eye-slash for hidden content.

---

## Platform-Specific Allowances

While the principles above are universal, each platform may adapt implementation details to feel native:

- **iOS**: Use standard iOS patterns for swipe actions, haptic feedback, and modal presentation styles.
- **Android**: Follow Material Design conventions for FABs, snackbars, and bottom sheets where they align with these principles.
- **Web/Desktop**: Use standard web patterns for hover states, right-click context menus, and keyboard shortcuts.

Platform-native conventions take precedence over cross-platform uniformity only when they do not conflict with the accessibility, privacy, or information architecture principles defined above.

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [BuildIt Security Architecture](./SECURITY.md)
- [BuildIt Threat Model](./THREAT_MODEL.md)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)
