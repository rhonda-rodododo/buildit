import { create } from 'zustand'
import { Event, RSVP, RSVPStatus, EventWithRSVPs } from './types'

interface EventsState {
  // Events data
  events: Event[]
  rsvps: RSVP[]

  // Active event
  activeEventId: string | null

  // Actions
  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  updateEvent: (eventId: string, updates: Partial<Event>) => void
  deleteEvent: (eventId: string) => void

  // RSVP actions
  setRSVPs: (rsvps: RSVP[]) => void
  addRSVP: (rsvp: RSVP) => void
  updateRSVP: (eventId: string, userPubkey: string, status: RSVPStatus) => void

  // Selectors
  getEventById: (eventId: string) => Event | undefined
  getEventsByGroup: (groupId: string) => Event[]
  getPublicEvents: () => Event[]
  getUpcomingEvents: () => Event[]
  getRSVPsForEvent: (eventId: string) => RSVP[]
  getUserRSVP: (eventId: string, userPubkey: string) => RSVP | undefined
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

      addEvent: (event) => set((state) => ({
        events: [...state.events, event],
      })),

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
          (r) => !(r.eventId === rsvp.eventId && r.userPubkey === rsvp.userPubkey)
        )
        return { rsvps: [...filteredRSVPs, rsvp] }
      }),

      updateRSVP: (eventId, userPubkey, status) => set((state) => {
        const existingRSVP = state.rsvps.find(
          (r) => r.eventId === eventId && r.userPubkey === userPubkey
        )

        if (existingRSVP) {
          return {
            rsvps: state.rsvps.map((r) =>
              r.eventId === eventId && r.userPubkey === userPubkey
                ? { ...r, status, timestamp: Date.now() }
                : r
            ),
          }
        } else {
          return {
            rsvps: [
              ...state.rsvps,
              {
                eventId,
                userPubkey,
                status,
                timestamp: Date.now(),
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
        return get().events.filter((e) => e.privacy === 'public')
      },

      getUpcomingEvents: () => {
        const now = Date.now()
        return get().events
          .filter((e) => e.startTime > now)
          .sort((a, b) => a.startTime - b.startTime)
      },

      getRSVPsForEvent: (eventId) => {
        return get().rsvps.filter((r) => r.eventId === eventId)
      },

      getUserRSVP: (eventId, userPubkey) => {
        return get().rsvps.find(
          (r) => r.eventId === eventId && r.userPubkey === userPubkey
        )
      },

      getEventWithRSVPs: (eventId, userPubkey) => {
        const event = get().getEventById(eventId)
        if (!event) return undefined

        const rsvps = get().getRSVPsForEvent(eventId)
        const rsvpCounts = {
          going: rsvps.filter((r) => r.status === 'going').length,
          maybe: rsvps.filter((r) => r.status === 'maybe').length,
          notGoing: rsvps.filter((r) => r.status === 'not-going').length,
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
