/**
 * EventsStore Tests
 * Tests for events and RSVP management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEventsStore } from '../eventsStore';
import type { Event, RSVP, RSVPStatus } from '../types';

describe('eventsStore', () => {
  beforeEach(() => {
    // Reset store state
    useEventsStore.setState({
      events: [],
      rsvps: [],
      activeEventId: null,
    });
  });

  const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
    id: `event-${Date.now()}-${Math.random()}`,
    groupId: 'group-1',
    title: 'Test Event',
    description: 'A test event',
    startTime: Date.now() + 86400000, // Tomorrow
    privacy: 'public',
    createdBy: 'user-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    coHosts: [],
    ...overrides,
  });

  const createMockRSVP = (overrides: Partial<RSVP> = {}): RSVP => ({
    eventId: 'event-1',
    userPubkey: 'user-1',
    status: 'going',
    timestamp: Date.now(),
    ...overrides,
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useEventsStore.getState();
      expect(state.events).toEqual([]);
      expect(state.rsvps).toEqual([]);
      expect(state.activeEventId).toBeNull();
    });
  });

  describe('setEvents', () => {
    it('should set events array', () => {
      const { setEvents } = useEventsStore.getState();
      const events = [createMockEvent({ id: 'event-1' }), createMockEvent({ id: 'event-2' })];

      setEvents(events);

      expect(useEventsStore.getState().events).toHaveLength(2);
    });
  });

  describe('addEvent', () => {
    it('should add a single event', () => {
      const { addEvent } = useEventsStore.getState();
      const event = createMockEvent({ id: 'event-1' });

      addEvent(event);

      const { events } = useEventsStore.getState();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('event-1');
    });

    it('should add multiple events', () => {
      const { addEvent } = useEventsStore.getState();

      addEvent(createMockEvent({ id: 'event-1' }));
      addEvent(createMockEvent({ id: 'event-2' }));

      expect(useEventsStore.getState().events).toHaveLength(2);
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', () => {
      const { setEvents, updateEvent } = useEventsStore.getState();
      const event = createMockEvent({ id: 'event-1', title: 'Original Title' });
      setEvents([event]);

      updateEvent('event-1', { title: 'Updated Title' });

      const { events } = useEventsStore.getState();
      expect(events[0].title).toBe('Updated Title');
    });

    it('should update the updatedAt timestamp', () => {
      const { setEvents, updateEvent } = useEventsStore.getState();
      const event = createMockEvent({ id: 'event-1', updatedAt: 1000 });
      setEvents([event]);

      updateEvent('event-1', { title: 'Updated' });

      const { events } = useEventsStore.getState();
      expect(events[0].updatedAt).toBeGreaterThan(1000);
    });

    it('should not affect other events', () => {
      const { setEvents, updateEvent } = useEventsStore.getState();
      setEvents([
        createMockEvent({ id: 'event-1', title: 'Event 1' }),
        createMockEvent({ id: 'event-2', title: 'Event 2' }),
      ]);

      updateEvent('event-1', { title: 'Updated' });

      const { events } = useEventsStore.getState();
      expect(events.find((e) => e.id === 'event-2')?.title).toBe('Event 2');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', () => {
      const { setEvents, deleteEvent } = useEventsStore.getState();
      setEvents([createMockEvent({ id: 'event-1' }), createMockEvent({ id: 'event-2' })]);

      deleteEvent('event-1');

      const { events } = useEventsStore.getState();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('event-2');
    });

    it('should remove related RSVPs when deleting event', () => {
      const { setEvents, setRSVPs, deleteEvent } = useEventsStore.getState();
      setEvents([createMockEvent({ id: 'event-1' })]);
      setRSVPs([
        createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1' }),
        createMockRSVP({ eventId: 'event-1', userPubkey: 'user-2' }),
        createMockRSVP({ eventId: 'event-2', userPubkey: 'user-1' }),
      ]);

      deleteEvent('event-1');

      const { rsvps } = useEventsStore.getState();
      expect(rsvps).toHaveLength(1);
      expect(rsvps[0].eventId).toBe('event-2');
    });

    it('should clear activeEventId if deleting active event', () => {
      const { setEvents, setActiveEvent, deleteEvent } = useEventsStore.getState();
      setEvents([createMockEvent({ id: 'event-1' })]);
      setActiveEvent('event-1');

      deleteEvent('event-1');

      expect(useEventsStore.getState().activeEventId).toBeNull();
    });

    it('should not clear activeEventId if deleting different event', () => {
      const { setEvents, setActiveEvent, deleteEvent } = useEventsStore.getState();
      setEvents([createMockEvent({ id: 'event-1' }), createMockEvent({ id: 'event-2' })]);
      setActiveEvent('event-2');

      deleteEvent('event-1');

      expect(useEventsStore.getState().activeEventId).toBe('event-2');
    });
  });

  describe('RSVP actions', () => {
    describe('setRSVPs', () => {
      it('should set RSVPs array', () => {
        const { setRSVPs } = useEventsStore.getState();
        const rsvps = [createMockRSVP({ userPubkey: 'user-1' }), createMockRSVP({ userPubkey: 'user-2' })];

        setRSVPs(rsvps);

        expect(useEventsStore.getState().rsvps).toHaveLength(2);
      });
    });

    describe('addRSVP', () => {
      it('should add a new RSVP', () => {
        const { addRSVP } = useEventsStore.getState();

        addRSVP(createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1' }));

        const { rsvps } = useEventsStore.getState();
        expect(rsvps).toHaveLength(1);
      });

      it('should replace existing RSVP for same user/event combo', () => {
        const { addRSVP } = useEventsStore.getState();

        addRSVP(createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'going' }));
        addRSVP(createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'maybe' }));

        const { rsvps } = useEventsStore.getState();
        expect(rsvps).toHaveLength(1);
        expect(rsvps[0].status).toBe('maybe');
      });
    });

    describe('updateRSVP', () => {
      it('should update existing RSVP', () => {
        const { setRSVPs, updateRSVP } = useEventsStore.getState();
        setRSVPs([createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'going' })]);

        updateRSVP('event-1', 'user-1', 'not_going');

        const { rsvps } = useEventsStore.getState();
        expect(rsvps[0].status).toBe('not_going');
      });

      it('should create new RSVP if not exists', () => {
        const { updateRSVP } = useEventsStore.getState();

        updateRSVP('event-1', 'user-1', 'going');

        const { rsvps } = useEventsStore.getState();
        expect(rsvps).toHaveLength(1);
        expect(rsvps[0].status).toBe('going');
      });
    });
  });

  describe('selectors', () => {
    describe('getEventById', () => {
      it('should return event by id', () => {
        const { setEvents, getEventById } = useEventsStore.getState();
        setEvents([createMockEvent({ id: 'event-1', title: 'Test Event' })]);

        const event = getEventById('event-1');

        expect(event?.title).toBe('Test Event');
      });

      it('should return undefined for non-existent event', () => {
        const { getEventById } = useEventsStore.getState();

        expect(getEventById('non-existent')).toBeUndefined();
      });
    });

    describe('getEventsByGroup', () => {
      it('should filter events by group', () => {
        const { setEvents, getEventsByGroup } = useEventsStore.getState();
        setEvents([
          createMockEvent({ id: 'event-1', groupId: 'group-1' }),
          createMockEvent({ id: 'event-2', groupId: 'group-2' }),
          createMockEvent({ id: 'event-3', groupId: 'group-1' }),
        ]);

        const events = getEventsByGroup('group-1');

        expect(events).toHaveLength(2);
        expect(events.every((e) => e.groupId === 'group-1')).toBe(true);
      });
    });

    describe('getPublicEvents', () => {
      it('should return only public events', () => {
        const { setEvents, getPublicEvents } = useEventsStore.getState();
        setEvents([
          createMockEvent({ id: 'event-1', privacy: 'public' }),
          createMockEvent({ id: 'event-2', privacy: 'private' }),
          createMockEvent({ id: 'event-3', privacy: 'public' }),
        ]);

        const events = getPublicEvents();

        expect(events).toHaveLength(2);
        expect(events.every((e) => e.privacy === 'public')).toBe(true);
      });
    });

    describe('getUpcomingEvents', () => {
      it('should return only future events sorted by start time', () => {
        const { setEvents, getUpcomingEvents } = useEventsStore.getState();
        const now = Date.now();
        setEvents([
          createMockEvent({ id: 'past', startTime: now - 10000 }),
          createMockEvent({ id: 'later', startTime: now + 20000 }),
          createMockEvent({ id: 'soon', startTime: now + 10000 }),
        ]);

        const events = getUpcomingEvents();

        expect(events).toHaveLength(2);
        expect(events[0].id).toBe('soon');
        expect(events[1].id).toBe('later');
      });
    });

    describe('getRSVPsForEvent', () => {
      it('should return RSVPs for specific event', () => {
        const { setRSVPs, getRSVPsForEvent } = useEventsStore.getState();
        setRSVPs([
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1' }),
          createMockRSVP({ eventId: 'event-2', userPubkey: 'user-2' }),
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-3' }),
        ]);

        const rsvps = getRSVPsForEvent('event-1');

        expect(rsvps).toHaveLength(2);
      });
    });

    describe('getUserRSVP', () => {
      it('should return user RSVP for event', () => {
        const { setRSVPs, getUserRSVP } = useEventsStore.getState();
        setRSVPs([createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'going' })]);

        const rsvp = getUserRSVP('event-1', 'user-1');

        expect(rsvp?.status).toBe('going');
      });

      it('should return undefined if no RSVP', () => {
        const { getUserRSVP } = useEventsStore.getState();

        expect(getUserRSVP('event-1', 'user-1')).toBeUndefined();
      });
    });

    describe('getEventWithRSVPs', () => {
      it('should return event with RSVP counts', () => {
        const { setEvents, setRSVPs, getEventWithRSVPs } = useEventsStore.getState();
        setEvents([createMockEvent({ id: 'event-1' })]);
        setRSVPs([
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'going' }),
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-2', status: 'going' }),
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-3', status: 'maybe' }),
          createMockRSVP({ eventId: 'event-1', userPubkey: 'user-4', status: 'not_going' }),
        ]);

        const eventWithRSVPs = getEventWithRSVPs('event-1');

        expect(eventWithRSVPs?.rsvpCounts.going).toBe(2);
        expect(eventWithRSVPs?.rsvpCounts.maybe).toBe(1);
        expect(eventWithRSVPs?.rsvpCounts.notGoing).toBe(1);
      });

      it('should include userRSVP when pubkey provided', () => {
        const { setEvents, setRSVPs, getEventWithRSVPs } = useEventsStore.getState();
        setEvents([createMockEvent({ id: 'event-1' })]);
        setRSVPs([createMockRSVP({ eventId: 'event-1', userPubkey: 'user-1', status: 'going' })]);

        const eventWithRSVPs = getEventWithRSVPs('event-1', 'user-1');

        expect(eventWithRSVPs?.userRSVP).toBe('going');
      });

      it('should return undefined for non-existent event', () => {
        const { getEventWithRSVPs } = useEventsStore.getState();

        expect(getEventWithRSVPs('non-existent')).toBeUndefined();
      });
    });
  });

  describe('UI state', () => {
    describe('setActiveEvent', () => {
      it('should set active event id', () => {
        const { setActiveEvent } = useEventsStore.getState();

        setActiveEvent('event-1');

        expect(useEventsStore.getState().activeEventId).toBe('event-1');
      });

      it('should clear active event', () => {
        const { setActiveEvent } = useEventsStore.getState();
        setActiveEvent('event-1');

        setActiveEvent(null);

        expect(useEventsStore.getState().activeEventId).toBeNull();
      });
    });
  });

  describe('clearEvents', () => {
    it('should clear all events, RSVPs, and active event', () => {
      const { setEvents, setRSVPs, setActiveEvent, clearEvents } = useEventsStore.getState();
      setEvents([createMockEvent()]);
      setRSVPs([createMockRSVP()]);
      setActiveEvent('event-1');

      clearEvents();

      const state = useEventsStore.getState();
      expect(state.events).toEqual([]);
      expect(state.rsvps).toEqual([]);
      expect(state.activeEventId).toBeNull();
    });
  });
});
