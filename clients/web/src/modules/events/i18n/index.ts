/**
 * Events Module Translations
 *
 * These translations are loaded lazily when the events module is loaded,
 * keeping them out of the initial bundle for better performance.
 */

import { defineModuleTranslations } from '@/i18n/moduleI18n';

export default defineModuleTranslations({
  en: {
    title: 'Events',
    createEvent: 'Create Event',
    noEvents: 'No events yet',
    eventName: 'Event Name',
    location: 'Location',
    startTime: 'Start Time',
    endTime: 'End Time',
    capacity: 'Capacity',
    rsvp: 'RSVP',
    going: 'Going',
    maybe: 'Maybe',
    notGoing: 'Not Going',
    exportCalendar: 'Export to Calendar',
    // Page meta (for SEO)
    meta: {
      description: 'Coordinate events, rallies, workshops, and community gatherings.',
    },
  },
  es: {
    title: 'Eventos',
    createEvent: 'Crear Evento',
    noEvents: 'No hay eventos todavía',
    eventName: 'Nombre del Evento',
    location: 'Ubicación',
    startTime: 'Hora de Inicio',
    endTime: 'Hora de Fin',
    capacity: 'Capacidad',
    rsvp: 'Confirmar Asistencia',
    going: 'Asistiré',
    maybe: 'Quizás',
    notGoing: 'No Asistiré',
    exportCalendar: 'Exportar al Calendario',
    meta: {
      description: 'Coordina eventos, manifestaciones, talleres y reuniones comunitarias.',
    },
  },
  fr: {
    title: 'Événements',
    createEvent: 'Créer un Événement',
    noEvents: "Pas encore d'événements",
    eventName: "Nom de l'Événement",
    location: 'Lieu',
    startTime: 'Heure de Début',
    endTime: 'Heure de Fin',
    capacity: 'Capacité',
    rsvp: 'RSVP',
    going: "J'y vais",
    maybe: 'Peut-être',
    notGoing: "Je n'y vais pas",
    exportCalendar: 'Exporter vers le Calendrier',
    meta: {
      description: 'Coordonnez événements, rassemblements, ateliers et réunions communautaires.',
    },
  },
  ar: {
    title: 'الفعاليات',
    createEvent: 'إنشاء فعالية',
    noEvents: 'لا توجد فعاليات حتى الآن',
    eventName: 'اسم الفعالية',
    location: 'الموقع',
    startTime: 'وقت البدء',
    endTime: 'وقت الانتهاء',
    capacity: 'السعة',
    rsvp: 'تأكيد الحضور',
    going: 'سأحضر',
    maybe: 'ربما',
    notGoing: 'لن أحضر',
    exportCalendar: 'تصدير إلى التقويم',
    meta: {
      description: 'تنسيق الفعاليات والمظاهرات وورش العمل والتجمعات المجتمعية.',
    },
  },
});
