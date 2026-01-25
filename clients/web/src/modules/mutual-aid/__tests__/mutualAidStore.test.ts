/**
 * MutualAidStore Tests
 * Tests for mutual aid items and ride shares management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMutualAidStore } from '../mutualAidStore';
import type { AidItem, RideShare, AidStatus, AidCategory, AidType } from '../types';

describe('mutualAidStore', () => {
  beforeEach(() => {
    // Reset store state
    useMutualAidStore.setState({
      aidItems: [],
      rideShares: [],
      activeAidItemId: null,
    });
  });

  const createMockAidItem = (overrides: Partial<AidItem> = {}): AidItem => ({
    id: `aid-${Date.now()}-${Math.random()}`,
    type: 'request',
    category: 'food',
    title: 'Test Aid Item',
    description: 'A test aid item',
    groupId: 'group-1',
    createdBy: 'user-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'open',
    urgency: 'medium',
    tags: [],
    isAnonymous: false,
    showLocation: true,
    ...overrides,
  });

  const createMockRideShare = (overrides: Partial<RideShare> = {}): RideShare => ({
    id: `ride-${Date.now()}-${Math.random()}`,
    type: 'offer',
    origin: 'City A',
    destination: 'City B',
    departureTime: Date.now() + 86400000,
    flexibility: 30,
    seats: 3,
    needsSeats: 1,
    recurring: false,
    createdBy: 'user-1',
    createdAt: Date.now(),
    status: 'open',
    groupId: 'group-1',
    ...overrides,
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useMutualAidStore.getState();
      expect(state.aidItems).toEqual([]);
      expect(state.rideShares).toEqual([]);
      expect(state.activeAidItemId).toBeNull();
    });
  });

  describe('Aid Items', () => {
    describe('setAidItems', () => {
      it('should set aid items array', () => {
        const { setAidItems } = useMutualAidStore.getState();
        const items = [createMockAidItem({ id: 'aid-1' }), createMockAidItem({ id: 'aid-2' })];

        setAidItems(items);

        expect(useMutualAidStore.getState().aidItems).toHaveLength(2);
      });
    });

    describe('addAidItem', () => {
      it('should add a single aid item', () => {
        const { addAidItem } = useMutualAidStore.getState();
        const item = createMockAidItem({ id: 'aid-1' });

        addAidItem(item);

        const { aidItems } = useMutualAidStore.getState();
        expect(aidItems).toHaveLength(1);
        expect(aidItems[0].id).toBe('aid-1');
      });
    });

    describe('updateAidItem', () => {
      it('should update an existing aid item', () => {
        const { setAidItems, updateAidItem } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1', title: 'Original' })]);

        updateAidItem('aid-1', { title: 'Updated' });

        const { aidItems } = useMutualAidStore.getState();
        expect(aidItems[0].title).toBe('Updated');
      });

      it('should update the updatedAt timestamp', () => {
        const { setAidItems, updateAidItem } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1', updatedAt: 1000 })]);

        updateAidItem('aid-1', { title: 'Updated' });

        const { aidItems } = useMutualAidStore.getState();
        expect(aidItems[0].updatedAt).toBeGreaterThan(1000);
      });
    });

    describe('deleteAidItem', () => {
      it('should delete an aid item', () => {
        const { setAidItems, deleteAidItem } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1' }), createMockAidItem({ id: 'aid-2' })]);

        deleteAidItem('aid-1');

        const { aidItems } = useMutualAidStore.getState();
        expect(aidItems).toHaveLength(1);
        expect(aidItems[0].id).toBe('aid-2');
      });

      it('should clear activeAidItemId if deleting active item', () => {
        const { setAidItems, setActiveAidItem, deleteAidItem } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1' })]);
        setActiveAidItem('aid-1');

        deleteAidItem('aid-1');

        expect(useMutualAidStore.getState().activeAidItemId).toBeNull();
      });

      it('should not clear activeAidItemId if deleting different item', () => {
        const { setAidItems, setActiveAidItem, deleteAidItem } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1' }), createMockAidItem({ id: 'aid-2' })]);
        setActiveAidItem('aid-2');

        deleteAidItem('aid-1');

        expect(useMutualAidStore.getState().activeAidItemId).toBe('aid-2');
      });
    });
  });

  describe('Ride Shares', () => {
    describe('setRideShares', () => {
      it('should set ride shares array', () => {
        const { setRideShares } = useMutualAidStore.getState();
        const rides = [createMockRideShare({ id: 'ride-1' }), createMockRideShare({ id: 'ride-2' })];

        setRideShares(rides);

        expect(useMutualAidStore.getState().rideShares).toHaveLength(2);
      });
    });

    describe('addRideShare', () => {
      it('should add a single ride share', () => {
        const { addRideShare } = useMutualAidStore.getState();
        const ride = createMockRideShare({ id: 'ride-1' });

        addRideShare(ride);

        const { rideShares } = useMutualAidStore.getState();
        expect(rideShares).toHaveLength(1);
        expect(rideShares[0].id).toBe('ride-1');
      });
    });

    describe('updateRideShare', () => {
      it('should update an existing ride share', () => {
        const { setRideShares, updateRideShare } = useMutualAidStore.getState();
        setRideShares([createMockRideShare({ id: 'ride-1', origin: 'Original' })]);

        updateRideShare('ride-1', { origin: 'Updated' });

        const { rideShares } = useMutualAidStore.getState();
        expect(rideShares[0].origin).toBe('Updated');
      });
    });

    describe('deleteRideShare', () => {
      it('should delete a ride share', () => {
        const { setRideShares, deleteRideShare } = useMutualAidStore.getState();
        setRideShares([createMockRideShare({ id: 'ride-1' }), createMockRideShare({ id: 'ride-2' })]);

        deleteRideShare('ride-1');

        const { rideShares } = useMutualAidStore.getState();
        expect(rideShares).toHaveLength(1);
        expect(rideShares[0].id).toBe('ride-2');
      });
    });
  });

  describe('Aid Items Selectors', () => {
    describe('getAidItemById', () => {
      it('should return aid item by id', () => {
        const { setAidItems, getAidItemById } = useMutualAidStore.getState();
        setAidItems([createMockAidItem({ id: 'aid-1', title: 'Test' })]);

        const item = getAidItemById('aid-1');

        expect(item?.title).toBe('Test');
      });

      it('should return undefined for non-existent item', () => {
        const { getAidItemById } = useMutualAidStore.getState();

        expect(getAidItemById('non-existent')).toBeUndefined();
      });
    });

    describe('getAidItemsByGroup', () => {
      it('should filter aid items by group', () => {
        const { setAidItems, getAidItemsByGroup } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', groupId: 'group-1' }),
          createMockAidItem({ id: 'aid-2', groupId: 'group-2' }),
          createMockAidItem({ id: 'aid-3', groupId: 'group-1' }),
        ]);

        const items = getAidItemsByGroup('group-1');

        expect(items).toHaveLength(2);
        expect(items.every((i) => i.groupId === 'group-1')).toBe(true);
      });
    });

    describe('getAidItemsByType', () => {
      it('should filter aid items by type', () => {
        const { setAidItems, getAidItemsByType } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', type: 'request' }),
          createMockAidItem({ id: 'aid-2', type: 'offer' }),
          createMockAidItem({ id: 'aid-3', type: 'request' }),
        ]);

        const requests = getAidItemsByType('request');

        expect(requests).toHaveLength(2);
        expect(requests.every((i) => i.type === 'request')).toBe(true);
      });
    });

    describe('getAidItemsByCategory', () => {
      it('should filter aid items by category', () => {
        const { setAidItems, getAidItemsByCategory } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', category: 'food' }),
          createMockAidItem({ id: 'aid-2', category: 'housing' }),
          createMockAidItem({ id: 'aid-3', category: 'food' }),
        ]);

        const foodItems = getAidItemsByCategory('food');

        expect(foodItems).toHaveLength(2);
        expect(foodItems.every((i) => i.category === 'food')).toBe(true);
      });
    });

    describe('getAidItemsByStatus', () => {
      it('should filter aid items by status', () => {
        const { setAidItems, getAidItemsByStatus } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', status: 'open' }),
          createMockAidItem({ id: 'aid-2', status: 'fulfilled' }),
          createMockAidItem({ id: 'aid-3', status: 'open' }),
        ]);

        const openItems = getAidItemsByStatus('open');

        expect(openItems).toHaveLength(2);
        expect(openItems.every((i) => i.status === 'open')).toBe(true);
      });
    });

    describe('getOpenRequests', () => {
      it('should return only open requests', () => {
        const { setAidItems, getOpenRequests } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', type: 'request', status: 'open' }),
          createMockAidItem({ id: 'aid-2', type: 'offer', status: 'open' }),
          createMockAidItem({ id: 'aid-3', type: 'request', status: 'fulfilled' }),
          createMockAidItem({ id: 'aid-4', type: 'request', status: 'open' }),
        ]);

        const openRequests = getOpenRequests();

        expect(openRequests).toHaveLength(2);
        expect(openRequests.every((i) => i.type === 'request' && i.status === 'open')).toBe(true);
      });
    });

    describe('getOpenOffers', () => {
      it('should return only open offers', () => {
        const { setAidItems, getOpenOffers } = useMutualAidStore.getState();
        setAidItems([
          createMockAidItem({ id: 'aid-1', type: 'offer', status: 'open' }),
          createMockAidItem({ id: 'aid-2', type: 'request', status: 'open' }),
          createMockAidItem({ id: 'aid-3', type: 'offer', status: 'matched' }),
          createMockAidItem({ id: 'aid-4', type: 'offer', status: 'open' }),
        ]);

        const openOffers = getOpenOffers();

        expect(openOffers).toHaveLength(2);
        expect(openOffers.every((i) => i.type === 'offer' && i.status === 'open')).toBe(true);
      });
    });
  });

  describe('Ride Share Selectors', () => {
    describe('getRideShareById', () => {
      it('should return ride share by id', () => {
        const { setRideShares, getRideShareById } = useMutualAidStore.getState();
        setRideShares([createMockRideShare({ id: 'ride-1', origin: 'Test City' })]);

        const ride = getRideShareById('ride-1');

        expect(ride?.origin).toBe('Test City');
      });

      it('should return undefined for non-existent ride', () => {
        const { getRideShareById } = useMutualAidStore.getState();

        expect(getRideShareById('non-existent')).toBeUndefined();
      });
    });

    describe('getRideSharesByGroup', () => {
      it('should filter ride shares by group', () => {
        const { setRideShares, getRideSharesByGroup } = useMutualAidStore.getState();
        setRideShares([
          createMockRideShare({ id: 'ride-1', groupId: 'group-1' }),
          createMockRideShare({ id: 'ride-2', groupId: 'group-2' }),
          createMockRideShare({ id: 'ride-3', groupId: 'group-1' }),
        ]);

        const rides = getRideSharesByGroup('group-1');

        expect(rides).toHaveLength(2);
        expect(rides.every((r) => r.groupId === 'group-1')).toBe(true);
      });
    });

    describe('getOpenRideRequests', () => {
      it('should return only open ride requests', () => {
        const { setRideShares, getOpenRideRequests } = useMutualAidStore.getState();
        setRideShares([
          createMockRideShare({ id: 'ride-1', type: 'request', status: 'open' }),
          createMockRideShare({ id: 'ride-2', type: 'offer', status: 'open' }),
          createMockRideShare({ id: 'ride-3', type: 'request', status: 'matched' }),
          createMockRideShare({ id: 'ride-4', type: 'request', status: 'open' }),
        ]);

        const openRequests = getOpenRideRequests();

        expect(openRequests).toHaveLength(2);
        expect(openRequests.every((r) => r.type === 'request' && r.status === 'open')).toBe(true);
      });
    });

    describe('getOpenRideOffers', () => {
      it('should return only open ride offers', () => {
        const { setRideShares, getOpenRideOffers } = useMutualAidStore.getState();
        setRideShares([
          createMockRideShare({ id: 'ride-1', type: 'offer', status: 'open' }),
          createMockRideShare({ id: 'ride-2', type: 'request', status: 'open' }),
          createMockRideShare({ id: 'ride-3', type: 'offer', status: 'completed' }),
          createMockRideShare({ id: 'ride-4', type: 'offer', status: 'open' }),
        ]);

        const openOffers = getOpenRideOffers();

        expect(openOffers).toHaveLength(2);
        expect(openOffers.every((r) => r.type === 'offer' && r.status === 'open')).toBe(true);
      });
    });
  });

  describe('UI state', () => {
    describe('setActiveAidItem', () => {
      it('should set active aid item id', () => {
        const { setActiveAidItem } = useMutualAidStore.getState();

        setActiveAidItem('aid-1');

        expect(useMutualAidStore.getState().activeAidItemId).toBe('aid-1');
      });

      it('should clear active aid item', () => {
        const { setActiveAidItem } = useMutualAidStore.getState();
        setActiveAidItem('aid-1');

        setActiveAidItem(null);

        expect(useMutualAidStore.getState().activeAidItemId).toBeNull();
      });
    });
  });

  describe('clearAll', () => {
    it('should clear all data', () => {
      const { setAidItems, setRideShares, setActiveAidItem, clearAll } = useMutualAidStore.getState();
      setAidItems([createMockAidItem()]);
      setRideShares([createMockRideShare()]);
      setActiveAidItem('aid-1');

      clearAll();

      const state = useMutualAidStore.getState();
      expect(state.aidItems).toEqual([]);
      expect(state.rideShares).toEqual([]);
      expect(state.activeAidItemId).toBeNull();
    });
  });
});
