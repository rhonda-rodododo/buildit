import { create } from 'zustand'
import { AppEvent, RSVP, RSVPStatus, EventWithRSVPs } from './types'

interface EventsState {
  // Events data
  events: AppEvent[]
  rsvps: RSVP[]

  // Active event
  activeEventId: string | null

  // Actions
  setEvents: (events: AppEvent[]) => void
  addEvent: (event: AppEvent) => void
  updateEvent: (eventId: string, updates: Partial<AppEvent>) => void
  deleteEvent: (eventId: string) => void

  // RSVP actions
  setRSVPs: (rsvps: RSVP[]) => void
  addRSVP: (rsvp: RSVP) => void
  updateRSVP: (eventId: string, pubkey: string, status: RSVPStatus) => void

  // Selectors
  getEventById: (eventId: string) => AppEvent | undefined
  getEventsByGroup: (groupId: string) => AppEvent[]
  getPublicEvents: () => AppEvent[]
  getUpcomingEvents: () => AppEvent[]
  getRSVPsForEvent: (eventId: string) => RSVP[]
  getUserRSVP: (eventId: string, pubkey: string) => RSVP | undefined
  getEventWithRSVPs: (eventId: string, userPubkey?: string) => EventWithRSVPs | undefined

  // UI state
  setActiveEvent: (eventId: string | null) => void

  // Clear
  clearEvents: () => void
}

export const useEventsStore = create<EventsState>()(
  (set, get) => ({
      events: [],
      rsvps: [],
      activeEventId: null,

      setEvents: (events) => set({ events }),

      addEvent: (event) => set((state) => {
        // Check if event already exists by ID to prevent duplicates
        if (state.events.some((e) => e.id === event.id)) {
          return state
        }
        return { events: [...state.events, event] }
      }),

      updateEvent: (eventId, updates) => set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId ? { ...e, ...updates, updatedAt: Date.now() } : e
        ),
      })),

      deleteEvent: (eventId) => set((state) => ({
        events: state.events.filter((e) => e.id !== eventId),
        rsvps: state.rsvps.filter((r) => r.eventId !== eventId),
        activeEventId: state.activeEventId === eventId ? null : state.activeEventId,
      })),

      setRSVPs: (rsvps) => set({ rsvps }),

      addRSVP: (rsvp) => set((state) => {
        // Remove any existing RSVP for this user/event combo
        const filteredRSVPs = state.rsvps.filter(
          (r) => !(r.eventId === rsvp.eventId && r.pubkey === rsvp.pubkey)
        )
        return { rsvps: [...filteredRSVPs, rsvp] }
      }),

      updateRSVP: (eventId, pubkey, status) => set((state) => {
        const existingRSVP = state.rsvps.find(
          (r) => r.eventId === eventId && r.pubkey === pubkey
        )

        if (existingRSVP) {
          return {
            rsvps: state.rsvps.map((r) =>
              r.eventId === eventId && r.pubkey === pubkey
                ? { ...r, status, respondedAt: Math.floor(Date.now() / 1000) }
                : r
            ),
          }
        } else {
          return {
            rsvps: [
              ...state.rsvps,
              {
                _v: '1.0.0',
                eventId,
                pubkey,
                status,
                guestCount: 0,
                respondedAt: Math.floor(Date.now() / 1000),
              },
            ],
          }
        }
      }),

      getEventById: (eventId) => {
        return get().events.find((e) => e.id === eventId)
      },

      getEventsByGroup: (groupId) => {
        return get().events.filter((e) => e.groupId === groupId)
      },

      getPublicEvents: () => {
        return get().events.filter((e) => e.visibility === 'public')
      },

      getUpcomingEvents: () => {
        const now = Math.floor(Date.now() / 1000)
        return get().events
          .filter((e) => e.startAt > now)
          .sort((a, b) => a.startAt - b.startAt)
      },

      getRSVPsForEvent: (eventId) => {
        return get().rsvps.filter((r) => r.eventId === eventId)
      },

      getUserRSVP: (eventId, pubkey) => {
        return get().rsvps.find(
          (r) => r.eventId === eventId && r.pubkey === pubkey
        )
      },

      getEventWithRSVPs: (eventId, userPubkey) => {
        const event = get().getEventById(eventId)
        if (!event) return undefined

        const rsvps = get().getRSVPsForEvent(eventId)
        const rsvpCounts = {
          going: rsvps.filter((r) => r.status === 'going').length,
          maybe: rsvps.filter((r) => r.status === 'maybe').length,
          notGoing: rsvps.filter((r) => r.status === 'not_going').length,
        }

        const userRSVP = userPubkey
          ? get().getUserRSVP(eventId, userPubkey)?.status
          : undefined

        return {
          ...event,
          rsvpCounts,
          userRSVP,
        }
      },

      setActiveEvent: (eventId) => set({ activeEventId: eventId }),

      clearEvents: () => set({ events: [], rsvps: [], activeEventId: null }),
    })
)
