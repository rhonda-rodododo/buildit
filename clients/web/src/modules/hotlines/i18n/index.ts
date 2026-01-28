/**
 * Hotlines Module Translations
 */

import { defineModuleTranslations } from '@/i18n/moduleI18n';

export default defineModuleTranslations({
  en: {
    // Core
    title: 'Hotlines',
    subtitle: 'Manage call lines, dispatch, and jail support coordination',
    description: 'Hotlines for jail support, dispatch, and emergency coordination',

    // Hotline types
    types: {
      'jail-support': 'Jail Support',
      'legal-intake': 'Legal Intake',
      dispatch: 'Dispatch',
      crisis: 'Crisis Line',
      general: 'General',
    },

    // Call status
    status: {
      active: 'Active',
      'on-hold': 'On Hold',
      completed: 'Completed',
      escalated: 'Escalated',
      transferred: 'Transferred',
    },

    // Dispatch status
    dispatchStatus: {
      pending: 'Pending',
      accepted: 'Accepted',
      declined: 'Declined',
      'en-route': 'En Route',
      'on-scene': 'On Scene',
      completed: 'Completed',
    },

    // Priority
    priority: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    },

    // Actions
    createHotline: 'Create Hotline',
    editHotline: 'Edit Hotline',
    deleteHotline: 'Delete Hotline',
    startCall: 'Start Call',
    endCall: 'End Call',
    holdCall: 'Put on Hold',
    escalateCall: 'Escalate',
    transferCall: 'Transfer',
    dispatchVolunteer: 'Dispatch Volunteer',
    linkToRecord: 'Link to Record',

    // Shift management
    startShift: 'Start Shift',
    endShift: 'End Shift',
    onDuty: 'On Duty',
    offDuty: 'Off Duty',
    activeOperators: 'Active Operators',
    noOperators: 'No operators currently on duty',

    // Call log
    callLog: 'Call Log',
    activeCalls: 'Active Calls',
    recentCalls: 'Recent Calls',
    noCalls: 'No calls yet',
    noCallsInHistory: 'No calls in history',
    noHotlinesCreated: 'No hotlines created yet',
    startedTimeAgo: 'Started {{time}}',
    callerName: 'Caller Name',
    callerPhone: 'Caller Phone',
    callTime: 'Call Time',
    duration: 'Duration',
    operator: 'Operator',
    summary: 'Summary',
    followUp: 'Follow-up Needed',
    followUpNeeded: 'Follow-up needed',
    followUpNotes: 'Follow-up Notes',

    // Stats
    totalCalls: 'Total Calls',
    averageDuration: 'Average Duration',
    callsByPriority: 'Calls by Priority',

    // Settings
    hotlineName: 'Hotline Name',
    phoneNumber: 'Phone Number',
    hotlineType: 'Hotline Type',
    operatingHours: 'Operating Hours',
    is24Hours: 'Open 24 Hours',

    // Confirmations
    confirmDeleteHotline: 'Are you sure you want to delete this hotline?',
    confirmEndCall: 'Are you sure you want to end this call?',

    meta: {
      description: 'Hotlines for jail support, dispatch, and emergency coordination.',
    },
  },

  es: {
    title: 'Líneas Directas',
    subtitle: 'Gestionar líneas de llamadas, despacho y coordinación de apoyo carcelario',
    description: 'Líneas directas para apoyo carcelario, despacho y coordinación de emergencias',

    types: {
      'jail-support': 'Apoyo Carcelario',
      'legal-intake': 'Admisión Legal',
      dispatch: 'Despacho',
      crisis: 'Línea de Crisis',
      general: 'General',
    },

    status: {
      active: 'Activa',
      'on-hold': 'En Espera',
      completed: 'Completada',
      escalated: 'Escalada',
      transferred: 'Transferida',
    },

    dispatchStatus: {
      pending: 'Pendiente',
      accepted: 'Aceptado',
      declined: 'Rechazado',
      'en-route': 'En Camino',
      'on-scene': 'En Escena',
      completed: 'Completado',
    },

    priority: {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente',
    },

    createHotline: 'Crear Línea',
    editHotline: 'Editar Línea',
    deleteHotline: 'Eliminar Línea',
    startCall: 'Iniciar Llamada',
    endCall: 'Finalizar Llamada',
    holdCall: 'Poner en Espera',
    escalateCall: 'Escalar',
    transferCall: 'Transferir',
    dispatchVolunteer: 'Enviar Voluntario',
    linkToRecord: 'Vincular a Registro',

    startShift: 'Iniciar Turno',
    endShift: 'Finalizar Turno',
    onDuty: 'En Servicio',
    offDuty: 'Fuera de Servicio',
    activeOperators: 'Operadores Activos',
    noOperators: 'No hay operadores en servicio',

    callLog: 'Registro de Llamadas',
    activeCalls: 'Llamadas Activas',
    recentCalls: 'Llamadas Recientes',
    noCalls: 'No hay llamadas todavía',
    noCallsInHistory: 'No hay llamadas en el historial',
    noHotlinesCreated: 'No hay líneas directas creadas todavía',
    startedTimeAgo: 'Iniciado {{time}}',
    callerName: 'Nombre del Llamante',
    callerPhone: 'Teléfono del Llamante',
    callTime: 'Hora de Llamada',
    duration: 'Duración',
    operator: 'Operador',
    summary: 'Resumen',
    followUp: 'Seguimiento Necesario',
    followUpNeeded: 'Seguimiento necesario',
    followUpNotes: 'Notas de Seguimiento',

    totalCalls: 'Total de Llamadas',
    averageDuration: 'Duración Promedio',
    callsByPriority: 'Llamadas por Prioridad',

    hotlineName: 'Nombre de la Línea',
    phoneNumber: 'Número de Teléfono',
    hotlineType: 'Tipo de Línea',
    operatingHours: 'Horario de Operación',
    is24Hours: 'Abierto 24 Horas',

    confirmDeleteHotline: '¿Estás seguro de que quieres eliminar esta línea?',
    confirmEndCall: '¿Estás seguro de que quieres finalizar esta llamada?',

    meta: {
      description: 'Líneas directas para apoyo carcelario, despacho y coordinación de emergencias.',
    },
  },

  fr: {
    title: 'Lignes Directes',
    subtitle: 'Gérer les lignes d\'appel, la répartition et la coordination du soutien carcéral',
    description: 'Lignes directes pour le soutien carcéral, la répartition et la coordination d\'urgence',

    types: {
      'jail-support': 'Soutien Carcéral',
      'legal-intake': 'Admission Juridique',
      dispatch: 'Répartition',
      crisis: 'Ligne de Crise',
      general: 'Général',
    },

    status: {
      active: 'Active',
      'on-hold': 'En Attente',
      completed: 'Terminée',
      escalated: 'Escaladée',
      transferred: 'Transférée',
    },

    dispatchStatus: {
      pending: 'En Attente',
      accepted: 'Accepté',
      declined: 'Refusé',
      'en-route': 'En Route',
      'on-scene': 'Sur Place',
      completed: 'Terminé',
    },

    priority: {
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
      urgent: 'Urgente',
    },

    createHotline: 'Créer une Ligne',
    editHotline: 'Modifier la Ligne',
    deleteHotline: 'Supprimer la Ligne',
    startCall: 'Démarrer l\'Appel',
    endCall: 'Terminer l\'Appel',
    holdCall: 'Mettre en Attente',
    escalateCall: 'Escalader',
    transferCall: 'Transférer',
    dispatchVolunteer: 'Envoyer un Bénévole',
    linkToRecord: 'Lier au Dossier',

    startShift: 'Commencer le Quart',
    endShift: 'Terminer le Quart',
    onDuty: 'En Service',
    offDuty: 'Hors Service',
    activeOperators: 'Opérateurs Actifs',
    noOperators: 'Aucun opérateur en service',

    callLog: 'Journal des Appels',
    activeCalls: 'Appels Actifs',
    recentCalls: 'Appels Récents',
    noCalls: 'Pas encore d\'appels',
    noCallsInHistory: 'Aucun appel dans l\'historique',
    noHotlinesCreated: 'Aucune ligne directe créée',
    startedTimeAgo: 'Commencé {{time}}',
    callerName: 'Nom de l\'Appelant',
    callerPhone: 'Téléphone de l\'Appelant',
    callTime: 'Heure d\'Appel',
    duration: 'Durée',
    operator: 'Opérateur',
    summary: 'Résumé',
    followUp: 'Suivi Nécessaire',
    followUpNeeded: 'Suivi nécessaire',
    followUpNotes: 'Notes de Suivi',

    totalCalls: 'Total des Appels',
    averageDuration: 'Durée Moyenne',
    callsByPriority: 'Appels par Priorité',

    hotlineName: 'Nom de la Ligne',
    phoneNumber: 'Numéro de Téléphone',
    hotlineType: 'Type de Ligne',
    operatingHours: 'Heures d\'Opération',
    is24Hours: 'Ouvert 24 Heures',

    confirmDeleteHotline: 'Êtes-vous sûr de vouloir supprimer cette ligne?',
    confirmEndCall: 'Êtes-vous sûr de vouloir terminer cet appel?',

    meta: {
      description: 'Lignes directes pour le soutien carcéral, la répartition et la coordination d\'urgence.',
    },
  },

  ar: {
    title: 'خطوط الاتصال المباشر',
    subtitle: 'إدارة خطوط الاتصال والإرسال وتنسيق دعم السجن',
    description: 'خطوط اتصال مباشرة لدعم السجن والإرسال والتنسيق في حالات الطوارئ',

    types: {
      'jail-support': 'دعم السجن',
      'legal-intake': 'القبول القانوني',
      dispatch: 'الإرسال',
      crisis: 'خط الأزمات',
      general: 'عام',
    },

    status: {
      active: 'نشطة',
      'on-hold': 'في الانتظار',
      completed: 'مكتملة',
      escalated: 'مُصعَّدة',
      transferred: 'محولة',
    },

    dispatchStatus: {
      pending: 'قيد الانتظار',
      accepted: 'مقبول',
      declined: 'مرفوض',
      'en-route': 'في الطريق',
      'on-scene': 'في الموقع',
      completed: 'مكتمل',
    },

    priority: {
      low: 'منخفضة',
      medium: 'متوسطة',
      high: 'عالية',
      urgent: 'عاجلة',
    },

    createHotline: 'إنشاء خط',
    editHotline: 'تعديل الخط',
    deleteHotline: 'حذف الخط',
    startCall: 'بدء المكالمة',
    endCall: 'إنهاء المكالمة',
    holdCall: 'وضع في الانتظار',
    escalateCall: 'تصعيد',
    transferCall: 'تحويل',
    dispatchVolunteer: 'إرسال متطوع',
    linkToRecord: 'ربط بالسجل',

    startShift: 'بدء الوردية',
    endShift: 'إنهاء الوردية',
    onDuty: 'في الخدمة',
    offDuty: 'خارج الخدمة',
    activeOperators: 'المشغلون النشطون',
    noOperators: 'لا يوجد مشغلون في الخدمة',

    callLog: 'سجل المكالمات',
    activeCalls: 'المكالمات النشطة',
    recentCalls: 'المكالمات الأخيرة',
    noCalls: 'لا توجد مكالمات بعد',
    noCallsInHistory: 'لا توجد مكالمات في السجل',
    noHotlinesCreated: 'لم يتم إنشاء خطوط اتصال بعد',
    startedTimeAgo: 'بدأت {{time}}',
    callerName: 'اسم المتصل',
    callerPhone: 'هاتف المتصل',
    callTime: 'وقت المكالمة',
    duration: 'المدة',
    operator: 'المشغل',
    summary: 'ملخص',
    followUp: 'متابعة مطلوبة',
    followUpNeeded: 'متابعة مطلوبة',
    followUpNotes: 'ملاحظات المتابعة',

    totalCalls: 'إجمالي المكالمات',
    averageDuration: 'متوسط المدة',
    callsByPriority: 'المكالمات حسب الأولوية',

    hotlineName: 'اسم الخط',
    phoneNumber: 'رقم الهاتف',
    hotlineType: 'نوع الخط',
    operatingHours: 'ساعات العمل',
    is24Hours: 'مفتوح 24 ساعة',

    confirmDeleteHotline: 'هل أنت متأكد من أنك تريد حذف هذا الخط؟',
    confirmEndCall: 'هل أنت متأكد من أنك تريد إنهاء هذه المكالمة؟',

    meta: {
      description: 'خطوط اتصال مباشرة لدعم السجن والإرسال والتنسيق في حالات الطوارئ.',
    },
  },
});
