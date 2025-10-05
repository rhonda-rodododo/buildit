import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AidItem, RideShare, AidStatus, AidCategory, AidType } from './types'

interface MutualAidState {
  // Aid items data
  aidItems: AidItem[]
  rideShares: RideShare[]

  // Active item
  activeAidItemId: string | null

  // Actions - Aid Items
  setAidItems: (items: AidItem[]) => void
  addAidItem: (item: AidItem) => void
  updateAidItem: (itemId: string, updates: Partial<AidItem>) => void
  deleteAidItem: (itemId: string) => void

  // Actions - Ride Shares
  setRideShares: (rides: RideShare[]) => void
  addRideShare: (ride: RideShare) => void
  updateRideShare: (rideId: string, updates: Partial<RideShare>) => void
  deleteRideShare: (rideId: string) => void

  // Selectors - Aid Items
  getAidItemById: (itemId: string) => AidItem | undefined
  getAidItemsByGroup: (groupId: string) => AidItem[]
  getAidItemsByType: (type: AidType) => AidItem[]
  getAidItemsByCategory: (category: AidCategory) => AidItem[]
  getAidItemsByStatus: (status: AidStatus) => AidItem[]
  getOpenRequests: () => AidItem[]
  getOpenOffers: () => AidItem[]

  // Selectors - Ride Shares
  getRideShareById: (rideId: string) => RideShare | undefined
  getRideSharesByGroup: (groupId: string) => RideShare[]
  getOpenRideRequests: () => RideShare[]
  getOpenRideOffers: () => RideShare[]

  // UI state
  setActiveAidItem: (itemId: string | null) => void

  // Clear
  clearAll: () => void
}

export const useMutualAidStore = create<MutualAidState>()(
  persist(
    (set, get) => ({
      aidItems: [],
      rideShares: [],
      activeAidItemId: null,

      // Aid Items
      setAidItems: (items) => set({ aidItems: items }),

      addAidItem: (item) => set((state) => ({
        aidItems: [...state.aidItems, item],
      })),

      updateAidItem: (itemId, updates) => set((state) => ({
        aidItems: state.aidItems.map((item) =>
          item.id === itemId ? { ...item, ...updates, updatedAt: Date.now() } : item
        ),
      })),

      deleteAidItem: (itemId) => set((state) => ({
        aidItems: state.aidItems.filter((item) => item.id !== itemId),
        activeAidItemId: state.activeAidItemId === itemId ? null : state.activeAidItemId,
      })),

      // Ride Shares
      setRideShares: (rides) => set({ rideShares: rides }),

      addRideShare: (ride) => set((state) => ({
        rideShares: [...state.rideShares, ride],
      })),

      updateRideShare: (rideId, updates) => set((state) => ({
        rideShares: state.rideShares.map((ride) =>
          ride.id === rideId ? { ...ride, ...updates } : ride
        ),
      })),

      deleteRideShare: (rideId) => set((state) => ({
        rideShares: state.rideShares.filter((ride) => ride.id !== rideId),
      })),

      // Selectors - Aid Items
      getAidItemById: (itemId) => {
        return get().aidItems.find((item) => item.id === itemId)
      },

      getAidItemsByGroup: (groupId) => {
        return get().aidItems.filter((item) => item.groupId === groupId)
      },

      getAidItemsByType: (type) => {
        return get().aidItems.filter((item) => item.type === type)
      },

      getAidItemsByCategory: (category) => {
        return get().aidItems.filter((item) => item.category === category)
      },

      getAidItemsByStatus: (status) => {
        return get().aidItems.filter((item) => item.status === status)
      },

      getOpenRequests: () => {
        return get().aidItems.filter(
          (item) => item.type === 'request' && item.status === 'open'
        )
      },

      getOpenOffers: () => {
        return get().aidItems.filter(
          (item) => item.type === 'offer' && item.status === 'open'
        )
      },

      // Selectors - Ride Shares
      getRideShareById: (rideId) => {
        return get().rideShares.find((ride) => ride.id === rideId)
      },

      getRideSharesByGroup: (groupId) => {
        return get().rideShares.filter((ride) => ride.groupId === groupId)
      },

      getOpenRideRequests: () => {
        return get().rideShares.filter(
          (ride) => ride.type === 'request' && ride.status === 'open'
        )
      },

      getOpenRideOffers: () => {
        return get().rideShares.filter(
          (ride) => ride.type === 'offer' && ride.status === 'open'
        )
      },

      // UI state
      setActiveAidItem: (itemId) => set({ activeAidItemId: itemId }),

      // Clear
      clearAll: () => set({
        aidItems: [],
        rideShares: [],
        activeAidItemId: null,
      }),
    }),
    {
      name: 'mutual-aid-storage',
    }
  )
)
