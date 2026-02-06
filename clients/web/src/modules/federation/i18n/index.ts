/**
 * Federation Module Translations
 */

import { defineModuleTranslations } from '@/i18n/moduleI18n';

export default defineModuleTranslations({
  en: {
    title: 'Federation',
    settings: {
      title: 'Federation Settings',
      description: 'Bridge your public posts to the fediverse (Mastodon) and Bluesky. Private and encrypted content is never federated.',
      activityPub: 'ActivityPub (Fediverse)',
      activityPubDescription: 'Share posts with Mastodon, Misskey, and other fediverse servers.',
      bluesky: 'Bluesky (AT Protocol)',
      blueskyDescription: 'Cross-post to your Bluesky account.',
      blueskyHandle: 'Bluesky Handle',
      blueskyAppPasswordNote: 'Use an App Password from Bluesky settings — never your main password.',
      toggleActivityPub: 'Toggle ActivityPub federation',
      toggleBluesky: 'Toggle Bluesky federation',
      enabled: 'Enabled',
      disabled: 'Disabled',
      privacyNotice: 'Privacy:',
      privacyNoticeText: 'Only explicitly public posts are federated. Encrypted messages, DMs, and group-only content are never shared.',
    },
    badge: {
      activityPub: 'Federated to ActivityPub',
      activityPubTooltip: 'This post is shared on the fediverse (Mastodon etc.)',
      bluesky: 'Cross-posted to Bluesky',
      blueskyTooltip: 'This post is cross-posted to Bluesky',
    },
    interactions: {
      empty: 'No interactions from federated platforms yet.',
      unknownUser: 'Unknown User',
      view: 'View',
      viewOnPlatform: 'View on original platform',
    },
    meta: {
      description: 'Bridge public posts to Mastodon and Bluesky.',
    },
  },
  es: {
    title: 'Federación',
    settings: {
      title: 'Configuración de Federación',
      description: 'Comparte tus publicaciones públicas con el fediverso (Mastodon) y Bluesky. El contenido privado y cifrado nunca se federa.',
      activityPub: 'ActivityPub (Fediverso)',
      activityPubDescription: 'Comparte publicaciones con Mastodon, Misskey y otros servidores del fediverso.',
      bluesky: 'Bluesky (AT Protocol)',
      blueskyDescription: 'Publica en tu cuenta de Bluesky.',
      blueskyHandle: 'Nombre de usuario en Bluesky',
      blueskyAppPasswordNote: 'Usa una contraseña de aplicación de la configuración de Bluesky — nunca tu contraseña principal.',
      toggleActivityPub: 'Activar/desactivar federación ActivityPub',
      toggleBluesky: 'Activar/desactivar federación Bluesky',
      enabled: 'Activado',
      disabled: 'Desactivado',
      privacyNotice: 'Privacidad:',
      privacyNoticeText: 'Solo las publicaciones explícitamente públicas se federan. Los mensajes cifrados, DMs y contenido solo para grupos nunca se comparten.',
    },
    badge: {
      activityPub: 'Federado a ActivityPub',
      activityPubTooltip: 'Esta publicación se comparte en el fediverso (Mastodon etc.)',
      bluesky: 'Publicado en Bluesky',
      blueskyTooltip: 'Esta publicación se publicó en Bluesky',
    },
    interactions: {
      empty: 'Aún no hay interacciones de plataformas federadas.',
      unknownUser: 'Usuario desconocido',
      view: 'Ver',
      viewOnPlatform: 'Ver en la plataforma original',
    },
    meta: {
      description: 'Comparte publicaciones públicas con Mastodon y Bluesky.',
    },
  },
  fr: {
    title: 'Fédération',
    settings: {
      title: 'Paramètres de Fédération',
      description: 'Partagez vos publications publiques sur le fédiverse (Mastodon) et Bluesky. Le contenu privé et chiffré n\'est jamais fédéré.',
      activityPub: 'ActivityPub (Fédiverse)',
      activityPubDescription: 'Partagez avec Mastodon, Misskey et d\'autres serveurs du fédiverse.',
      bluesky: 'Bluesky (AT Protocol)',
      blueskyDescription: 'Publiez sur votre compte Bluesky.',
      blueskyHandle: 'Identifiant Bluesky',
      blueskyAppPasswordNote: 'Utilisez un mot de passe d\'application depuis les paramètres Bluesky — jamais votre mot de passe principal.',
      toggleActivityPub: 'Activer/désactiver la fédération ActivityPub',
      toggleBluesky: 'Activer/désactiver la fédération Bluesky',
      enabled: 'Activé',
      disabled: 'Désactivé',
      privacyNotice: 'Confidentialité :',
      privacyNoticeText: 'Seules les publications explicitement publiques sont fédérées. Les messages chiffrés, DMs et contenus de groupe ne sont jamais partagés.',
    },
    badge: {
      activityPub: 'Fédéré sur ActivityPub',
      activityPubTooltip: 'Cette publication est partagée sur le fédiverse (Mastodon etc.)',
      bluesky: 'Publié sur Bluesky',
      blueskyTooltip: 'Cette publication est publiée sur Bluesky',
    },
    interactions: {
      empty: 'Aucune interaction des plateformes fédérées pour le moment.',
      unknownUser: 'Utilisateur inconnu',
      view: 'Voir',
      viewOnPlatform: 'Voir sur la plateforme d\'origine',
    },
    meta: {
      description: 'Partagez vos publications publiques avec Mastodon et Bluesky.',
    },
  },
  ar: {
    title: 'الاتحاد',
    settings: {
      title: 'إعدادات الاتحاد',
      description: 'شارك منشوراتك العامة مع فيدفيرس (ماستودون) وبلوسكاي. المحتوى الخاص والمشفر لا يُشارك أبداً.',
      activityPub: 'ActivityPub (فيدفيرس)',
      activityPubDescription: 'شارك المنشورات مع ماستودون وميسكي وخوادم فيدفيرس الأخرى.',
      bluesky: 'Bluesky (AT Protocol)',
      blueskyDescription: 'انشر على حسابك في بلوسكاي.',
      blueskyHandle: 'اسم مستخدم بلوسكاي',
      blueskyAppPasswordNote: 'استخدم كلمة مرور التطبيق من إعدادات بلوسكاي — لا تستخدم كلمة المرور الرئيسية.',
      toggleActivityPub: 'تفعيل/تعطيل اتحاد ActivityPub',
      toggleBluesky: 'تفعيل/تعطيل اتحاد بلوسكاي',
      enabled: 'مفعّل',
      disabled: 'معطّل',
      privacyNotice: 'الخصوصية:',
      privacyNoticeText: 'فقط المنشورات العامة صراحةً تُشارك. الرسائل المشفرة والخاصة ومحتوى المجموعات لا يُشارك أبداً.',
    },
    badge: {
      activityPub: 'مشارك على ActivityPub',
      activityPubTooltip: 'هذا المنشور مشارك على فيدفيرس (ماستودون إلخ.)',
      bluesky: 'منشور على بلوسكاي',
      blueskyTooltip: 'هذا المنشور منشور على بلوسكاي',
    },
    interactions: {
      empty: 'لا توجد تفاعلات من المنصات المتحدة بعد.',
      unknownUser: 'مستخدم غير معروف',
      view: 'عرض',
      viewOnPlatform: 'عرض على المنصة الأصلية',
    },
    meta: {
      description: 'شارك المنشورات العامة مع ماستودون وبلوسكاي.',
    },
  },
  'zh-CN': {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  vi: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  ko: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  ru: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  pt: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  ht: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
  tl: {
    title: '[NEEDS_TRANSLATION] Federation',
    meta: {
      description: '[NEEDS_TRANSLATION] Bridge public posts to Mastodon and Bluesky.',
    },
  },
});
