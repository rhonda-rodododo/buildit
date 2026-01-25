/**
 * CRM Template Seed Data
 * Historically-inspired and fun example data for CRM templates
 */

import type { CustomFieldValues } from '../custom-fields/types';

/**
 * Union Organizing Seed Data
 * Inspired by historical labor organizing campaigns
 */
export const unionOrganizingSeedData: Array<{ customFields: CustomFieldValues }> = [
  {
    customFields: {
      full_name: 'Rosa Parks',
      email: 'rosa.parks@example.org',
      phone: '+1 (334) 555-0142',
      department: 'Transportation',
      support_level: 'Strong Yes',
      organizer: 'E.D. Nixon',
      last_contact: '2024-09-15',
      notes: 'Strong advocate for workplace dignity. Has connections with NAACP. Willing to be shop steward.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Cesar Chavez',
      email: 'cesar.chavez@example.org',
      phone: '+1 (661) 555-0184',
      department: 'Agricultural Operations',
      support_level: 'Strong Yes',
      organizer: 'Dolores Huerta',
      last_contact: '2024-09-18',
      notes: 'Experienced organizer. Suggests boycott strategy. Very committed to non-violence approach.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Mother Jones',
      email: 'm.jones@example.org',
      phone: '+1 (304) 555-0189',
      department: 'Mining',
      support_level: 'Strong Yes',
      organizer: 'Eugene Debs',
      last_contact: '2024-09-12',
      notes: 'Fearless speaker. Says "Pray for the dead and fight like hell for the living." Ready to lead.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'A. Philip Randolph',
      email: 'a.randolph@example.org',
      phone: '+1 (202) 555-0176',
      department: 'Railway Services',
      support_level: 'Strong Yes',
      organizer: 'Bayard Rustin',
      last_contact: '2024-09-20',
      notes: 'Excellent strategist. Organized Brotherhood of Sleeping Car Porters. Connects labor and civil rights.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Emma Goldman',
      email: 'emma.goldman@example.org',
      phone: '+1 (212) 555-0191',
      department: 'Textile Manufacturing',
      support_level: 'Lean Yes',
      organizer: 'Alexander Berkman',
      last_contact: '2024-09-10',
      notes: 'Passionate about workers rights. Strong speaker. Concerns about union bureaucracy - prefers direct action.',
      signed_card: false,
    },
  },
  {
    customFields: {
      full_name: 'Joe Hill',
      email: 'joe.hill@example.org',
      phone: '+1 (801) 555-0193',
      department: 'Construction',
      support_level: 'Strong Yes',
      organizer: 'Big Bill Haywood',
      last_contact: '2024-09-17',
      notes: 'Writes songs for the cause. Says "Don\'t mourn, organize!" Creative approach to outreach.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Lucy Parsons',
      email: 'lucy.parsons@example.org',
      phone: '+1 (312) 555-0187',
      department: 'Garment',
      support_level: 'Strong Yes',
      organizer: 'Albert Parsons',
      last_contact: '2024-09-14',
      notes: 'Powerful orator and writer. Advocates for 8-hour workday. Strong on workplace safety issues.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Eugene Debs',
      email: 'e.debs@example.org',
      phone: '+1 (765) 555-0195',
      department: 'Railway Maintenance',
      support_level: 'Strong Yes',
      organizer: 'Victor Berger',
      last_contact: '2024-09-21',
      notes: 'Incredible solidarity. "While there is a lower class, I am in it." Natural leader.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Dolores Huerta',
      email: 'dolores.huerta@example.org',
      phone: '+1 (661) 555-0197',
      department: 'Agricultural Operations',
      support_level: 'Strong Yes',
      organizer: 'Cesar Chavez',
      last_contact: '2024-09-19',
      notes: 'Co-founder mindset. "Sí se puede!" Great at community organizing. Focuses on women workers.',
      signed_card: true,
    },
  },
  {
    customFields: {
      full_name: 'Samuel Gompers',
      email: 's.gompers@example.org',
      phone: '+1 (202) 555-0199',
      department: 'Cigar Manufacturing',
      support_level: 'Undecided',
      organizer: 'Mother Jones',
      last_contact: '2024-09-08',
      notes: 'Pragmatic approach. Wants clear contract language. Concerned about strike timing and fund reserves.',
      signed_card: false,
    },
  },
];

/**
 * Fundraising Seed Data
 * Mix of historical and fun donor examples
 */
export const fundraisingSeedData: Array<{ customFields: CustomFieldValues }> = [
  {
    customFields: {
      donor_name: 'Rockefeller Foundation',
      email: 'grants@rockefellerfoundation.example',
      phone: '+1 (212) 555-0201',
      total_donated: 50000,
      last_donation_date: '2024-08-15',
      donor_level: 'Major',
      preferred_contact: 'Email',
      notes: 'Institutional donor. Interested in community organizing projects. Annual grant cycle.',
    },
  },
  {
    customFields: {
      donor_name: 'Harriet Tubman',
      email: 'h.tubman@example.org',
      phone: '+1 (410) 555-0203',
      total_donated: 500,
      last_donation_date: '2024-09-01',
      donor_level: 'Regular',
      preferred_contact: 'In-person',
      notes: 'Monthly donor. "Never lost a passenger." Committed to freedom work. Always brings others.',
    },
  },
  {
    customFields: {
      donor_name: 'Robin Hood',
      email: 'robin@sherwoodforest.example',
      phone: '+44 (115) 555-0205',
      total_donated: 15000,
      last_donation_date: '2024-09-10',
      donor_level: 'Major',
      preferred_contact: 'Mail',
      notes: 'Redistributes wealth creatively. Prefers anonymous donations. Connected to forest conservation.',
    },
  },
  {
    customFields: {
      donor_name: 'Fred Hampton',
      email: 'f.hampton@example.org',
      phone: '+1 (312) 555-0207',
      total_donated: 250,
      last_donation_date: '2024-09-12',
      donor_level: 'Regular',
      preferred_contact: 'Phone',
      notes: 'Rainbow coalition builder. Interested in breakfast program funding. Young but very committed.',
    },
  },
  {
    customFields: {
      donor_name: 'Patagonia Corporate Giving',
      email: 'activism@patagonia.example',
      phone: '+1 (805) 555-0209',
      total_donated: 25000,
      last_donation_date: '2024-09-05',
      donor_level: 'Major',
      preferred_contact: 'Email',
      notes: '1% for the Planet. Supports environmental justice. Prefers grassroots organizations.',
    },
  },
  {
    customFields: {
      donor_name: 'Jane Addams',
      email: 'jane.addams@hullhouse.example',
      phone: '+1 (312) 555-0211',
      total_donated: 1200,
      last_donation_date: '2024-09-18',
      donor_level: 'Regular',
      preferred_contact: 'In-person',
      notes: 'Settlement house model. Interested in immigrant support and social services. Very hands-on.',
    },
  },
  {
    customFields: {
      donor_name: 'Anonymous Crypto Whale',
      email: 'whale@protonmail.example',
      phone: 'N/A',
      total_donated: 100000,
      last_donation_date: '2024-09-20',
      donor_level: 'Major',
      preferred_contact: 'Email',
      notes: 'Bitcoin donation. Values privacy. Supports decentralized organizing. One-time major gift.',
    },
  },
  {
    customFields: {
      donor_name: 'Angela Davis',
      email: 'a.davis@example.org',
      phone: '+1 (510) 555-0213',
      total_donated: 750,
      last_donation_date: '2024-09-15',
      donor_level: 'Regular',
      preferred_contact: 'Email',
      notes: 'Prison abolition focus. Regular monthly donor. Connects to academic networks. Great for speaker events.',
    },
  },
  {
    customFields: {
      donor_name: 'The Robin Hood Foundation',
      email: 'grants@robinhood.example',
      phone: '+1 (212) 555-0215',
      total_donated: 35000,
      last_donation_date: '2024-08-30',
      donor_level: 'Major',
      preferred_contact: 'Email',
      notes: 'NYC-focused. Interested in measurable impact. Application process required. Annual giving.',
    },
  },
  {
    customFields: {
      donor_name: 'Local Coffee Shop Tip Jar',
      email: 'info@redemmacafe.example',
      phone: '+1 (503) 555-0217',
      total_donated: 85,
      last_donation_date: '2024-09-22',
      donor_level: 'Occasional',
      preferred_contact: 'In-person',
      notes: 'Community partnership. Monthly collection jar. Worker-owned cooperative. Good visibility.',
    },
  },
];

/**
 * Legal/NLG Tracking Seed Data
 * Based on historical legal defense cases
 */
export const legalTrackingSeedData: Array<{ customFields: CustomFieldValues }> = [
  {
    customFields: {
      case_name: 'Seattle WTO Protest Defense',
      arrestee_name: 'Multiple defendants',
      arrest_date: '1999-11-30',
      charges: 'Failure to disperse, obstruction',
      case_status: 'Resolved',
      assigned_lawyer: 'NLG Seattle Chapter',
      next_court_date: '2000-03-15',
      bail_amount: 0,
      notes: 'Historic mass protest. Battle in Seattle. Most charges dismissed. Precedent for future actions.',
    },
  },
  {
    customFields: {
      case_name: 'Occupy Wall Street - Zuccotti Park',
      arrestee_name: 'Cecily McMillan',
      arrest_date: '2012-03-17',
      charges: 'Assault on officer (disputed)',
      case_status: 'Convicted',
      assigned_lawyer: 'Martin Stolar',
      next_court_date: '',
      bail_amount: 5000,
      notes: 'Controversial case. Claims self-defense. Strong community support. Probation sentenced.',
    },
  },
  {
    customFields: {
      case_name: 'Standing Rock Water Protector Defense',
      arrestee_name: 'Red Fawn Fallis',
      arrest_date: '2016-10-27',
      charges: 'Federal firearms charges',
      case_status: 'Resolved',
      assigned_lawyer: 'Bruce Ellison',
      next_court_date: '',
      bail_amount: 0,
      notes: 'DAPL resistance. Federal prosecution. Solidarity campaign. 57 months sentenced. Released 2021.',
    },
  },
  {
    customFields: {
      case_name: 'J20 Inauguration Protest',
      arrestee_name: 'Mass arrest - 234 defendants',
      arrest_date: '2017-01-20',
      charges: 'Felony rioting (conspiracy)',
      case_status: 'Dismissed',
      assigned_lawyer: 'NLG DC Chapter',
      next_court_date: '',
      bail_amount: 0,
      notes: 'Kettling arrest. All charges dismissed after trials. Prosecutorial overreach. Important precedent.',
    },
  },
  {
    customFields: {
      case_name: 'Ferguson Uprising Defense',
      arrestee_name: 'DeRay Mckesson',
      arrest_date: '2016-07-09',
      charges: 'Obstruction of highway',
      case_status: 'Dismissed',
      assigned_lawyer: 'ACLU Missouri',
      next_court_date: '',
      bail_amount: 500,
      notes: 'BLM protest. First Amendment defense. Charges dropped. Civil suit ongoing against police.',
    },
  },
  {
    customFields: {
      case_name: 'Climate Activist Tree-Sit',
      arrestee_name: 'Julia Butterfly Hill',
      arrest_date: '1999-12-18',
      charges: 'Trespassing (civil)',
      case_status: 'Resolved',
      assigned_lawyer: 'Earth First! Legal',
      next_court_date: '',
      bail_amount: 0,
      notes: '738 days in tree. Civil settlement. Ancient forest saved. Became national symbol.',
    },
  },
  {
    customFields: {
      case_name: 'Greenpeace Arctic 30',
      arrestee_name: '30 crew members',
      arrest_date: '2013-09-18',
      charges: 'Piracy (Russia)',
      case_status: 'Resolved',
      assigned_lawyer: 'International team',
      next_court_date: '',
      bail_amount: 0,
      notes: 'International incident. Amnesty prisoners of conscience. Released under amnesty. Global campaign.',
    },
  },
  {
    customFields: {
      case_name: 'BLM Highway Blockade',
      arrestee_name: 'Jasmine Abdullah',
      arrest_date: '2016-07-10',
      charges: 'Lynching (felony)',
      case_status: 'Dismissed',
      assigned_lawyer: 'Nana Gyamfi',
      next_court_date: '',
      bail_amount: 2500,
      notes: 'Ironic charge of "lynching" against BLM activist. Charges reduced then dismissed. Sparked law change.',
    },
  },
  {
    customFields: {
      case_name: 'Valve Turner Climate Action',
      arrestee_name: 'Ken Ward',
      arrest_date: '2016-10-11',
      charges: 'Sabotage, burglary',
      case_status: 'Resolved',
      assigned_lawyer: 'Climate Defense Project',
      next_court_date: '',
      bail_amount: 10000,
      notes: 'Necessity defense allowed. Hung jury. Plea deal to lesser charges. Symbolic victory.',
    },
  },
  {
    customFields: {
      case_name: 'Anti-Fascist Self-Defense',
      arrestee_name: 'Portland Protesters (various)',
      arrest_date: '2020-07-17',
      charges: 'Assault, disorderly conduct',
      case_status: 'Active',
      assigned_lawyer: 'NLG Portland',
      next_court_date: '2024-11-15',
      bail_amount: 1000,
      notes: 'Federal agents in unmarked vans. Civil rights concerns. Ongoing litigation. Mutual aid support.',
    },
  },
];

/**
 * Volunteer Management Seed Data
 * Diverse skills and availability
 */
export const volunteerManagementSeedData: Array<{ customFields: CustomFieldValues }> = [
  {
    customFields: {
      volunteer_name: 'Patch Adams',
      email: 'patch@gesundheit.example',
      phone: '+1 (703) 555-0301',
      skills: ['Medic', 'De-escalation'],
      availability: ['Weekends', 'On-call'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Licensed MD. Brings humor and humanity. Great at de-escalating tense situations. Clown nose in first aid kit.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Ida B. Wells',
      email: 'ida.wells@example.org',
      phone: '+1 (901) 555-0303',
      skills: ['Communications', 'Legal Observer'],
      availability: ['Weekdays', 'Evenings'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Investigative journalist. Fearless documenter. Experienced legal observer. Photography skills.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Leah Lakshmi Piepzna-Samarasinha',
      email: 'leah@disabilityjustice.example',
      phone: '+1 (510) 555-0305',
      skills: ['First Aid', 'Translation'],
      availability: ['Evenings', 'Weekends'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Disability justice organizer. ASL fluent. Wheelchair accessibility expert. Care web organizer.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Boots Riley',
      email: 'boots@thecoup.example',
      phone: '+1 (510) 555-0307',
      skills: ['Social Media', 'Communications'],
      availability: ['Evenings'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Artist and organizer. Great at cultural work. Music for fundraisers. Creative media strategies.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Grace Lee Boggs',
      email: 'grace@detroitsummer.example',
      phone: '+1 (313) 555-0309',
      skills: ['De-escalation', 'Translation'],
      availability: ['Weekdays'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Philosopher activist. Thinks long-term. Excellent at conflict resolution. Mentors younger organizers.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Woody Guthrie',
      email: 'woody@thislandisyourland.example',
      phone: '+1 (405) 555-0311',
      skills: ['Social Media', 'Fundraising'],
      availability: ['Weekends', 'On-call'],
      volunteer_status: 'Active',
      background_check: false,
      notes: 'Folk musician. "This machine kills fascists." Benefit concerts. Good at morale and culture building.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Marsha P. Johnson',
      email: 'marsha@stonewall.example',
      phone: '+1 (212) 555-0313',
      skills: ['First Aid', 'De-escalation'],
      availability: ['On-call'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Street activist and care worker. "Pay it no mind." Feeds homeless youth. Fearless frontliner.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Stokely Carmichael (Kwame Ture)',
      email: 'stokely@sncc.example',
      phone: '+1 (202) 555-0315',
      skills: ['Legal Observer', 'Communications'],
      availability: ['Weekdays', 'Weekends'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Powerful speaker. Black Power advocate. SNCC organizer. Good at training new volunteers.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Code Pink Member',
      email: 'medea@codepink.example',
      phone: '+1 (415) 555-0317',
      skills: ['Social Media', 'Communications'],
      availability: ['Weekdays'],
      volunteer_status: 'Active',
      background_check: true,
      notes: 'Anti-war focus. Creative direct action. Pink aesthetic. Congress disruptions. Media savvy.',
    },
  },
  {
    customFields: {
      volunteer_name: 'Tech Worker for Good',
      email: 'anon@protonmail.example',
      phone: 'Signal only',
      skills: ['Social Media', 'Communications'],
      availability: ['Evenings'],
      volunteer_status: 'Active',
      background_check: false,
      notes: 'OpSec expertise. Signal/encryption training. Website management. Prefers anonymity. Very reliable.',
    },
  },
];

/**
 * Civil Defense Seed Data
 * Emergency preparedness network
 */
export const civilDefenseSeedData: Array<{ customFields: CustomFieldValues }> = [
  {
    customFields: {
      contact_name: 'Dr. Paul Farmer',
      phone: '+1 (617) 555-0401',
      emergency_skills: ['Doctor', 'Paramedic'],
      resources_available: ['Medical Supplies', 'Shelter Space'],
      availability_zone: 'Cambridge/Somerville',
      contact_preference: 'Phone Call',
      notes: 'Partners In Health founder. Global health expert. Clinic space available. Speaks Haitian Creole.',
    },
  },
  {
    customFields: {
      contact_name: 'Mutual Aid Disaster Relief',
      phone: '+1 (504) 555-0403',
      emergency_skills: ['Shelter Coord', 'Food Prep'],
      resources_available: ['Food/Water', 'Communications', 'Vehicle'],
      availability_zone: 'New Orleans - Lower Ninth',
      contact_preference: 'Signal',
      notes: 'Post-Katrina organizing. Horizontal structure. Radio network. Community kitchen. Flood experience.',
    },
  },
  {
    customFields: {
      contact_name: 'Ham Radio Operator Network',
      phone: '+1 (206) 555-0405',
      emergency_skills: ['Communications'],
      resources_available: ['Communications'],
      availability_zone: 'Seattle Metro',
      contact_preference: 'Radio',
      notes: 'Emergency communications when internet down. FCC licensed. Multi-frequency. Earthquake prep.',
    },
  },
  {
    customFields: {
      contact_name: 'Community Fridge Organizer',
      phone: '+1 (718) 555-0407',
      emergency_skills: ['Food Prep'],
      resources_available: ['Food/Water'],
      availability_zone: 'Brooklyn - Bed-Stuy',
      contact_preference: 'SMS',
      notes: 'Mutual aid fridge network. Food pantry connections. Knows food banks. Distribution experience.',
    },
  },
  {
    customFields: {
      contact_name: 'Wilderness First Responder',
      phone: '+1 (503) 555-0409',
      emergency_skills: ['EMT', 'Mental Health'],
      resources_available: ['Medical Supplies', 'Vehicle'],
      availability_zone: 'Portland Metro',
      contact_preference: 'Phone Call',
      notes: 'WFR certified. Trauma-informed care. 4x4 vehicle. Camping supplies. Off-grid experience.',
    },
  },
  {
    customFields: {
      contact_name: 'Legal Hotline Coordinator',
      phone: '+1 (312) 555-0411',
      emergency_skills: ['Legal'],
      resources_available: ['Communications'],
      availability_zone: 'Chicago - South Side',
      contact_preference: 'Signal',
      notes: 'Know Your Rights training. Bail fund access. Police accountability focus. 24/7 hotline.',
    },
  },
  {
    customFields: {
      contact_name: 'Community Center Director',
      phone: '+1 (404) 555-0413',
      emergency_skills: ['Shelter Coord'],
      resources_available: ['Shelter Space', 'Food/Water', 'Generator'],
      availability_zone: 'Atlanta - Old Fourth Ward',
      contact_preference: 'Phone Call',
      notes: 'Large meeting space. Industrial kitchen. Generator backup. Cooling/heating center. ADA accessible.',
    },
  },
  {
    customFields: {
      contact_name: 'Street Medic Collective',
      phone: '+1 (612) 555-0415',
      emergency_skills: ['EMT', 'Paramedic', 'Nurse'],
      resources_available: ['Medical Supplies'],
      availability_zone: 'Minneapolis - Powderhorn',
      contact_preference: 'Signal',
      notes: 'Protest medicine specialists. Trauma kits. Saline. Mobile first aid. Experienced with tear gas.',
    },
  },
  {
    customFields: {
      contact_name: 'Community Toolshed Library',
      phone: '+1 (510) 555-0417',
      emergency_skills: ['Shelter Coord'],
      resources_available: ['Generator', 'Vehicle'],
      availability_zone: 'Oakland - Fruitvale',
      contact_preference: 'In-person',
      notes: 'Tool library. Generators, water pumps. Cargo van. Chainsaw. Emergency repair equipment.',
    },
  },
  {
    customFields: {
      contact_name: 'Mental Health Crisis Team',
      phone: '+1 (303) 555-0419',
      emergency_skills: ['Mental Health'],
      resources_available: ['Shelter Space'],
      availability_zone: 'Denver Metro',
      contact_preference: 'Phone Call',
      notes: 'Crisis counseling. Peer support model. Trauma specialists. Alternative to police response.',
    },
  },
];
