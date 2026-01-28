/**
 * Events Module Integrations
 * Cross-module integration services
 */

export {
  EventCallingIntegration,
  getEventCallingIntegration,
  type EventConferenceRoom,
  type JoinReminderConfig,
} from './callingIntegration';

export {
  VolunteerCallingIntegration,
  getVolunteerCallingIntegration,
  type TrainingRequirementStatus,
  type VolunteerRequirementsResult,
  type ShiftConfig,
  type OperatorPoolEntry,
} from './volunteerCallingIntegration';
