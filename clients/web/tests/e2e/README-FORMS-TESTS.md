# Forms & Fundraising E2E Test Suite

Comprehensive end-to-end tests for the Forms & Fundraising module (Epic 37).

## Test Files

### 1. `helpers/forms-helpers.ts`
Reusable helper functions for Forms & Fundraising E2E tests:
- **Form Builder**: `createForm`, `addFieldToForm`, `editFieldProperties`, `addConditionalLogic`, `publishForm`
- **Form Submissions**: `navigateToPublicForm`, `submitForm`, `navigateToSubmissions`, `filterSubmissions`, `markAsSpam`
- **Campaigns**: `createCampaign`, `addDonationTier`, `publishCampaign`, `makeDonation`, `postCampaignUpdate`
- **Public Pages**: `createPublicPage`, `configureSEO`, `publishPublicPage`, `navigateToPublishedPage`
- **Analytics**: `navigateToFormAnalytics`, `getAnalyticsMetrics`
- **Common**: `createAndLoginIdentity`, `createGroup`, `waitForAndVerify`

### 2. `forms-builder.spec.ts` (8 tests)
Tests the complete form builder workflow:
- ✅ Create form with drag-and-drop fields
- ✅ Create form from template (Event Registration)
- ✅ Add conditional logic (show/hide fields based on conditions)
- ✅ Validate form fields (required, email format)
- ✅ Create multi-page forms with navigation
- ✅ Reorder fields via drag-and-drop
- ✅ Delete fields from form
- ✅ Configure form settings (confirmation message, submission limits)

**Key Features Tested**:
- Field types: text, email, textarea, phone, checkbox, select, etc.
- Field editor with label, placeholder, required, helpText
- Conditional logic editor
- Multi-page navigation
- Form preview mode
- Draft/publish workflow

### 3. `forms-submission.spec.ts` (9 tests)
Tests public form submission and admin management:
- ✅ Submit form publicly without login
- ✅ Trigger anti-spam honeypot (silent rejection)
- ✅ Enforce submission limits (max submissions)
- ✅ Filter and search submissions (all, unprocessed, processed, spam)
- ✅ Flag submissions as spam
- ✅ Export submissions to CSV
- ✅ Display form analytics (views, submissions, conversion rate)
- ✅ Handle rate limiting (max submissions per minute)
- ✅ Send auto-response email on submission

**Key Features Tested**:
- Public form rendering (no login required)
- Form submission workflow
- Admin panel submission management
- Spam detection and filtering
- CSV export functionality
- Privacy-preserving analytics
- Rate limiting and anti-spam measures
- Email notifications

### 4. `fundraising-campaigns.spec.ts` (10 tests)
Tests fundraising campaign creation and donation flow:
- ✅ Create fundraising campaign with tiers
- ✅ Make a donation and verify on donor wall
- ✅ Create campaign from template (Strike Fund)
- ✅ Post campaign update
- ✅ Reach fundraising goal (100% progress)
- ✅ Handle limited donation tiers (sold out)
- ✅ Make anonymous donation
- ✅ Handle recurring donations (monthly, quarterly)
- ✅ Configure campaign end date and auto-close
- ✅ Show campaign progress with multiple donations

**Key Features Tested**:
- Campaign builder with tiers
- Donation tiers (basic, limited, featured)
- Donor wall display
- Campaign updates
- Goal tracking and progress bar
- Anonymous donations
- Recurring donation support
- Campaign templates (Strike Fund, Bail Fund)
- Multiple payment processors (mock)

### 5. `public-pages.spec.ts` (11 tests)
Tests public page creation and SEO controls:
- ✅ Create public page with SEO metadata
- ✅ Validate SEO controls (title character count, description limit)
- ✅ Create landing page with rich content (Markdown)
- ✅ Create events calendar public view
- ✅ Create contact page with embedded form
- ✅ Support custom domain configuration (CNAME)
- ✅ Generate sitemap.xml
- ✅ Support privacy-respecting analytics (no personal data)
- ✅ Preview page before publishing
- ✅ Unpublish and archive pages
- ✅ Validate slug uniqueness

**Key Features Tested**:
- Rich text editor for content
- SEO metadata (title, description, keywords)
- Open Graph tags (Facebook, LinkedIn)
- Twitter Card tags
- Schema.org JSON-LD structured data
- robots.txt (noindex/nofollow)
- Custom domain support
- Sitemap generation
- Privacy-preserving analytics
- Draft/publish workflow
- Slug validation

### 6. `forms-accessibility.spec.ts` (13 tests)
Tests accessibility and WCAG 2.1 AA compliance:
- ✅ Navigate form builder with keyboard only
- ✅ Submit form with keyboard only
- ✅ Proper ARIA labels and roles
- ✅ WCAG 2.1 AA compliance for form builder (axe audit)
- ✅ WCAG 2.1 AA compliance for public form (axe audit)
- ✅ WCAG 2.1 AA compliance for campaign page (axe audit)
- ✅ Sufficient color contrast (no violations)
- ✅ Visible focus indicators
- ✅ Screen reader navigation support
- ✅ Skip links for keyboard users
- ✅ Announce dynamic content changes to screen readers
- ✅ Support high contrast mode
- ✅ Support text resizing up to 200%

**Key Features Tested**:
- Keyboard navigation (Tab, Arrow keys, Enter)
- ARIA labels (aria-labelledby, aria-describedby, aria-required)
- Semantic HTML (form, main, headings)
- Focus indicators (outline, box-shadow)
- Color contrast (WCAG AA minimum 4.5:1)
- Screen reader announcements (role="alert", aria-live)
- Skip to main content links
- High contrast mode support
- Text resizing without horizontal scroll
- axe-core accessibility audits

## Test Coverage Summary

**Total Tests**: 51 E2E tests across 5 test files

### Coverage by Feature:
1. **Form Builder**: 8 tests
2. **Form Submissions**: 9 tests
3. **Fundraising Campaigns**: 10 tests
4. **Public Pages**: 11 tests
5. **Accessibility**: 13 tests

### Coverage by Epic 37 Task:
- ✅ **Epic 37.1: Form Builder** - Full coverage (8 tests)
- ✅ **Epic 37.2: Fundraising Pages** - Full coverage (10 tests)
- ✅ **Epic 37.3: Public Pages CMS** - Full coverage (11 tests)
- ✅ **Accessibility & WCAG 2.1 AA** - Full coverage (13 tests)

## Running the Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run specific test file
bun run test:e2e tests/e2e/forms-builder.spec.ts

# Run specific test suite
bun run test:e2e --grep "Form Builder"

# Run in headed mode (visible browser)
bun run test:e2e --headed

# Run with Playwright UI
bun run test:e2e --ui

# Run only on chromium
bun run test:e2e --project=chromium

# Debug a specific test
bun run test:e2e --debug tests/e2e/forms-builder.spec.ts
```

## Test Data Setup

All tests use isolated browser contexts to prevent data leakage:
- Each test creates its own identity and group
- Tests use unique group names to avoid conflicts
- Cleanup happens automatically via context disposal

## Dependencies

- **@playwright/test**: E2E testing framework
- **@axe-core/playwright**: Accessibility auditing
- **Playwright browsers**: Chromium, Firefox, WebKit

## Best Practices Used

1. **Page Object Pattern**: Helper functions encapsulate common operations
2. **Isolated Contexts**: Each test runs in isolated browser context
3. **Meaningful Assertions**: Specific, clear expectations
4. **Accessibility First**: WCAG 2.1 AA compliance verified with axe-core
5. **Real User Workflows**: Tests simulate actual user interactions
6. **Visual Verification**: Screenshots on failure for debugging
7. **Timeout Handling**: Proper waits for async operations
8. **Error Messages**: Descriptive test names and assertions

## Known Limitations

1. **Payment Processing**: Uses mock payment flow (no real Stripe/PayPal integration)
2. **Email Sending**: Email notifications not actually sent (would require SMTP server)
3. **File Uploads**: File upload testing limited (no actual file I/O)
4. **Network Latency**: Local tests don't simulate real network conditions
5. **Forms Module Implementation**: Tests assume Forms module is fully implemented

## Future Enhancements

1. Add visual regression testing (Percy, Chromatic)
2. Add cross-browser compatibility tests (Safari, Edge)
3. Add mobile responsiveness tests (viewport sizes)
4. Add performance testing (Lighthouse, Web Vitals)
5. Add API testing (form submission endpoints)
6. Add internationalization testing (multiple languages)
7. Add real payment integration tests (Stripe test mode)

## CI/CD Integration

These tests can be run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install Playwright browsers
  run: bunx playwright install --with-deps

- name: Run E2E tests
  run: bun run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Debugging Failed Tests

1. **View Screenshots**: Check `test-results/` directory for failure screenshots
2. **View Videos**: Enable video recording in `playwright.config.ts`
3. **View Traces**: Use `--trace on` to capture detailed traces
4. **Use Playwright Inspector**: Run with `--debug` flag
5. **Check Logs**: Console logs captured in test output

## Contact

For questions or issues with these tests, refer to:
- [NEXT_ROADMAP.md](../../NEXT_ROADMAP.md) - Epic 37 specifications
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
- [tests/e2e/collaborative-editing.spec.ts](./collaborative-editing.spec.ts) - Example reference tests
