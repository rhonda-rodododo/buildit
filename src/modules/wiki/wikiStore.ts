import { create } from 'zustand'
import type { WikiPage, WikiCategory } from './types'

interface WikiState {
  pages: Map<string, WikiPage>
  categories: Map<string, WikiCategory>

  // Actions
  addPage: (page: WikiPage) => void
  updatePage: (id: string, updates: Partial<WikiPage>) => void
  removePage: (id: string) => void
  addCategory: (category: WikiCategory) => void
  removeCategory: (id: string) => void

  // Getters
  getPage: (id: string) => WikiPage | undefined
  getPagesByGroup: (groupId: string) => WikiPage[]
  getPagesByCategory: (groupId: string, category: string) => WikiPage[]
  searchPages: (groupId: string, query: string) => WikiPage[]
  getCategories: (groupId: string) => WikiCategory[]
}

export const useWikiStore = create<WikiState>((set, get) => ({
  pages: new Map(),
  categories: new Map(),

  addPage: (page) => set((state) => {
    const newPages = new Map(state.pages)
    newPages.set(page.id, page)
    return { pages: newPages }
  }),

  updatePage: (id, updates) => set((state) => {
    const newPages = new Map(state.pages)
    const existing = newPages.get(id)
    if (existing) {
      newPages.set(id, {
        ...existing,
        ...updates,
        updated: Date.now(),
        version: existing.version + 1,
      })
    }
    return { pages: newPages }
  }),

  removePage: (id) => set((state) => {
    const newPages = new Map(state.pages)
    newPages.delete(id)
    return { pages: newPages }
  }),

  addCategory: (category) => set((state) => {
    const newCategories = new Map(state.categories)
    newCategories.set(category.id, category)
    return { categories: newCategories }
  }),

  removeCategory: (id) => set((state) => {
    const newCategories = new Map(state.categories)
    newCategories.delete(id)
    return { categories: newCategories }
  }),

  getPage: (id) => get().pages.get(id),

  getPagesByGroup: (groupId) => {
    return Array.from(get().pages.values())
      .filter(p => p.groupId === groupId)
      .sort((a, b) => b.updated - a.updated)
  },

  getPagesByCategory: (groupId, category) => {
    return Array.from(get().pages.values())
      .filter(p => p.groupId === groupId && p.category === category)
      .sort((a, b) => b.updated - a.updated)
  },

  searchPages: (groupId, query) => {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(get().pages.values())
      .filter(p =>
        p.groupId === groupId &&
        (p.title.toLowerCase().includes(lowercaseQuery) ||
         p.content.toLowerCase().includes(lowercaseQuery) ||
         p.tags.some(t => t.toLowerCase().includes(lowercaseQuery)))
      )
      .sort((a, b) => b.updated - a.updated)
  },

  getCategories: (groupId) => {
    return Array.from(get().categories.values())
      .filter(c => c.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },
}))
