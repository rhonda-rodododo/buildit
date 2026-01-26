import { create } from 'zustand'
import type { WikiPage, WikiCategory } from './types'

interface WikiState {
  // Use objects/arrays instead of Maps for proper Zustand reactivity
  pages: Record<string, WikiPage>
  categories: Record<string, WikiCategory>

  // Actions
  addPage: (page: WikiPage) => void
  updatePage: (id: string, updates: Partial<WikiPage>) => void
  removePage: (id: string) => void
  addCategory: (category: WikiCategory) => void
  removeCategory: (id: string) => void

  // Getters
  getPage: (id: string) => WikiPage | undefined
  getPagesByGroup: (groupId: string) => WikiPage[]
  getPagesByCategory: (groupId: string, categoryId: string) => WikiPage[]
  searchPages: (groupId: string, query: string) => WikiPage[]
  getCategories: (groupId: string) => WikiCategory[]
}

export const useWikiStore = create<WikiState>((set, get) => ({
  pages: {},
  categories: {},

  addPage: (page) => set((state) => ({
    pages: {
      ...state.pages,
      [page.id]: page,
    },
  })),

  updatePage: (id, updates) => set((state) => {
    const existing = state.pages[id]
    if (!existing) return state

    return {
      pages: {
        ...state.pages,
        [id]: {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
          version: existing.version + 1,
        },
      },
    }
  }),

  removePage: (id) => set((state) => {
    const { [id]: _removed, ...rest } = state.pages
    return { pages: rest }
  }),

  addCategory: (category) => set((state) => ({
    categories: {
      ...state.categories,
      [category.id]: category,
    },
  })),

  removeCategory: (id) => set((state) => {
    const { [id]: _removed, ...rest } = state.categories
    return { categories: rest }
  }),

  getPage: (id) => get().pages[id],

  getPagesByGroup: (groupId) => {
    return Object.values(get().pages)
      .filter(p => p.groupId === groupId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  getPagesByCategory: (groupId, categoryId) => {
    return Object.values(get().pages)
      .filter(p => p.groupId === groupId && p.categoryId === categoryId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  searchPages: (groupId, query) => {
    const lowercaseQuery = query.toLowerCase()
    return Object.values(get().pages)
      .filter(p =>
        p.groupId === groupId &&
        (p.title.toLowerCase().includes(lowercaseQuery) ||
         p.content.toLowerCase().includes(lowercaseQuery) ||
         p.tags.some(t => t.toLowerCase().includes(lowercaseQuery)))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  getCategories: (groupId) => {
    return Object.values(get().categories)
      .filter(c => c.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },
}))
