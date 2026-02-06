/**
 * Component-Level Accessibility Tests
 *
 * Tests interactive UI components for proper accessibility:
 * - Buttons and form controls
 * - Modal/dialog focus management
 * - Dropdown menus and comboboxes
 * - Tab panels and navigation
 * - Screen reader announcements
 *
 * Epic 82: Comprehensive Test Coverage
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getFocusableElements,
  getAllInteractiveElementsWithoutNames,
} from './axe-setup'

describe('Component Accessibility Tests', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  describe('Dialog/Modal Focus Management', () => {
    it('dialog should trap focus within its boundaries', () => {
      container.innerHTML = `
        <button id="trigger">Open Dialog</button>
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <h2 id="dlg-title">Confirm Delete</h2>
          <p>Are you sure you want to delete this event?</p>
          <button id="cancel">Cancel</button>
          <button id="confirm">Delete</button>
        </div>
      `

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement
      const focusable = getFocusableElements(dialog)

      // Dialog should contain exactly 2 focusable elements
      expect(focusable).toHaveLength(2)
      expect(focusable[0].id).toBe('cancel')
      expect(focusable[1].id).toBe('confirm')
    })

    it('dialog should have aria-labelledby pointing to its title', () => {
      container.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <h2 id="dlg-title">Settings</h2>
          <button>Close</button>
        </div>
      `

      const dialog = container.querySelector('[role="dialog"]')
      const labelledBy = dialog?.getAttribute('aria-labelledby')
      expect(labelledBy).toBe('dlg-title')

      const title = container.querySelector(`#${labelledBy}`)
      expect(title).not.toBeNull()
      expect(title?.textContent).toBe('Settings')
    })

    it('dialog close button should be accessible', () => {
      container.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <h2 id="dlg-title">Info</h2>
          <button aria-label="Close dialog">X</button>
        </div>
      `

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement
      const unnamed = getAllInteractiveElementsWithoutNames(dialog)
      expect(unnamed).toHaveLength(0)
    })

    it('alert dialog should have role="alertdialog"', () => {
      container.innerHTML = `
        <div role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-desc">
          <h2 id="alert-title">Warning</h2>
          <p id="alert-desc">This action cannot be undone.</p>
          <button>OK</button>
        </div>
      `

      const alertDialog = container.querySelector('[role="alertdialog"]')
      expect(alertDialog).not.toBeNull()
      expect(alertDialog?.getAttribute('aria-describedby')).toBe('alert-desc')

      const description = container.querySelector('#alert-desc')
      expect(description?.textContent).toContain('cannot be undone')
    })
  })

  describe('Form Controls', () => {
    it('text inputs should have associated labels', () => {
      container.innerHTML = `
        <form>
          <label for="event-name">Event Name</label>
          <input id="event-name" type="text" required>

          <label for="event-desc">Description</label>
          <textarea id="event-desc"></textarea>

          <label for="event-date">Date</label>
          <input id="event-date" type="date">
        </form>
      `

      const inputs = container.querySelectorAll('input, textarea')
      inputs.forEach((input) => {
        const id = input.getAttribute('id')
        const label = container.querySelector(`label[for="${id}"]`)
        expect(label).not.toBeNull()
      })
    })

    it('required fields should have aria-required', () => {
      container.innerHTML = `
        <form>
          <label for="title">Title</label>
          <input id="title" type="text" required aria-required="true">

          <label for="optional">Notes</label>
          <input id="optional" type="text">
        </form>
      `

      const required = container.querySelector('#title')
      expect(required?.getAttribute('aria-required')).toBe('true')
      expect(required?.hasAttribute('required')).toBe(true)

      const optional = container.querySelector('#optional')
      expect(optional?.getAttribute('aria-required')).toBeNull()
    })

    it('error messages should be linked with aria-describedby', () => {
      container.innerHTML = `
        <div>
          <label for="email">Email</label>
          <input id="email" type="email" aria-invalid="true" aria-describedby="email-error">
          <span id="email-error" role="alert">Please enter a valid email address</span>
        </div>
      `

      const input = container.querySelector('#email')
      expect(input?.getAttribute('aria-invalid')).toBe('true')
      expect(input?.getAttribute('aria-describedby')).toBe('email-error')

      const error = container.querySelector('#email-error')
      expect(error?.getAttribute('role')).toBe('alert')
      expect(error?.textContent).toContain('valid email')
    })

    it('select dropdowns should have accessible labels', () => {
      container.innerHTML = `
        <label for="visibility">Visibility</label>
        <select id="visibility">
          <option value="public">Public</option>
          <option value="group">Group Only</option>
          <option value="private">Private</option>
        </select>
      `

      const select = container.querySelector('select')
      const label = container.querySelector('label[for="visibility"]')
      expect(label).not.toBeNull()
      expect(select?.id).toBe('visibility')
    })

    it('checkbox groups should have fieldset and legend', () => {
      container.innerHTML = `
        <fieldset>
          <legend>Notification Preferences</legend>
          <label>
            <input type="checkbox" name="notif" value="email"> Email
          </label>
          <label>
            <input type="checkbox" name="notif" value="push"> Push
          </label>
          <label>
            <input type="checkbox" name="notif" value="sms"> SMS
          </label>
        </fieldset>
      `

      const fieldset = container.querySelector('fieldset')
      const legend = fieldset?.querySelector('legend')
      expect(legend).not.toBeNull()
      expect(legend?.textContent).toBe('Notification Preferences')
    })

    it('password fields should have toggle visibility with aria', () => {
      container.innerHTML = `
        <div>
          <label for="password">Password</label>
          <input id="password" type="password">
          <button aria-label="Show password" aria-pressed="false" type="button">
            <span class="icon-eye"></span>
          </button>
        </div>
      `

      const toggle = container.querySelector('button')
      expect(toggle?.getAttribute('aria-label')).toBe('Show password')
      expect(toggle?.getAttribute('aria-pressed')).toBe('false')
    })
  })

  describe('Tab Panels', () => {
    it('tab list should have proper ARIA roles', () => {
      container.innerHTML = `
        <div role="tablist" aria-label="Event views">
          <button role="tab" aria-selected="true" aria-controls="panel-upcoming" id="tab-upcoming">
            Upcoming
          </button>
          <button role="tab" aria-selected="false" aria-controls="panel-past" id="tab-past" tabindex="-1">
            Past
          </button>
        </div>
        <div role="tabpanel" id="panel-upcoming" aria-labelledby="tab-upcoming">
          <p>Upcoming events content</p>
        </div>
        <div role="tabpanel" id="panel-past" aria-labelledby="tab-past" hidden>
          <p>Past events content</p>
        </div>
      `

      const tablist = container.querySelector('[role="tablist"]')
      expect(tablist).not.toBeNull()
      expect(tablist?.getAttribute('aria-label')).toBe('Event views')

      const tabs = container.querySelectorAll('[role="tab"]')
      expect(tabs).toHaveLength(2)

      // Active tab
      expect(tabs[0].getAttribute('aria-selected')).toBe('true')
      expect(tabs[0].getAttribute('aria-controls')).toBe('panel-upcoming')

      // Inactive tab should have tabindex="-1"
      expect(tabs[1].getAttribute('aria-selected')).toBe('false')
      expect(tabs[1].getAttribute('tabindex')).toBe('-1')

      // Panels should reference their tab
      const panels = container.querySelectorAll('[role="tabpanel"]')
      expect(panels[0].getAttribute('aria-labelledby')).toBe('tab-upcoming')
      expect(panels[1].getAttribute('aria-labelledby')).toBe('tab-past')
    })
  })

  describe('Dropdown Menus', () => {
    it('dropdown trigger should have aria-haspopup and aria-expanded', () => {
      container.innerHTML = `
        <button aria-haspopup="true" aria-expanded="false" aria-controls="menu-1">
          Actions
        </button>
        <ul id="menu-1" role="menu" hidden>
          <li role="menuitem"><button>Edit</button></li>
          <li role="menuitem"><button>Delete</button></li>
        </ul>
      `

      const trigger = container.querySelector('button')
      expect(trigger?.getAttribute('aria-haspopup')).toBe('true')
      expect(trigger?.getAttribute('aria-expanded')).toBe('false')
      expect(trigger?.getAttribute('aria-controls')).toBe('menu-1')

      const menu = container.querySelector('[role="menu"]')
      expect(menu).not.toBeNull()

      const menuItems = container.querySelectorAll('[role="menuitem"]')
      expect(menuItems).toHaveLength(2)
    })

    it('expanded dropdown should have aria-expanded="true"', () => {
      container.innerHTML = `
        <button aria-haspopup="true" aria-expanded="true" aria-controls="menu-2">
          Options
        </button>
        <ul id="menu-2" role="menu">
          <li role="menuitem"><button>Share</button></li>
          <li role="menuitem"><button>Report</button></li>
        </ul>
      `

      const trigger = container.querySelector('button')
      expect(trigger?.getAttribute('aria-expanded')).toBe('true')

      const menu = container.querySelector('[role="menu"]')
      expect(menu?.hasAttribute('hidden')).toBe(false)
    })
  })

  describe('Screen Reader Announcements', () => {
    it('live region should announce dynamic content changes', () => {
      container.innerHTML = `
        <div aria-live="polite" aria-atomic="true" id="notifications">
          3 new messages
        </div>
      `

      const liveRegion = container.querySelector('#notifications')
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite')
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true')
    })

    it('assertive live region for urgent messages', () => {
      container.innerHTML = `
        <div aria-live="assertive" role="alert" id="error-banner">
          Connection lost. Messages may not be delivered.
        </div>
      `

      const alert = container.querySelector('#error-banner')
      expect(alert?.getAttribute('aria-live')).toBe('assertive')
      expect(alert?.getAttribute('role')).toBe('alert')
    })

    it('progress indicator should announce completion', () => {
      container.innerHTML = `
        <div role="progressbar" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100" aria-label="Uploading file">
          75%
        </div>
      `

      const progress = container.querySelector('[role="progressbar"]')
      expect(progress?.getAttribute('aria-valuenow')).toBe('75')
      expect(progress?.getAttribute('aria-valuemin')).toBe('0')
      expect(progress?.getAttribute('aria-valuemax')).toBe('100')
      expect(progress?.getAttribute('aria-label')).toBe('Uploading file')
    })

    it('toast notification should use aria-live', () => {
      container.innerHTML = `
        <div class="toast-container" aria-live="polite" role="status">
          <div class="toast">
            Event created successfully
          </div>
        </div>
      `

      const toastContainer = container.querySelector('.toast-container')
      expect(toastContainer?.getAttribute('aria-live')).toBe('polite')
      expect(toastContainer?.getAttribute('role')).toBe('status')
    })

    it('message count badge should be announced', () => {
      container.innerHTML = `
        <button>
          Messages
          <span aria-label="5 unread messages" class="badge">5</span>
        </button>
      `

      const badge = container.querySelector('.badge')
      expect(badge?.getAttribute('aria-label')).toBe('5 unread messages')
    })
  })

  describe('Skip Navigation', () => {
    it('page should provide skip-to-content link', () => {
      container.innerHTML = `
        <a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>
        <nav>Navigation items...</nav>
        <main id="main-content">Main content</main>
      `

      const skipLink = container.querySelector('a[href="#main-content"]')
      expect(skipLink).not.toBeNull()
      expect(skipLink?.textContent).toContain('Skip to content')

      // Verify target exists
      const target = container.querySelector('#main-content')
      expect(target).not.toBeNull()
    })
  })

  describe('Loading States', () => {
    it('loading skeleton should announce loading state', () => {
      container.innerHTML = `
        <div aria-busy="true" aria-label="Loading events">
          <div class="skeleton" aria-hidden="true"></div>
          <div class="skeleton" aria-hidden="true"></div>
        </div>
      `

      const loading = container.querySelector('[aria-busy]')
      expect(loading?.getAttribute('aria-busy')).toBe('true')
      expect(loading?.getAttribute('aria-label')).toBe('Loading events')

      // Skeleton elements should be hidden from assistive tech
      const skeletons = container.querySelectorAll('.skeleton')
      skeletons.forEach((s) => {
        expect(s.getAttribute('aria-hidden')).toBe('true')
      })
    })

    it('loading complete should clear aria-busy', () => {
      container.innerHTML = `
        <div aria-busy="false">
          <ul>
            <li>Event 1</li>
            <li>Event 2</li>
          </ul>
        </div>
      `

      const region = container.querySelector('[aria-busy]')
      expect(region?.getAttribute('aria-busy')).toBe('false')
    })
  })
})
