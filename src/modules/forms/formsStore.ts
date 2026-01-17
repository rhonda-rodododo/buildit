/**
 * Forms Module Store
 * Zustand store for forms and submissions
 */

import { create } from 'zustand';
import type {
  Form,
  FormSubmission,
  FormsState,
} from './types';

interface FormsStoreState extends FormsState {
  // ============================================================================
  // Form Actions
  // ============================================================================

  // CRUD
  addForm: (form: Form) => void;
  updateForm: (formId: string, updates: Partial<Form>) => void;
  deleteForm: (formId: string) => void;
  getForm: (formId: string) => Form | undefined;
  getFormsByGroup: (groupId: string) => Form[];
  getFormsByTable: (tableId: string) => Form[];
  getPublishedForms: (groupId: string) => Form[];

  // Submissions
  addSubmission: (submission: FormSubmission) => void;
  getSubmission: (submissionId: string) => FormSubmission | undefined;
  getSubmissionsByForm: (formId: string) => FormSubmission[];
  getSubmissionsByTable: (tableId: string) => FormSubmission[];
  flagSubmissionAsSpam: (submissionId: string) => void;
  markSubmissionProcessed: (submissionId: string) => void;

  // ============================================================================
  // Utility Actions
  // ============================================================================

  clearAll: () => void;
  loadData: (data: Partial<FormsState>) => void;
}

export const useFormsStore = create<FormsStoreState>()(
  (set, get) => ({
      // Initial state
      forms: new Map(),
      submissions: new Map(),
      loading: false,
      error: null,

      // ========================================================================
      // Form Actions
      // ========================================================================

      addForm: (form) => set((state) => {
        const newForms = new Map(state.forms);
        newForms.set(form.id, form);
        return { forms: newForms };
      }),

      updateForm: (formId, updates) => set((state) => {
        const newForms = new Map(state.forms);
        const existing = newForms.get(formId);
        if (existing) {
          newForms.set(formId, { ...existing, ...updates, updated: Date.now() });
        }
        return { forms: newForms };
      }),

      deleteForm: (formId) => set((state) => {
        const newForms = new Map(state.forms);
        newForms.delete(formId);

        // Also delete related submissions
        const newSubmissions = new Map(state.submissions);
        Array.from(newSubmissions.values())
          .filter((s) => s.formId === formId)
          .forEach((s) => newSubmissions.delete(s.id));

        return { forms: newForms, submissions: newSubmissions };
      }),

      getForm: (formId) => {
        return get().forms.get(formId);
      },

      getFormsByGroup: (groupId) => {
        return Array.from(get().forms.values()).filter((f) => f.groupId === groupId);
      },

      getFormsByTable: (tableId) => {
        return Array.from(get().forms.values()).filter((f) => f.tableId === tableId);
      },

      getPublishedForms: (groupId) => {
        return Array.from(get().forms.values())
          .filter((f) => f.groupId === groupId && f.status === 'published')
          .sort((a, b) => b.created - a.created);
      },

      // Submissions

      addSubmission: (submission) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        newSubmissions.set(submission.id, submission);
        return { submissions: newSubmissions };
      }),

      getSubmission: (submissionId) => {
        return get().submissions.get(submissionId);
      },

      getSubmissionsByForm: (formId) => {
        return Array.from(get().submissions.values())
          .filter((s) => s.formId === formId)
          .sort((a, b) => b.submittedAt - a.submittedAt);
      },

      getSubmissionsByTable: (tableId) => {
        return Array.from(get().submissions.values())
          .filter((s) => s.tableId === tableId)
          .sort((a, b) => b.submittedAt - a.submittedAt);
      },

      flagSubmissionAsSpam: (submissionId) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        const existing = newSubmissions.get(submissionId);
        if (existing) {
          newSubmissions.set(submissionId, { ...existing, flaggedAsSpam: true });
        }
        return { submissions: newSubmissions };
      }),

      markSubmissionProcessed: (submissionId) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        const existing = newSubmissions.get(submissionId);
        if (existing) {
          newSubmissions.set(submissionId, {
            ...existing,
            processed: true,
            processedAt: Date.now(),
          });
        }
        return { submissions: newSubmissions };
      }),

      // ========================================================================
      // Utility Actions
      // ========================================================================

      clearAll: () =>
        set({
          forms: new Map(),
          submissions: new Map(),
          loading: false,
          error: null,
        }),

      loadData: (data) =>
        set((state) => ({
          ...state,
          ...data,
        })),
    })
);
