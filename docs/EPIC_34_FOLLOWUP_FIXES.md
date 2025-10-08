# Epic 34 Follow-up: UI/UX Fixes

**Created**: 2025-10-07
**Context**: Issues identified after Epic 34 completion

---

## 🐛 Issues to Fix

### 1. Markdown Rendering in Posts
**Problem**: Microblog posts don't render markdown - just show raw text
**Impact**: Users can't use formatting in posts (bold, italic, links, lists, etc.)
**Fix**: Add markdown renderer to PostCard component

### 2. Emoji Picker Visual Issues
**Problem**: Emoji picker not displaying correctly in PostComposer
**Impact**: Hard to select emojis, poor UX
**Fix**: Review EmojiPicker component styling and positioning

### 3. Post Composer Toolbar Buttons
**Problem**: Toolbar buttons (image, video, location, etc.) not functioning correctly
**Impact**: Can't attach media or use advanced features
**Fix**: Implement or disable non-functional buttons

---

## ✅ Tasks

### Task 1: Add Markdown Rendering (1-2h)
- [ ] Install markdown renderer (react-markdown or similar)
- [ ] Update PostCard to render markdown in post content:
  ```tsx
  import ReactMarkdown from 'react-markdown';

  // In PostCard component:
  <ReactMarkdown
    className="prose prose-sm dark:prose-invert"
    components={{
      // Customize link rendering for security
      a: ({href, children}) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    }}
  >
    {post.content}
  </ReactMarkdown>
  ```
- [ ] Add CSS for markdown styling (prose classes)
- [ ] Sanitize markdown to prevent XSS
- [ ] Test with various markdown syntax (links, bold, lists, code blocks)

### Task 2: Fix Emoji Picker (1h)
- [ ] Review EmojiPicker component in PostComposer
- [ ] Fix positioning/z-index issues
- [ ] Ensure proper click-outside behavior
- [ ] Test emoji insertion at cursor position
- [ ] Verify mobile responsiveness

### Task 3: Fix Toolbar Buttons (2-3h)
Options:
1. **Disable non-functional buttons** (Quick fix)
   - Remove or disable image/video/location/calendar/document buttons
   - Keep only emoji and text input
   - Add TODO comments for future implementation

2. **Implement basic functionality** (Better UX)
   - Image upload: Basic file picker → Base64 embed
   - Link preview: Detect URLs → Fetch metadata
   - Location: Text input (not geolocation)
   - Others: Disable for now

Choose approach based on time/priority.

---

## 🧪 Testing

- [ ] Test markdown rendering with various syntax
- [ ] Test emoji picker on desktop and mobile
- [ ] Test all toolbar buttons (working or disabled)
- [ ] Verify no console errors
- [ ] Check for XSS vulnerabilities in markdown

---

## 📝 Implementation Notes

**Markdown Security**:
- Use `rehype-sanitize` to prevent XSS
- Disable HTML in markdown
- Open external links in new tab with `rel="noopener noreferrer"`

**Emoji Picker**:
- Likely issue: z-index conflict or portal rendering
- Check if EmojiPicker needs to render in a Portal

**Toolbar Buttons**:
- If implementing image upload, use FileManager module
- If implementing location, just text input for now (no GPS)
- Calendar button could create event (link to events module)

---

## Git Commit

```bash
fix: add markdown rendering and fix post composer UI (Epic 34 follow-up)

- Add react-markdown to PostCard for formatted posts
- Fix emoji picker positioning and styling
- Disable non-functional toolbar buttons with TODO comments
- Sanitize markdown to prevent XSS
```

---

**Priority**: P1 (User-reported issues)
**Effort**: 4-6 hours
**Assignable**: Yes
