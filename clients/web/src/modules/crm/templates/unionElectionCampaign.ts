/**
 * Union Election Campaign CRM Template
 * For labor union organizing drives and NLRB election campaigns
 *
 * Tables:
 * - Workers: Individual workers being organized
 * - House Visits: One-on-one organizing conversations
 * - Authorization Cards: Union card signing tracking
 * - Organizers: Staff and volunteer organizers
 * - Anti-Union Activity: Documenting employer interference/ULPs
 * - Campaign Milestones: NLRB timeline and key dates
 */

import type { CRMMultiTableTemplate } from '../types';
import { CRM_FIELD_PRESETS } from '../types';

export const unionElectionCampaignTemplate: CRMMultiTableTemplate = {
  id: 'union-election-campaign',
  name: 'Union Election Campaign',
  description:
    'Track workers, house visits, authorization cards, and NLRB processes for union organizing drives',
  icon: '✊',
  category: 'organizing',
  version: '1.0.0',
  author: 'BuildIt Network',

  integrations: {
    events: true,
    files: true,
    messaging: true,
    forms: true,
  },

  tables: [
    {
      key: 'workers',
      name: 'Workers',
      description: 'Individual workers being organized',
      icon: '👷',
      isPrimary: true,
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 2,
        },
        {
          name: 'department',
          label: 'Department',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Department or work area' },
          order: 3,
        },
        {
          name: 'job_title',
          label: 'Job Title',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Job title/classification' },
          order: 4,
        },
        {
          name: 'shift',
          label: 'Shift',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'day', label: 'Day Shift' },
              { value: 'swing', label: 'Swing Shift' },
              { value: 'night', label: 'Night Shift' },
              { value: 'weekend', label: 'Weekend' },
              { value: 'variable', label: 'Variable' },
            ],
          },
          order: 5,
        },
        {
          name: 'hire_date',
          label: 'Hire Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          name: 'support_level',
          label: 'Support Level',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'unknown', label: '❓ Unknown' },
              { value: 'leader', label: '🔥 Leader (Organizing Committee)' },
              { value: 'strong_yes', label: '💪 Strong Yes' },
              { value: 'yes', label: '✅ Yes' },
              { value: 'leaning_yes', label: '↗️ Leaning Yes' },
              { value: 'undecided', label: '⚖️ Undecided' },
              { value: 'leaning_no', label: '↘️ Leaning No' },
              { value: 'no', label: '❌ No' },
              { value: 'strong_no', label: '🚫 Strong No' },
            ],
          },
          order: 7,
        },
        {
          name: 'card_status',
          label: 'Authorization Card',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'not_asked', label: 'Not Asked' },
              { value: 'asked', label: 'Asked' },
              { value: 'signed', label: '✅ Signed' },
              { value: 'refused', label: 'Refused' },
              { value: 'lost', label: 'Lost/Invalid' },
            ],
          },
          order: 8,
        },
        {
          name: 'card_signed_date',
          label: 'Card Signed Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 9,
        },
        {
          name: 'issues',
          label: 'Workplace Issues',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'wages', label: 'Low Wages' },
              { value: 'benefits', label: 'Poor Benefits' },
              { value: 'safety', label: 'Safety Concerns' },
              { value: 'scheduling', label: 'Scheduling Problems' },
              { value: 'favoritism', label: 'Favoritism/Discrimination' },
              { value: 'harassment', label: 'Harassment' },
              { value: 'workload', label: 'Excessive Workload' },
              { value: 'respect', label: 'Lack of Respect' },
              { value: 'job_security', label: 'Job Security' },
              { value: 'discipline', label: 'Unfair Discipline' },
            ],
          },
          order: 10,
        },
        {
          name: 'languages',
          label: 'Languages',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'english', label: 'English' },
              { value: 'spanish', label: 'Spanish' },
              { value: 'chinese', label: 'Chinese' },
              { value: 'vietnamese', label: 'Vietnamese' },
              { value: 'tagalog', label: 'Tagalog' },
              { value: 'korean', label: 'Korean' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 11,
        },
        {
          name: 'address',
          label: 'Home Address',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Home address for house visits' },
          order: 12,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          order: 13,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 14,
        },
      ],
      defaultViews: [
        {
          name: 'All Workers',
          type: 'table',
          config: {
            visibleFields: [
              'full_name',
              'department',
              'support_level',
              'card_status',
              'phone',
            ],
          },
        },
        {
          name: 'By Support Level',
          type: 'board',
          config: {
            boardGroupBy: 'support_level',
            boardCardTitleField: 'full_name',
            boardCardFields: ['department', 'card_status', 'issues'],
          },
        },
        {
          name: 'Card Signers',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'department', 'card_signed_date', 'support_level'],
          },
          filters: [{ fieldName: 'card_status', operator: 'equals', value: 'signed' }],
          sorts: [{ fieldName: 'card_signed_date', direction: 'desc' }],
        },
        {
          name: 'By Department',
          type: 'board',
          config: {
            boardGroupBy: 'department',
            boardCardTitleField: 'full_name',
            boardCardFields: ['support_level', 'card_status'],
          },
        },
        {
          name: 'Leaders (OC)',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'department', 'shift', 'phone', 'issues'],
          },
          filters: [{ fieldName: 'support_level', operator: 'equals', value: 'leader' }],
        },
        {
          name: 'Need to Ask',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'department', 'support_level', 'phone'],
          },
          filters: [
            { fieldName: 'card_status', operator: 'equals', value: 'not_asked' },
            { fieldName: 'support_level', operator: 'not-equals', value: 'unknown' },
          ],
        },
      ],
    },
    {
      key: 'house_visits',
      name: 'House Visits',
      description: 'One-on-one organizing conversations',
      icon: '🏠',
      fields: [
        {
          name: 'date',
          label: 'Visit Date',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 0,
        },
        {
          name: 'visit_type',
          label: 'Visit Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'house_visit', label: 'House Visit' },
              { value: 'one_on_one', label: 'One-on-One (Work)' },
              { value: 'phone_call', label: 'Phone Call' },
              { value: 'small_group', label: 'Small Group Meeting' },
            ],
          },
          order: 1,
        },
        {
          name: 'result',
          label: 'Result',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'card_signed', label: '✅ Card Signed' },
              { value: 'positive', label: '👍 Positive Conversation' },
              { value: 'moved', label: '↗️ Moved Closer' },
              { value: 'no_change', label: '➖ No Change' },
              { value: 'negative', label: '👎 Negative Response' },
              { value: 'not_home', label: '🚪 Not Home' },
              { value: 'refused_to_talk', label: '🚫 Refused to Talk' },
              { value: 'wrong_address', label: '❓ Wrong Address' },
            ],
          },
          order: 2,
        },
        {
          name: 'issues_discussed',
          label: 'Issues Discussed',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'wages', label: 'Wages' },
              { value: 'benefits', label: 'Benefits' },
              { value: 'safety', label: 'Safety' },
              { value: 'respect', label: 'Respect/Dignity' },
              { value: 'scheduling', label: 'Scheduling' },
              { value: 'management', label: 'Management Issues' },
              { value: 'job_security', label: 'Job Security' },
              { value: 'union_basics', label: 'Union Basics' },
            ],
          },
          order: 3,
        },
        {
          name: 'concerns',
          label: 'Concerns/Fears',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'retaliation', label: 'Fear of Retaliation' },
              { value: 'dues', label: 'Union Dues' },
              { value: 'strikes', label: 'Strikes/Job Loss' },
              { value: 'company_happy', label: 'Happy with Company' },
              { value: 'privacy', label: 'Privacy Concerns' },
              { value: 'political', label: 'Political Concerns' },
              { value: 'coworkers', label: 'Coworker Pressure' },
              { value: 'management_pressure', label: 'Management Pressure' },
            ],
          },
          order: 4,
        },
        {
          name: 'follow_up_needed',
          label: 'Follow-up Needed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 5,
        },
        {
          name: 'follow_up_date',
          label: 'Follow-up Date',
          schema: { type: 'string', format: 'date' },
          widget: { widget: 'date' },
          order: 6,
        },
        {
          name: 'summary',
          label: 'Conversation Summary',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Key points from the conversation' },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          label: 'Private Notes',
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Visits',
          type: 'table',
          config: {
            visibleFields: ['date', 'visit_type', 'result', 'follow_up_needed'],
          },
          sorts: [{ fieldName: 'date', direction: 'desc' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'visit_type',
          },
        },
        {
          name: 'Needs Follow-up',
          type: 'table',
          config: {
            visibleFields: ['date', 'follow_up_date', 'result', 'summary'],
          },
          filters: [{ fieldName: 'follow_up_needed', operator: 'equals', value: true }],
          sorts: [{ fieldName: 'follow_up_date', direction: 'asc' }],
        },
        {
          name: 'By Result',
          type: 'board',
          config: {
            boardGroupBy: 'result',
            boardCardTitleField: 'date',
            boardCardFields: ['visit_type', 'summary'],
          },
        },
      ],
    },
    {
      key: 'authorization_cards',
      name: 'Authorization Cards',
      description: 'Union authorization card tracking',
      icon: '📋',
      fields: [
        {
          name: 'signed_date',
          label: 'Date Signed',
          schema: { type: 'string', format: 'date', required: true },
          widget: { widget: 'date' },
          order: 0,
        },
        {
          name: 'card_type',
          label: 'Card Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'authorization', label: 'Authorization Card' },
              { value: 'membership', label: 'Membership Card' },
              { value: 'petition', label: 'Petition Signature' },
            ],
          },
          order: 1,
        },
        {
          name: 'card_status',
          label: 'Card Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'collected', label: 'Collected' },
              { value: 'submitted', label: 'Submitted to NLRB' },
              { value: 'verified', label: 'Verified' },
              { value: 'challenged', label: 'Challenged' },
              { value: 'invalid', label: 'Invalid' },
            ],
          },
          order: 2,
        },
        {
          name: 'collected_by',
          label: 'Collected By',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Name of collector' },
          order: 3,
        },
        {
          name: 'witness',
          label: 'Witness',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Witness name (if applicable)' },
          order: 4,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 5,
        },
      ],
      defaultViews: [
        {
          name: 'All Cards',
          type: 'table',
          config: {
            visibleFields: ['signed_date', 'card_type', 'card_status', 'collected_by'],
          },
          sorts: [{ fieldName: 'signed_date', direction: 'desc' }],
        },
        {
          name: 'By Status',
          type: 'board',
          config: {
            boardGroupBy: 'card_status',
            boardCardTitleField: 'signed_date',
            boardCardFields: ['card_type', 'collected_by'],
          },
        },
      ],
    },
    {
      key: 'organizers',
      name: 'Organizers',
      description: 'Staff and volunteer organizers',
      icon: '🎯',
      fields: [
        {
          ...CRM_FIELD_PRESETS.full_name,
          order: 0,
        },
        {
          ...CRM_FIELD_PRESETS.pubkey,
          label: 'Nostr Profile',
          order: 1,
        },
        {
          ...CRM_FIELD_PRESETS.phone,
          order: 2,
        },
        {
          ...CRM_FIELD_PRESETS.email,
          order: 3,
        },
        {
          name: 'role',
          label: 'Role',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'lead', label: 'Lead Organizer' },
              { value: 'staff', label: 'Staff Organizer' },
              { value: 'oc_member', label: 'Organizing Committee' },
              { value: 'volunteer', label: 'Volunteer' },
              { value: 'intern', label: 'Intern' },
            ],
          },
          order: 4,
        },
        {
          name: 'assigned_areas',
          label: 'Assigned Areas',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'house_visits', label: 'House Visits' },
              { value: 'worksite', label: 'Worksite Organizing' },
              { value: 'data', label: 'Data/Cards' },
              { value: 'communications', label: 'Communications' },
              { value: 'legal', label: 'Legal/NLRB' },
              { value: 'research', label: 'Research' },
            ],
          },
          order: 5,
        },
        {
          name: 'languages',
          label: 'Languages',
          schema: { type: 'array' },
          widget: {
            widget: 'multi-select',
            options: [
              { value: 'english', label: 'English' },
              { value: 'spanish', label: 'Spanish' },
              { value: 'chinese', label: 'Chinese' },
              { value: 'vietnamese', label: 'Vietnamese' },
              { value: 'tagalog', label: 'Tagalog' },
              { value: 'korean', label: 'Korean' },
            ],
          },
          order: 6,
        },
        {
          name: 'active',
          label: 'Active',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 7,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 8,
        },
      ],
      defaultViews: [
        {
          name: 'All Organizers',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'role', 'assigned_areas', 'languages', 'active'],
          },
        },
        {
          name: 'By Role',
          type: 'board',
          config: {
            boardGroupBy: 'role',
            boardCardTitleField: 'full_name',
            boardCardFields: ['assigned_areas', 'languages'],
          },
        },
        {
          name: 'Active',
          type: 'table',
          config: {
            visibleFields: ['full_name', 'role', 'phone', 'assigned_areas'],
          },
          filters: [{ fieldName: 'active', operator: 'equals', value: true }],
        },
      ],
    },
    {
      key: 'anti_union_activity',
      name: 'Anti-Union Activity',
      description: 'Documenting employer interference and ULPs',
      icon: '⚠️',
      fields: [
        {
          name: 'incident_date',
          label: 'Incident Date',
          schema: { type: 'string', format: 'date-time', required: true },
          widget: { widget: 'datetime' },
          order: 0,
        },
        {
          name: 'incident_type',
          label: 'Incident Type',
          schema: { type: 'string', required: true },
          widget: {
            widget: 'select',
            options: [
              { value: 'captive_meeting', label: 'Captive Audience Meeting' },
              { value: 'one_on_one', label: 'Management One-on-One' },
              { value: 'threat', label: 'Threat/Intimidation' },
              { value: 'surveillance', label: 'Surveillance' },
              { value: 'interrogation', label: 'Interrogation' },
              { value: 'promise', label: 'Promise of Benefits' },
              { value: 'retaliation', label: 'Retaliation/Discipline' },
              { value: 'termination', label: 'Termination' },
              { value: 'propaganda', label: 'Anti-Union Propaganda' },
              { value: 'outside_consultant', label: 'Union Busters/Consultants' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 1,
        },
        {
          name: 'severity',
          label: 'Severity',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'low', label: '🟢 Low' },
              { value: 'medium', label: '🟡 Medium' },
              { value: 'high', label: '🟠 High' },
              { value: 'critical', label: '🔴 Critical (Potential ULP)' },
            ],
          },
          order: 2,
        },
        {
          name: 'perpetrator',
          label: 'Perpetrator',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Manager/supervisor name' },
          order: 3,
        },
        {
          name: 'location',
          label: 'Location',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Where did it occur?' },
          order: 4,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string', required: true },
          widget: { widget: 'textarea', placeholder: 'Detailed description of what happened' },
          order: 5,
        },
        {
          name: 'witnesses',
          label: 'Witnesses',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Names of witnesses' },
          order: 6,
        },
        {
          name: 'ulp_filed',
          label: 'ULP Filed',
          schema: { type: 'boolean' },
          widget: { widget: 'checkbox' },
          order: 7,
        },
        {
          name: 'ulp_case_number',
          label: 'ULP Case Number',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'NLRB case number' },
          order: 8,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'documented', label: 'Documented' },
              { value: 'investigating', label: 'Investigating' },
              { value: 'ulp_filed', label: 'ULP Filed' },
              { value: 'ulp_pending', label: 'ULP Pending' },
              { value: 'ulp_won', label: 'ULP Won' },
              { value: 'ulp_lost', label: 'ULP Lost' },
              { value: 'resolved', label: 'Resolved' },
            ],
          },
          order: 9,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 10,
        },
      ],
      defaultViews: [
        {
          name: 'All Incidents',
          type: 'table',
          config: {
            visibleFields: ['incident_date', 'incident_type', 'severity', 'status'],
          },
          sorts: [{ fieldName: 'incident_date', direction: 'desc' }],
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'incident_type',
            boardCardTitleField: 'incident_date',
            boardCardFields: ['severity', 'perpetrator'],
          },
        },
        {
          name: 'By Severity',
          type: 'board',
          config: {
            boardGroupBy: 'severity',
            boardCardTitleField: 'incident_type',
            boardCardFields: ['incident_date', 'perpetrator'],
          },
        },
        {
          name: 'ULP Cases',
          type: 'table',
          config: {
            visibleFields: ['incident_date', 'incident_type', 'ulp_case_number', 'status'],
          },
          filters: [{ fieldName: 'ulp_filed', operator: 'equals', value: true }],
        },
        {
          name: 'Critical Incidents',
          type: 'table',
          config: {
            visibleFields: ['incident_date', 'incident_type', 'description', 'witnesses'],
          },
          filters: [{ fieldName: 'severity', operator: 'equals', value: 'critical' }],
        },
      ],
    },
    {
      key: 'campaign_milestones',
      name: 'Campaign Milestones',
      description: 'NLRB timeline and key campaign dates',
      icon: '📆',
      fields: [
        {
          name: 'title',
          label: 'Milestone',
          schema: { type: 'string', required: true },
          widget: { widget: 'text', placeholder: 'Milestone name' },
          order: 0,
        },
        {
          name: 'date',
          label: 'Date',
          schema: { type: 'string', format: 'date', required: true },
          widget: { widget: 'date' },
          order: 1,
        },
        {
          name: 'milestone_type',
          label: 'Type',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'campaign_start', label: 'Campaign Start' },
              { value: 'card_drive', label: 'Card Drive' },
              { value: 'petition_filed', label: 'Petition Filed' },
              { value: 'nlrb_hearing', label: 'NLRB Hearing' },
              { value: 'election_date', label: 'Election Date' },
              { value: 'vote_count', label: 'Vote Count' },
              { value: 'certification', label: 'Certification' },
              { value: 'bargaining_start', label: 'Bargaining Start' },
              { value: 'deadline', label: 'Deadline' },
              { value: 'meeting', label: 'Important Meeting' },
              { value: 'action', label: 'Action/Event' },
              { value: 'other', label: 'Other' },
            ],
          },
          order: 2,
        },
        {
          name: 'status',
          label: 'Status',
          schema: { type: 'string' },
          widget: {
            widget: 'select',
            options: [
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'missed', label: 'Missed' },
              { value: 'rescheduled', label: 'Rescheduled' },
            ],
          },
          order: 3,
        },
        {
          name: 'description',
          label: 'Description',
          schema: { type: 'string' },
          widget: { widget: 'textarea', placeholder: 'Details about this milestone' },
          order: 4,
        },
        {
          name: 'responsible',
          label: 'Responsible',
          schema: { type: 'string' },
          widget: { widget: 'text', placeholder: 'Person/team responsible' },
          order: 5,
        },
        {
          ...CRM_FIELD_PRESETS.notes,
          order: 6,
        },
      ],
      defaultViews: [
        {
          name: 'Timeline',
          type: 'table',
          config: {
            visibleFields: ['date', 'title', 'milestone_type', 'status'],
          },
          sorts: [{ fieldName: 'date', direction: 'asc' }],
        },
        {
          name: 'Calendar',
          type: 'calendar',
          config: {
            calendarDateField: 'date',
            calendarTitleField: 'title',
          },
        },
        {
          name: 'Upcoming',
          type: 'table',
          config: {
            visibleFields: ['date', 'title', 'milestone_type', 'responsible'],
          },
          filters: [{ fieldName: 'status', operator: 'equals', value: 'upcoming' }],
          sorts: [{ fieldName: 'date', direction: 'asc' }],
        },
        {
          name: 'By Type',
          type: 'board',
          config: {
            boardGroupBy: 'milestone_type',
            boardCardTitleField: 'title',
            boardCardFields: ['date', 'status'],
          },
        },
      ],
    },
  ],

  relationships: [
    // House Visit -> Worker
    {
      sourceTable: 'house_visits',
      sourceField: 'worker_id',
      targetTable: 'workers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Worker',
      required: true,
      onDelete: 'cascade',
    },
    // House Visit -> Organizer
    {
      sourceTable: 'house_visits',
      sourceField: 'organizer_id',
      targetTable: 'organizers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Organizer',
      required: false,
      onDelete: 'set-null',
    },
    // Authorization Card -> Worker
    {
      sourceTable: 'authorization_cards',
      sourceField: 'worker_id',
      targetTable: 'workers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Worker',
      required: true,
      onDelete: 'cascade',
    },
    // Worker -> Assigned Organizer
    {
      sourceTable: 'workers',
      sourceField: 'assigned_organizer_id',
      targetTable: 'organizers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Assigned Organizer',
      required: false,
      onDelete: 'set-null',
    },
    // Anti-Union Activity -> Worker (affected workers)
    {
      sourceTable: 'anti_union_activity',
      sourceField: 'affected_worker_id',
      targetTable: 'workers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Affected Worker',
      required: false,
      onDelete: 'set-null',
    },
    // Anti-Union Activity -> Organizer (reported by)
    {
      sourceTable: 'anti_union_activity',
      sourceField: 'reported_by_id',
      targetTable: 'organizers',
      targetField: 'full_name',
      type: 'many-to-one',
      label: 'Reported By',
      required: false,
      onDelete: 'set-null',
    },
  ],

  seedData: {
    items: [
      {
        tableKey: 'organizers',
        records: [
          {
            full_name: 'Lead Organizer',
            phone: '555-0100',
            email: 'lead@union.org',
            role: 'lead',
            active: true,
            assigned_areas: ['house_visits', 'worksite', 'legal'],
            languages: ['english', 'spanish'],
          },
        ],
      },
      {
        tableKey: 'campaign_milestones',
        records: [
          {
            title: 'Campaign Launch',
            date: new Date().toISOString().split('T')[0],
            milestone_type: 'campaign_start',
            status: 'completed',
            description: 'Official start of organizing campaign',
          },
          {
            title: '30% Card Threshold',
            date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            milestone_type: 'card_drive',
            status: 'upcoming',
            description: 'Reach 30% showing of interest for NLRB petition',
          },
          {
            title: '50% Card Threshold',
            date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            milestone_type: 'card_drive',
            status: 'upcoming',
            description: 'Reach 50%+ for majority support before filing',
          },
        ],
      },
    ],
  },
};
