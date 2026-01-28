/**
 * Training Module Integrations
 * Cross-module integration services
 */

export { TrainingCallingIntegration, getTrainingCallingIntegration } from './callingIntegration';
export { TrainingCRMIntegration, getTrainingCRMIntegration } from './crmIntegration';
export { TrainingEventsIntegration, getTrainingEventsIntegration } from './eventsIntegration';

// Re-export types
export type { TrainingConferenceConfig } from './callingIntegration';
export type { ContactTrainingInfo, TrainingRequirement } from './crmIntegration';
export type { TrainingEventConfig, TrainingLinkedEvent } from './eventsIntegration';
