/**
 * CRM Module Seed Data
 * Provides example/template data for the CRM module
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import type { DBContact } from './schema';

import { logger } from '@/lib/logger';

/**
 * Generic example contacts (fallback)
 */
const exampleContactsSeed: ModuleSeed = {
  name: 'example-contacts',
  description: 'Example contacts for demonstration',
  data: async (groupId, _userPubkey) => {
    const exampleContacts: DBContact[] = [
      {
        id: `example-contact-1-${groupId}`,
        groupId,
        name: 'Jane Organizer',
        email: 'jane@example.com',
        phone: '555-0100',
        notes: 'Experienced union organizer, contact for labor campaigns',
        customFields: {
          role: 'Organizer',
          availability: 'Weekends',
          skills: ['Public Speaking', 'Strategy', 'Training'],
        },
        tags: ['organizer', 'labor', 'volunteer'],
        created: Date.now(),
        updated: Date.now(),
      },
      {
        id: `example-contact-2-${groupId}`,
        groupId,
        name: 'Alex Coordinator',
        email: 'alex@example.com',
        notes: 'Handles event logistics and mutual aid coordination',
        customFields: {
          role: 'Coordinator',
          availability: 'Flexible',
          skills: ['Logistics', 'Communication', 'Problem Solving'],
        },
        tags: ['coordinator', 'events', 'mutual-aid'],
        created: Date.now(),
        updated: Date.now(),
      },
    ];

    await dal.bulkPut('contacts', exampleContacts);
    logger.info(`Seeded ${exampleContacts.length} example contacts for group ${groupId}`);
  },
};

/**
 * Movement Legal Defense (NLG-style) CRM seed
 * Realistic arrestees, lawyers, legal observers, and cases
 */
const nlgMassDefenseSeed: ModuleSeed = {
  name: 'crm-nlg-demo',
  description: 'NLG-style mass defense contacts: arrestees, attorneys, legal observers, and cases',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      // Attorneys
      {
        id: `nlg-attorney-1-${groupId}`,
        groupId,
        name: 'Patricia Hernandez',
        phone: '555-0201',
        notes: 'NLG member attorney. Handles misdemeanor protest cases. Available for arraignments on short notice.',
        customFields: {
          role: 'Attorney',
          barNumber: 'CA-298134',
          specialization: 'Criminal Defense - Protest Law',
          availability: 'On-call weekends',
          languages: ['English', 'Spanish'],
          maxCaseload: 8,
          currentCases: 3,
        },
        tags: ['attorney', 'nlg', 'criminal-defense', 'available'],
        created: now - 90 * day,
        updated: now - 2 * day,
      },
      {
        id: `nlg-attorney-2-${groupId}`,
        groupId,
        name: 'David Chen',
        phone: '555-0202',
        notes: 'Civil rights attorney. Takes felony cases and civil suits against police. Pro bono for movement cases.',
        customFields: {
          role: 'Attorney',
          barNumber: 'CA-312456',
          specialization: 'Civil Rights Litigation',
          availability: 'Weekdays',
          languages: ['English', 'Mandarin'],
          maxCaseload: 5,
          currentCases: 4,
        },
        tags: ['attorney', 'civil-rights', 'felony', 'pro-bono'],
        created: now - 120 * day,
        updated: now - 5 * day,
      },

      // Legal Observers
      {
        id: `nlg-observer-1-${groupId}`,
        groupId,
        name: 'Aisha Johnson',
        phone: '555-0210',
        notes: 'Lead legal observer. NLG-trained, 3 years experience. Certified in protest documentation.',
        customFields: {
          role: 'Legal Observer',
          certificationDate: new Date(now - 365 * day).toISOString().split('T')[0],
          deploymentsCompleted: 24,
          availability: 'Weekends and evenings',
          equipment: ['Body camera', 'Legal observer vest', 'Notepad kit'],
        },
        tags: ['legal-observer', 'lead', 'nlg-trained', 'available'],
        created: now - 200 * day,
        updated: now - 1 * day,
      },
      {
        id: `nlg-observer-2-${groupId}`,
        groupId,
        name: 'Marcus Rivera',
        phone: '555-0211',
        notes: 'Legal observer trainee. Completed basic NLG training, shadowing on next deployment.',
        customFields: {
          role: 'Legal Observer',
          certificationDate: new Date(now - 30 * day).toISOString().split('T')[0],
          deploymentsCompleted: 2,
          availability: 'Flexible',
          equipment: ['Legal observer vest', 'Notepad kit'],
        },
        tags: ['legal-observer', 'trainee', 'nlg-trained'],
        created: now - 45 * day,
        updated: now - 10 * day,
      },

      // Intake Coordinators
      {
        id: `nlg-intake-1-${groupId}`,
        groupId,
        name: 'Sam Okafor',
        phone: '555-0220',
        notes: 'Intake coordinator. Handles initial contact with arrestees and assigns attorneys. Speaks three languages.',
        customFields: {
          role: 'Intake Coordinator',
          availability: 'On-call 24/7 during actions',
          languages: ['English', 'Yoruba', 'French'],
          intakesProcessed: 47,
        },
        tags: ['intake', 'coordinator', 'multilingual', 'available'],
        created: now - 180 * day,
        updated: now - 3 * day,
      },

      // Hotline Operators
      {
        id: `nlg-hotline-1-${groupId}`,
        groupId,
        name: 'Taylor Kim',
        phone: '555-0230',
        notes: 'Jail support hotline operator. Trained in de-escalation and crisis support. Available for overnight shifts.',
        customFields: {
          role: 'Hotline Operator',
          availability: 'Overnight shifts (10pm-6am)',
          shiftsCompleted: 32,
          trainingCompleted: ['Crisis de-escalation', 'Jail procedures', 'Know Your Rights'],
        },
        tags: ['hotline', 'jail-support', 'overnight', 'available'],
        created: now - 100 * day,
        updated: now - 7 * day,
      },

      // Arrestees (active cases)
      {
        id: `nlg-arrestee-1-${groupId}`,
        groupId,
        name: 'Jordan Blake',
        phone: '555-0240',
        notes: 'Arrested at housing rights sit-in on 1/15. Charged with trespassing and failure to disperse. Released on own recognizance. Arraignment scheduled.',
        customFields: {
          role: 'Arrestee',
          arrestDate: new Date(now - 15 * day).toISOString().split('T')[0],
          arrestLocation: 'City Hall lobby sit-in',
          charges: ['Trespassing', 'Failure to disperse'],
          caseNumber: 'CR-2026-00142',
          assignedAttorney: 'Patricia Hernandez',
          caseStatus: 'Pre-arraignment',
          bailStatus: 'Released OR',
          nextCourtDate: new Date(now + 10 * day).toISOString().split('T')[0],
        },
        tags: ['arrestee', 'active-case', 'housing-action', 'misdemeanor'],
        created: now - 15 * day,
        updated: now - 1 * day,
      },
      {
        id: `nlg-arrestee-2-${groupId}`,
        groupId,
        name: 'Maria Santos',
        phone: '555-0241',
        notes: 'Arrested at pipeline blockade on 1/10. Charged with criminal trespass and resisting arrest. Bail posted by solidarity fund. Attorney assigned.',
        customFields: {
          role: 'Arrestee',
          arrestDate: new Date(now - 20 * day).toISOString().split('T')[0],
          arrestLocation: 'Pipeline construction site blockade',
          charges: ['Criminal trespass', 'Resisting arrest'],
          caseNumber: 'CR-2026-00128',
          assignedAttorney: 'David Chen',
          caseStatus: 'Discovery phase',
          bailStatus: 'Bail posted ($2,500)',
          nextCourtDate: new Date(now + 5 * day).toISOString().split('T')[0],
          medicalNeeds: 'Pepper spray exposure - followed up with medics',
        },
        tags: ['arrestee', 'active-case', 'climate-action', 'misdemeanor'],
        created: now - 20 * day,
        updated: now - 3 * day,
      },
      {
        id: `nlg-arrestee-3-${groupId}`,
        groupId,
        name: 'Kwame Asante',
        notes: 'Arrested at ICE facility protest on 12/20. Charges dropped after video evidence showed lawful assembly. Case closed.',
        customFields: {
          role: 'Arrestee',
          arrestDate: new Date(now - 40 * day).toISOString().split('T')[0],
          arrestLocation: 'ICE detention facility protest',
          charges: ['Disorderly conduct (DROPPED)'],
          caseNumber: 'CR-2025-04892',
          assignedAttorney: 'Patricia Hernandez',
          caseStatus: 'Charges dropped',
          bailStatus: 'N/A',
          resolution: 'Charges dropped - legal observer video proved lawful assembly',
        },
        tags: ['arrestee', 'resolved', 'charges-dropped', 'immigration-action'],
        created: now - 40 * day,
        updated: now - 25 * day,
      },

      // Volunteers
      {
        id: `nlg-volunteer-1-${groupId}`,
        groupId,
        name: 'Robin Vasquez',
        phone: '555-0250',
        notes: 'General volunteer. Helps with jail support logistics, court accompaniment, and phone tree.',
        customFields: {
          role: 'Volunteer',
          availability: 'Evenings and weekends',
          skills: ['Court accompaniment', 'Phone tree', 'Transportation'],
          backgroundCheck: true,
        },
        tags: ['volunteer', 'jail-support', 'court-accompaniment', 'available'],
        created: now - 60 * day,
        updated: now - 14 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} NLG mass defense contacts for group ${groupId}`);
  },
};

/**
 * Street Medics Collective CRM seed
 * Medics, trainers, supply coordinators, and deployment records
 */
const streetMedicsSeed: ModuleSeed = {
  name: 'crm-street-medics-demo',
  description: 'Street medics contacts: medics, trainers, supply coordinators with certifications and deployment history',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      // Lead Medics
      {
        id: `medic-lead-1-${groupId}`,
        groupId,
        name: 'Dr. Luz Reyes',
        phone: '555-0301',
        notes: 'Lead medic and trainer. ER nurse by profession. Certified street medic since 2019. Coordinates all field deployments.',
        customFields: {
          role: 'Lead Medic',
          certifications: ['Street Medic (20hr)', 'Wilderness First Responder', 'CPR/AED Instructor'],
          certExpiry: new Date(now + 180 * day).toISOString().split('T')[0],
          professionalBackground: 'ER Nurse (RN)',
          deploymentsCompleted: 45,
          availability: 'Weekends, on-call for emergencies',
          specializations: ['Trauma', 'Chemical exposure', 'Heat/cold injuries'],
          personalKit: true,
        },
        tags: ['lead-medic', 'trainer', 'certified', 'available'],
        created: now - 365 * day,
        updated: now - 2 * day,
      },
      {
        id: `medic-lead-2-${groupId}`,
        groupId,
        name: 'Jamal Washington',
        phone: '555-0302',
        notes: 'Lead medic and supply coordinator. EMT by profession. Manages collective supply inventory and buddy system assignments.',
        customFields: {
          role: 'Lead Medic',
          certifications: ['Street Medic (20hr)', 'EMT-B', 'CPR/AED'],
          certExpiry: new Date(now + 90 * day).toISOString().split('T')[0],
          professionalBackground: 'EMT-Basic',
          deploymentsCompleted: 38,
          availability: 'Flexible - shift work schedule',
          specializations: ['Triage', 'Respiratory emergencies', 'Supply management'],
          personalKit: true,
        },
        tags: ['lead-medic', 'supply-coordinator', 'certified', 'available'],
        created: now - 300 * day,
        updated: now - 5 * day,
      },

      // Trainers
      {
        id: `medic-trainer-1-${groupId}`,
        groupId,
        name: 'Priya Sharma',
        phone: '555-0310',
        notes: 'Trainer specializing in chemical exposure response and de-escalation first aid. Runs quarterly 20-hour street medic trainings.',
        customFields: {
          role: 'Trainer',
          certifications: ['Street Medic (20hr)', 'Wilderness First Aid', 'HAZMAT Awareness'],
          certExpiry: new Date(now + 270 * day).toISOString().split('T')[0],
          trainingsLed: 12,
          trainingTopics: ['Chemical agent response', 'Wound care', 'Mental health first aid'],
          availability: 'Weekends for trainings',
          personalKit: true,
        },
        tags: ['trainer', 'certified', 'chemical-exposure', 'available'],
        created: now - 250 * day,
        updated: now - 10 * day,
      },

      // Active Street Medics
      {
        id: `medic-active-1-${groupId}`,
        groupId,
        name: 'Casey O\'Brien',
        phone: '555-0320',
        notes: 'Street medic with 1 year field experience. Reliable for both planned actions and rapid response. Has personal medic kit.',
        customFields: {
          role: 'Street Medic',
          certifications: ['Street Medic (20hr)', 'CPR/AED'],
          certExpiry: new Date(now + 150 * day).toISOString().split('T')[0],
          deploymentsCompleted: 15,
          availability: 'Weekends and some evenings',
          specializations: ['General first aid', 'Pepper spray decontamination'],
          personalKit: true,
          buddyPreference: 'Dr. Luz Reyes',
        },
        tags: ['street-medic', 'certified', 'available'],
        created: now - 365 * day,
        updated: now - 7 * day,
      },
      {
        id: `medic-active-2-${groupId}`,
        groupId,
        name: 'Noor Hassan',
        phone: '555-0321',
        notes: 'Street medic. Fluent in Arabic and English. Specializes in mental health first aid and panic response.',
        customFields: {
          role: 'Street Medic',
          certifications: ['Street Medic (20hr)', 'Mental Health First Aid', 'CPR'],
          certExpiry: new Date(now + 200 * day).toISOString().split('T')[0],
          deploymentsCompleted: 8,
          availability: 'Evenings and weekends',
          languages: ['English', 'Arabic'],
          specializations: ['Mental health crisis', 'Panic/anxiety response', 'General first aid'],
          personalKit: true,
        },
        tags: ['street-medic', 'certified', 'multilingual', 'mental-health', 'available'],
        created: now - 180 * day,
        updated: now - 3 * day,
      },

      // Trainees
      {
        id: `medic-trainee-1-${groupId}`,
        groupId,
        name: 'Alex Torres',
        phone: '555-0330',
        notes: 'Currently in training. Completed first 10 hours of 20-hour course. Next session Feb 15. Shadowed 2 deployments.',
        customFields: {
          role: 'Trainee',
          trainingProgress: '10/20 hours completed',
          nextTrainingDate: new Date(now + 16 * day).toISOString().split('T')[0],
          shadowDeployments: 2,
          availability: 'Weekends',
          personalKit: false,
        },
        tags: ['trainee', 'in-training'],
        created: now - 30 * day,
        updated: now - 5 * day,
      },

      // Supply Coordinator
      {
        id: `medic-supply-1-${groupId}`,
        groupId,
        name: 'Morgan Lee',
        phone: '555-0340',
        notes: 'Supply coordinator. Maintains collective kit inventory, coordinates resupply, and distributes kits before deployments.',
        customFields: {
          role: 'Supply Coordinator',
          inventoryLocation: 'Storage unit #47, Oak Street',
          lastInventoryDate: new Date(now - 14 * day).toISOString().split('T')[0],
          availability: 'Weekdays after 5pm',
          budgetRemaining: '$340',
          supplyNeeds: ['Saline solution', 'SAM splints', 'Burn gel', 'Nitrile gloves (L)'],
        },
        tags: ['supply-coordinator', 'logistics', 'available'],
        created: now - 200 * day,
        updated: now - 14 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} street medics contacts for group ${groupId}`);
  },
};

/**
 * Community Self-Defense Collective CRM seed
 * Safety marshals, de-escalation teams, and incident records
 */
const selfDefenseSeed: ModuleSeed = {
  name: 'crm-self-defense-demo',
  description: 'Self-defense collective contacts: safety marshals, de-escalation specialists, trainers, and coordinators',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      // Lead Coordinators
      {
        id: `defense-lead-1-${groupId}`,
        groupId,
        name: 'Darius Moore',
        phone: '555-0401',
        notes: 'Lead coordinator. Former community organizer with 5 years in safety marshal work. Coordinates deployment strategy and team assignments.',
        customFields: {
          role: 'Lead Coordinator',
          certifications: ['De-escalation (40hr)', 'Crowd Safety', 'CPR/AED'],
          deploymentsCompleted: 52,
          availability: 'Flexible',
          specializations: ['Deployment strategy', 'Team coordination', 'Radio communications'],
          radioCallsign: 'Base-1',
        },
        tags: ['lead-coordinator', 'certified', 'available'],
        created: now - 400 * day,
        updated: now - 1 * day,
      },
      {
        id: `defense-lead-2-${groupId}`,
        groupId,
        name: 'Yuki Tanaka',
        phone: '555-0402',
        notes: 'Lead coordinator and primary trainer. Specializes in de-escalation and conflict resolution. Conducts monthly trainings.',
        customFields: {
          role: 'Lead Coordinator',
          certifications: ['De-escalation Instructor', 'Nonviolent Crisis Intervention', 'CPR/AED'],
          deploymentsCompleted: 38,
          trainingsLed: 18,
          availability: 'Weekends and evenings',
          specializations: ['De-escalation training', 'Conflict resolution', 'Community mediation'],
          radioCallsign: 'Base-2',
        },
        tags: ['lead-coordinator', 'trainer', 'certified', 'available'],
        created: now - 350 * day,
        updated: now - 3 * day,
      },

      // Safety Marshals
      {
        id: `defense-marshal-1-${groupId}`,
        groupId,
        name: 'Fatima Al-Rashid',
        phone: '555-0410',
        notes: 'Experienced safety marshal. Calm under pressure. Specializes in perimeter security and crowd flow management.',
        customFields: {
          role: 'Safety Marshal',
          certifications: ['De-escalation (20hr)', 'Crowd Safety', 'First Aid'],
          deploymentsCompleted: 22,
          availability: 'Weekends',
          specializations: ['Perimeter security', 'Crowd flow', 'VIP escort'],
          radioCallsign: 'Marshal-3',
          physicalRequirements: 'Can stand for 6+ hours',
        },
        tags: ['safety-marshal', 'certified', 'experienced', 'available'],
        created: now - 200 * day,
        updated: now - 7 * day,
      },
      {
        id: `defense-marshal-2-${groupId}`,
        groupId,
        name: 'Chris Blackwood',
        phone: '555-0411',
        notes: 'Safety marshal with focus on de-escalation with counter-protesters. Good at reading crowd dynamics.',
        customFields: {
          role: 'Safety Marshal',
          certifications: ['De-escalation (20hr)', 'Nonviolent Communication'],
          deploymentsCompleted: 14,
          availability: 'Evenings and weekends',
          specializations: ['Counter-protester de-escalation', 'Crowd reading', 'Communication'],
          radioCallsign: 'Marshal-5',
        },
        tags: ['safety-marshal', 'certified', 'de-escalation', 'available'],
        created: now - 150 * day,
        updated: now - 10 * day,
      },
      {
        id: `defense-marshal-3-${groupId}`,
        groupId,
        name: 'Elena Popov',
        phone: '555-0412',
        notes: 'Safety marshal. Multilingual (English, Russian, Ukrainian). Key asset for immigrant community events.',
        customFields: {
          role: 'Safety Marshal',
          certifications: ['De-escalation (20hr)', 'CPR'],
          deploymentsCompleted: 9,
          availability: 'Weekends',
          languages: ['English', 'Russian', 'Ukrainian'],
          specializations: ['Community liaison', 'Translation', 'Situational awareness'],
          radioCallsign: 'Marshal-7',
        },
        tags: ['safety-marshal', 'certified', 'multilingual', 'available'],
        created: now - 120 * day,
        updated: now - 5 * day,
      },

      // Trainees
      {
        id: `defense-trainee-1-${groupId}`,
        groupId,
        name: 'Jamie Nguyen',
        phone: '555-0420',
        notes: 'Trainee. Completed 10 of 20 hours de-escalation training. Shadowed 3 deployments. Enthusiastic and reliable.',
        customFields: {
          role: 'Trainee',
          trainingProgress: '10/20 hours completed',
          nextTrainingDate: new Date(now + 14 * day).toISOString().split('T')[0],
          shadowDeployments: 3,
          availability: 'Flexible',
        },
        tags: ['trainee', 'in-training'],
        created: now - 45 * day,
        updated: now - 7 * day,
      },
      {
        id: `defense-trainee-2-${groupId}`,
        groupId,
        name: 'River Williams',
        phone: '555-0421',
        notes: 'New trainee. Just started basic de-escalation course. Background in social work.',
        customFields: {
          role: 'Trainee',
          trainingProgress: '4/20 hours completed',
          nextTrainingDate: new Date(now + 7 * day).toISOString().split('T')[0],
          shadowDeployments: 0,
          availability: 'Weekends only',
          professionalBackground: 'Social Worker',
        },
        tags: ['trainee', 'in-training', 'new'],
        created: now - 14 * day,
        updated: now - 7 * day,
      },

      // Communications Coordinator
      {
        id: `defense-comms-1-${groupId}`,
        groupId,
        name: 'Quinn Ramirez',
        phone: '555-0430',
        notes: 'Communications coordinator. Manages radio channel assignments, maintains equipment, and runs comms during deployments.',
        customFields: {
          role: 'Communications Coordinator',
          certifications: ['FRS/GMRS Radio Operations', 'De-escalation (20hr)'],
          deploymentsCompleted: 30,
          availability: 'All major actions',
          equipment: ['6x Baofeng UV-5R radios', '2x repeater units', 'Charging station'],
          radioCallsign: 'Comms-1',
        },
        tags: ['communications', 'coordinator', 'radio', 'available'],
        created: now - 280 * day,
        updated: now - 2 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} self-defense collective contacts for group ${groupId}`);
  },
};

/**
 * Union Chapter CRM seed
 * Workers, stewards, organizers, and management contacts
 */
const unionChapterSeed: ModuleSeed = {
  name: 'crm-union-demo',
  description: 'Union chapter contacts: stewards, organizers, workers, and management contacts',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      {
        id: `union-steward-1-${groupId}`,
        groupId,
        name: 'Rosa Delgado',
        phone: '555-0501',
        notes: 'Chief steward, 2nd shift. 8 years seniority. Handles most grievances for warehouse workers.',
        customFields: {
          role: 'Shop Steward',
          department: 'Warehouse',
          shift: '2nd (3pm-11pm)',
          seniority: '8 years',
          grievancesHandled: 34,
          availability: 'Before/after shift',
        },
        tags: ['steward', 'warehouse', 'experienced', 'active'],
        created: now - 200 * day,
        updated: now - 3 * day,
      },
      {
        id: `union-steward-2-${groupId}`,
        groupId,
        name: 'Mike Thompson',
        phone: '555-0502',
        notes: 'Steward for maintenance crew. Good relationship with floor supervisors. Key contact for safety issues.',
        customFields: {
          role: 'Shop Steward',
          department: 'Maintenance',
          shift: '1st (7am-3pm)',
          seniority: '12 years',
          grievancesHandled: 18,
          availability: 'Lunch breaks, after shift',
        },
        tags: ['steward', 'maintenance', 'safety', 'active'],
        created: now - 300 * day,
        updated: now - 7 * day,
      },
      {
        id: `union-organizer-1-${groupId}`,
        groupId,
        name: 'Kenji Watanabe',
        phone: '555-0510',
        notes: 'Lead organizer. Running new member recruitment drive. Excellent one-on-one conversational skills.',
        customFields: {
          role: 'Organizer',
          focus: 'New member recruitment',
          newSignups: 23,
          availability: 'Full-time',
          languages: ['English', 'Japanese'],
        },
        tags: ['organizer', 'recruitment', 'active'],
        created: now - 150 * day,
        updated: now - 1 * day,
      },
      {
        id: `union-worker-1-${groupId}`,
        groupId,
        name: 'Angela Davis-Wright',
        phone: '555-0520',
        notes: 'Active member. Filed safety complaint about ventilation in Section C. Willing to testify at OSHA hearing.',
        customFields: {
          role: 'Member',
          department: 'Assembly',
          shift: '1st (7am-3pm)',
          seniority: '3 years',
          issues: ['Safety - ventilation', 'OSHA complaint pending'],
          willingToTestify: true,
        },
        tags: ['member', 'assembly', 'safety-complaint', 'osha'],
        created: now - 60 * day,
        updated: now - 5 * day,
      },
      {
        id: `union-worker-2-${groupId}`,
        groupId,
        name: 'Carlos Mendez',
        notes: 'New hire. Interested in union but nervous about retaliation. Needs follow-up conversation.',
        customFields: {
          role: 'Prospect',
          department: 'Shipping',
          shift: '1st (7am-3pm)',
          seniority: '2 months',
          sentiment: 'Interested but cautious',
          followUpDate: new Date(now + 3 * day).toISOString().split('T')[0],
        },
        tags: ['prospect', 'shipping', 'follow-up-needed'],
        created: now - 14 * day,
        updated: now - 7 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} union chapter contacts for group ${groupId}`);
  },
};

/**
 * Union Election Campaign CRM seed
 */
const unionElectionSeed: ModuleSeed = {
  name: 'crm-union-election-demo',
  description: 'Union election campaign contacts: eligible voters, committee members, and outreach targets',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      {
        id: `election-committee-1-${groupId}`,
        groupId,
        name: 'Diane Foster',
        phone: '555-0601',
        notes: 'Election committee chair. Organizing the card signing campaign. 15 years experience.',
        customFields: {
          role: 'Election Committee Chair',
          department: 'Customer Service',
          voterStatus: 'Signed card',
          influenceLevel: 'High - respected by all shifts',
          assignedOutreach: ['Shipping dept', 'New hires'],
        },
        tags: ['committee', 'chair', 'signed', 'leader'],
        created: now - 90 * day,
        updated: now - 1 * day,
      },
      {
        id: `election-supporter-1-${groupId}`,
        groupId,
        name: 'Jerome Harris',
        phone: '555-0610',
        notes: 'Strong supporter. Signed card day one. Talking to coworkers on 3rd shift.',
        customFields: {
          role: 'Supporter',
          department: 'Production',
          shift: '3rd (11pm-7am)',
          voterStatus: 'Signed card',
          influenceLevel: 'Medium',
          contactsMade: 8,
        },
        tags: ['supporter', 'signed', 'production', 'active'],
        created: now - 60 * day,
        updated: now - 3 * day,
      },
      {
        id: `election-undecided-1-${groupId}`,
        groupId,
        name: 'Lisa Chang',
        notes: 'Undecided. Concerned about dues but interested in better benefits. Needs one-on-one.',
        customFields: {
          role: 'Eligible Voter',
          department: 'Quality Control',
          voterStatus: 'Undecided',
          concerns: ['Dues cost', 'Will the union actually help?'],
          interests: ['Better health insurance', 'Job security'],
          followUpDate: new Date(now + 2 * day).toISOString().split('T')[0],
          assignedOrganizer: 'Diane Foster',
        },
        tags: ['undecided', 'quality-control', 'follow-up-needed'],
        created: now - 30 * day,
        updated: now - 5 * day,
      },
      {
        id: `election-opposed-1-${groupId}`,
        groupId,
        name: 'Brian Kowalski',
        notes: 'Opposed. Close to management. May be receiving anti-union talking points. Do not confront - use soft approach.',
        customFields: {
          role: 'Eligible Voter',
          department: 'Maintenance',
          voterStatus: 'Opposed',
          influenceLevel: 'Low',
          notes: 'Management-friendly. Brother-in-law is supervisor. Soft approach only.',
        },
        tags: ['opposed', 'maintenance', 'caution'],
        created: now - 45 * day,
        updated: now - 14 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} union election contacts for group ${groupId}`);
  },
};

/**
 * Tenant Union CRM seed
 */
const tenantUnionSeed: ModuleSeed = {
  name: 'crm-tenant-demo',
  description: 'Tenant union contacts: tenants, organizers, buildings, and landlord info',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      {
        id: `tenant-organizer-1-${groupId}`,
        groupId,
        name: 'Patricia Nguyen',
        phone: '555-0701',
        notes: 'Lead organizer for Riverside Apartments campaign. Tenant since 2018. Facing 40% rent increase.',
        customFields: {
          role: 'Building Organizer',
          building: 'Riverside Apartments (142 units)',
          unit: '4B',
          rentIncrease: '40%',
          leaseExpiry: new Date(now + 60 * day).toISOString().split('T')[0],
          tenantsOrganized: 38,
          issues: ['Rent increase', 'Lack of maintenance', 'Mold in basement units'],
        },
        tags: ['organizer', 'riverside', 'rent-strike', 'leader'],
        created: now - 120 * day,
        updated: now - 2 * day,
      },
      {
        id: `tenant-member-1-${groupId}`,
        groupId,
        name: 'Robert Jackson',
        phone: '555-0710',
        notes: 'Tenant at Riverside. Elderly, fixed income. Cannot afford rent increase. Willing to speak at city council.',
        customFields: {
          role: 'Tenant Member',
          building: 'Riverside Apartments',
          unit: '2A',
          rentIncrease: '40%',
          vulnerabilities: ['Fixed income', 'Elderly', 'No family nearby'],
          willingToSpeak: true,
          mediaConsent: true,
        },
        tags: ['tenant', 'riverside', 'vulnerable', 'willing-to-speak'],
        created: now - 90 * day,
        updated: now - 7 * day,
      },
      {
        id: `tenant-member-2-${groupId}`,
        groupId,
        name: 'Amira Khalil',
        phone: '555-0711',
        notes: 'Tenant at Oak Street building. Reported housing code violations. Landlord retaliated with eviction notice.',
        customFields: {
          role: 'Tenant Member',
          building: 'Oak Street Residences (28 units)',
          unit: '6',
          issues: ['Retaliation eviction', 'Code violations reported', 'No heat Nov-Dec'],
          evictionNoticeDate: new Date(now - 14 * day).toISOString().split('T')[0],
          courtDate: new Date(now + 21 * day).toISOString().split('T')[0],
          assignedAttorney: 'Legal Aid Society',
        },
        tags: ['tenant', 'oak-street', 'eviction', 'retaliation', 'urgent'],
        created: now - 45 * day,
        updated: now - 1 * day,
      },
      {
        id: `tenant-ally-1-${groupId}`,
        groupId,
        name: 'Council Member Sandra White',
        notes: 'City council ally. Supports rent stabilization ordinance. Can be contacted for political pressure.',
        customFields: {
          role: 'Political Ally',
          position: 'City Council, District 4',
          supportLevel: 'Strong - co-sponsored rent stabilization bill',
          contactMethod: 'Through chief of staff only',
        },
        tags: ['ally', 'political', 'city-council', 'rent-control'],
        created: now - 180 * day,
        updated: now - 30 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} tenant union contacts for group ${groupId}`);
  },
};

/**
 * Nonprofit Organization CRM seed
 */
const nonprofitSeed: ModuleSeed = {
  name: 'crm-nonprofit-demo',
  description: 'Nonprofit contacts: donors, volunteers, board members, and beneficiaries',
  data: async (groupId, _userPubkey) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const contacts: DBContact[] = [
      {
        id: `nonprofit-board-1-${groupId}`,
        groupId,
        name: 'Dr. Margaret Liu',
        email: 'margaret@example.org',
        phone: '555-0801',
        notes: 'Board chair. Nonprofit governance expert. Leads strategic planning committee.',
        customFields: {
          role: 'Board Chair',
          termExpiry: new Date(now + 365 * day).toISOString().split('T')[0],
          committees: ['Strategic Planning', 'Finance'],
          donorLevel: 'Major ($5,000+/year)',
        },
        tags: ['board', 'chair', 'donor', 'governance'],
        created: now - 500 * day,
        updated: now - 10 * day,
      },
      {
        id: `nonprofit-donor-1-${groupId}`,
        groupId,
        name: 'James & Rebecca Martinez',
        email: 'martinez.giving@example.com',
        notes: 'Recurring monthly donors. Interested in education programs. Met at last year\'s gala.',
        customFields: {
          role: 'Donor',
          donorLevel: 'Sustaining ($100/month)',
          totalGiving: '$3,600',
          interests: ['Education', 'Youth programs'],
          lastContact: new Date(now - 30 * day).toISOString().split('T')[0],
          preferredContact: 'Email',
        },
        tags: ['donor', 'sustaining', 'education', 'gala-attendee'],
        created: now - 400 * day,
        updated: now - 30 * day,
      },
      {
        id: `nonprofit-volunteer-1-${groupId}`,
        groupId,
        name: 'Terrence Williams',
        phone: '555-0820',
        email: 'terrence@example.com',
        notes: 'Reliable volunteer. Helps with Saturday food distribution and tutoring program.',
        customFields: {
          role: 'Volunteer',
          hoursThisYear: 87,
          programs: ['Food Distribution', 'Youth Tutoring'],
          availability: 'Saturdays, some weekday evenings',
          skills: ['Teaching', 'Driving (has van)'],
          backgroundCheck: true,
        },
        tags: ['volunteer', 'reliable', 'food-distribution', 'tutoring'],
        created: now - 200 * day,
        updated: now - 7 * day,
      },
      {
        id: `nonprofit-partner-1-${groupId}`,
        groupId,
        name: 'Greenfield Foundation',
        email: 'grants@greenfield.example.org',
        notes: 'Foundation partner. Funded our youth program last year ($25K). Proposal for renewal due March 1.',
        customFields: {
          role: 'Foundation Partner',
          grantAmount: '$25,000',
          grantProgram: 'Youth Development Initiative',
          renewalDeadline: new Date(now + 30 * day).toISOString().split('T')[0],
          contactPerson: 'Sarah Kim, Program Officer',
        },
        tags: ['foundation', 'funder', 'youth', 'renewal-pending'],
        created: now - 365 * day,
        updated: now - 14 * day,
      },
    ];

    await dal.bulkPut('contacts', contacts);
    logger.info(`Seeded ${contacts.length} nonprofit contacts for group ${groupId}`);
  },
};

/**
 * Seed data for CRM module
 */
export const crmSeeds: ModuleSeed[] = [
  exampleContactsSeed,
  nlgMassDefenseSeed,
  streetMedicsSeed,
  selfDefenseSeed,
  unionChapterSeed,
  unionElectionSeed,
  tenantUnionSeed,
  nonprofitSeed,
];
