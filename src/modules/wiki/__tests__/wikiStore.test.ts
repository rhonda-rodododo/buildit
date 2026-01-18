/**
 * WikiStore Tests
 * Tests for wiki pages and categories management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useWikiStore } from '../wikiStore';
import type { WikiPage, WikiCategory } from '../types';

describe('wikiStore', () => {
  beforeEach(() => {
    // Reset store state
    useWikiStore.setState({
      pages: {},
      categories: {},
    });
  });

  const createMockPage = (overrides: Partial<WikiPage> = {}): WikiPage => ({
    id: `page-${Date.now()}-${Math.random()}`,
    groupId: 'group-1',
    title: 'Test Page',
    content: 'Test content',
    category: 'general',
    tags: [],
    version: 1,
    created: Date.now(),
    updated: Date.now(),
    updatedBy: 'user-1',
    ...overrides,
  });

  const createMockCategory = (overrides: Partial<WikiCategory> = {}): WikiCategory => ({
    id: `category-${Date.now()}-${Math.random()}`,
    groupId: 'group-1',
    name: 'Test Category',
    description: 'A test category',
    pageCount: 0,
    ...overrides,
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useWikiStore.getState();
      expect(state.pages).toEqual({});
      expect(state.categories).toEqual({});
    });
  });

  describe('Pages', () => {
    describe('addPage', () => {
      it('should add a page', () => {
        const { addPage } = useWikiStore.getState();
        const page = createMockPage({ id: 'page-1' });

        addPage(page);

        const { pages } = useWikiStore.getState();
        expect(pages['page-1']).toBeDefined();
        expect(pages['page-1'].title).toBe('Test Page');
      });

      it('should add multiple pages', () => {
        const { addPage } = useWikiStore.getState();

        addPage(createMockPage({ id: 'page-1' }));
        addPage(createMockPage({ id: 'page-2' }));

        const { pages } = useWikiStore.getState();
        expect(Object.keys(pages)).toHaveLength(2);
      });
    });

    describe('updatePage', () => {
      it('should update an existing page', () => {
        const { addPage, updatePage } = useWikiStore.getState();
        addPage(createMockPage({ id: 'page-1', title: 'Original' }));

        updatePage('page-1', { title: 'Updated' });

        const { pages } = useWikiStore.getState();
        expect(pages['page-1'].title).toBe('Updated');
      });

      it('should update the updated timestamp', () => {
        const { addPage, updatePage } = useWikiStore.getState();
        addPage(createMockPage({ id: 'page-1', updated: 1000 }));

        updatePage('page-1', { content: 'New content' });

        const { pages } = useWikiStore.getState();
        expect(pages['page-1'].updated).toBeGreaterThan(1000);
      });

      it('should increment version number', () => {
        const { addPage, updatePage } = useWikiStore.getState();
        addPage(createMockPage({ id: 'page-1', version: 1 }));

        updatePage('page-1', { content: 'New content' });

        const { pages } = useWikiStore.getState();
        expect(pages['page-1'].version).toBe(2);
      });

      it('should not modify state for non-existent page', () => {
        const { updatePage } = useWikiStore.getState();

        updatePage('non-existent', { title: 'Updated' });

        const { pages } = useWikiStore.getState();
        expect(Object.keys(pages)).toHaveLength(0);
      });
    });

    describe('removePage', () => {
      it('should remove a page', () => {
        const { addPage, removePage } = useWikiStore.getState();
        addPage(createMockPage({ id: 'page-1' }));
        addPage(createMockPage({ id: 'page-2' }));

        removePage('page-1');

        const { pages } = useWikiStore.getState();
        expect(pages['page-1']).toBeUndefined();
        expect(pages['page-2']).toBeDefined();
      });
    });
  });

  describe('Categories', () => {
    describe('addCategory', () => {
      it('should add a category', () => {
        const { addCategory } = useWikiStore.getState();
        const category = createMockCategory({ id: 'cat-1', name: 'Category 1' });

        addCategory(category);

        const { categories } = useWikiStore.getState();
        expect(categories['cat-1']).toBeDefined();
        expect(categories['cat-1'].name).toBe('Category 1');
      });
    });

    describe('removeCategory', () => {
      it('should remove a category', () => {
        const { addCategory, removeCategory } = useWikiStore.getState();
        addCategory(createMockCategory({ id: 'cat-1' }));
        addCategory(createMockCategory({ id: 'cat-2' }));

        removeCategory('cat-1');

        const { categories } = useWikiStore.getState();
        expect(categories['cat-1']).toBeUndefined();
        expect(categories['cat-2']).toBeDefined();
      });
    });
  });

  describe('Getters', () => {
    describe('getPage', () => {
      it('should return page by id', () => {
        const { addPage, getPage } = useWikiStore.getState();
        addPage(createMockPage({ id: 'page-1', title: 'Test' }));

        const page = getPage('page-1');

        expect(page?.title).toBe('Test');
      });

      it('should return undefined for non-existent page', () => {
        const { getPage } = useWikiStore.getState();

        expect(getPage('non-existent')).toBeUndefined();
      });
    });

    describe('getPagesByGroup', () => {
      it('should filter pages by group', () => {
        const { addPage, getPagesByGroup } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', updated: 1000 }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-2', updated: 2000 }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', updated: 3000 }));

        const pages = getPagesByGroup('group-1');

        expect(pages).toHaveLength(2);
        expect(pages.every((p) => p.groupId === 'group-1')).toBe(true);
      });

      it('should sort pages by updated date descending', () => {
        const { addPage, getPagesByGroup } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', updated: 1000 }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', updated: 3000 }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', updated: 2000 }));

        const pages = getPagesByGroup('group-1');

        expect(pages[0].id).toBe('p2');
        expect(pages[1].id).toBe('p3');
        expect(pages[2].id).toBe('p1');
      });
    });

    describe('getPagesByCategory', () => {
      it('should filter pages by group and category', () => {
        const { addPage, getPagesByCategory } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', category: 'docs' }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', category: 'guides' }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', category: 'docs' }));
        addPage(createMockPage({ id: 'p4', groupId: 'group-2', category: 'docs' }));

        const docPages = getPagesByCategory('group-1', 'docs');

        expect(docPages).toHaveLength(2);
        expect(docPages.every((p) => p.category === 'docs')).toBe(true);
        expect(docPages.every((p) => p.groupId === 'group-1')).toBe(true);
      });
    });

    describe('searchPages', () => {
      it('should search by title', () => {
        const { addPage, searchPages } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', title: 'Getting Started' }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', title: 'API Reference' }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', title: 'Quick Start Guide' }));

        const results = searchPages('group-1', 'start');

        expect(results).toHaveLength(2);
        expect(results.some((p) => p.title === 'Getting Started')).toBe(true);
        expect(results.some((p) => p.title === 'Quick Start Guide')).toBe(true);
      });

      it('should search by content', () => {
        const { addPage, searchPages } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', title: 'Page 1', content: 'Contains the word authentication here' }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', title: 'Page 2', content: 'Different content' }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', title: 'Page 3', content: 'Also mentions authentication' }));

        const results = searchPages('group-1', 'authentication');

        expect(results).toHaveLength(2);
      });

      it('should search by tags', () => {
        const { addPage, searchPages } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', tags: ['javascript', 'tutorial'] }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', tags: ['python'] }));
        addPage(createMockPage({ id: 'p3', groupId: 'group-1', tags: ['javascript', 'advanced'] }));

        const results = searchPages('group-1', 'javascript');

        expect(results).toHaveLength(2);
      });

      it('should be case insensitive', () => {
        const { addPage, searchPages } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', title: 'UPPERCASE TITLE' }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-1', title: 'lowercase title' }));

        const results = searchPages('group-1', 'TITLE');

        expect(results).toHaveLength(2);
      });

      it('should only search within specified group', () => {
        const { addPage, searchPages } = useWikiStore.getState();
        addPage(createMockPage({ id: 'p1', groupId: 'group-1', title: 'Shared Title' }));
        addPage(createMockPage({ id: 'p2', groupId: 'group-2', title: 'Shared Title' }));

        const results = searchPages('group-1', 'shared');

        expect(results).toHaveLength(1);
        expect(results[0].groupId).toBe('group-1');
      });
    });

    describe('getCategories', () => {
      it('should filter categories by group', () => {
        const { addCategory, getCategories } = useWikiStore.getState();
        addCategory(createMockCategory({ id: 'c1', groupId: 'group-1', name: 'Category A' }));
        addCategory(createMockCategory({ id: 'c2', groupId: 'group-2', name: 'Category B' }));
        addCategory(createMockCategory({ id: 'c3', groupId: 'group-1', name: 'Category C' }));

        const categories = getCategories('group-1');

        expect(categories).toHaveLength(2);
        expect(categories.every((c) => c.groupId === 'group-1')).toBe(true);
      });

      it('should sort categories alphabetically by name', () => {
        const { addCategory, getCategories } = useWikiStore.getState();
        addCategory(createMockCategory({ id: 'c1', groupId: 'group-1', name: 'Zebra' }));
        addCategory(createMockCategory({ id: 'c2', groupId: 'group-1', name: 'Alpha' }));
        addCategory(createMockCategory({ id: 'c3', groupId: 'group-1', name: 'Beta' }));

        const categories = getCategories('group-1');

        expect(categories[0].name).toBe('Alpha');
        expect(categories[1].name).toBe('Beta');
        expect(categories[2].name).toBe('Zebra');
      });
    });
  });
});
