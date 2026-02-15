# Epic 89: Website Downloads & Releases Page

## Goal
Add a downloads/releases page to the public SSR website so visitors can download the latest BuildIt desktop and mobile apps.

## Tasks

### 1. Create `/downloads` route
- New page at `workers/ssr/src/routes/downloads.tsx`
- Show available platforms: Linux (AppImage, .deb), Android (APK)
- Link to GitHub Releases for actual download files
- Show app version (fetched from GitHub releases API or hardcoded)
- Include platform-specific install instructions

### 2. Add app screenshots/feature previews
- Create a visual showcase of the app's key features
- Use placeholder screenshots or describe the app's capabilities
- Sections: Messaging, Groups, Events, Governance, Privacy

### 3. Update navigation
- Add "Downloads" link to header nav in `PublicHeader.tsx`
- Add to footer in `PublicFooter.tsx`

### 4. SEO
- Add proper meta tags, Open Graph, description for the downloads page

## Acceptance Criteria
- `/downloads` page renders with platform cards
- Links point to GitHub Releases
- Navigation updated with Downloads link
- Page has proper SEO meta tags
