import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { RootLayout } from '@/layouts/RootLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getAllModules } from '@/lib/modules/registry';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const ConversationsPage = lazy(() => import('@/core/messaging/components').then(m => ({ default: m.ConversationsPage })));
const ContactsPage = lazy(() => import('@/modules/friends/components').then(m => ({ default: m.ContactsPage })));
const UserDirectory = lazy(() => import('@/pages/UserDirectory').then(m => ({ default: m.UserDirectory })));
const GroupsPage = lazy(() => import('@/pages/GroupsPage').then(m => ({ default: m.GroupsPage })));
const GroupLayout = lazy(() => import('@/layouts/GroupLayout').then(m => ({ default: m.GroupLayout })));
const GroupDashboard = lazy(() => import('@/pages/GroupDashboard').then(m => ({ default: m.GroupDashboard })));
const GroupFeedPage = lazy(() => import('@/pages/GroupFeedPage').then(m => ({ default: m.GroupFeedPage })));
const GroupMembersPage = lazy(() => import('@/pages/GroupMembersPage').then(m => ({ default: m.GroupMembersPage })));
const GroupSettingsPage = lazy(() => import('@/pages/GroupSettingsPage').then(m => ({ default: m.GroupSettingsPage })));
const GroupMessagesPage = lazy(() => import('@/pages/GroupMessagesPage').then(m => ({ default: m.GroupMessagesPage })));

// Settings pages
const SettingsLayout = lazy(() => import('@/layouts/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const ProfileSettings = lazy(() => import('@/pages/settings/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const SecuritySettings = lazy(() => import('@/pages/settings/SecuritySettings').then(m => ({ default: m.SecuritySettings })));
const PrivacySettings = lazy(() => import('@/pages/settings/PrivacySettings').then(m => ({ default: m.PrivacySettings })));
const NotificationSettings = lazy(() => import('@/pages/settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const PreferencesSettings = lazy(() => import('@/pages/settings/PreferencesSettings').then(m => ({ default: m.PreferencesSettings })));

// Public pages
const CampaignPage = lazy(() => import('@/pages/public/CampaignPage').then(m => ({ default: m.CampaignPage })));
const PublicWikiPage = lazy(() => import('@/pages/public/PublicWikiPage').then(m => ({ default: m.PublicWikiPage })));

// Feature pages
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const BulkOperationsPage = lazy(() => import('@/pages/BulkOperationsPage').then(m => ({ default: m.BulkOperationsPage })));
const ContactDetailPage = lazy(() => import('@/pages/ContactDetailPage').then(m => ({ default: m.ContactDetailPage })));
const EngagementPage = lazy(() => import('@/pages/EngagementPage').then(m => ({ default: m.EngagementPage })));

// Demo pages
const OnboardingDemoPage = lazy(() => import('@/pages/OnboardingDemoPage').then(m => ({ default: m.OnboardingDemoPage })));
const NotificationsDemoPage = lazy(() => import('@/pages/NotificationsDemoPage').then(m => ({ default: m.NotificationsDemoPage })));
const PrivacyDemoPage = lazy(() => import('@/pages/PrivacyDemoPage').then(m => ({ default: m.PrivacyDemoPage })));
const SecurityDemoPage = lazy(() => import('@/pages/SecurityDemoPage').then(m => ({ default: m.SecurityDemoPage })));

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

/**
 * Get module routes by scope
 * Wraps lazy-loaded module components in Suspense
 */
export function getModuleRoutes(scope: 'app' | 'group', componentOrElement: 'Component' | 'element' = 'Component'): RouteObject[] {
  try {
    const modules = getAllModules();

    const filteredModules = modules
      .filter((module) => module.routes && module.routes.length > 0)
      .flatMap((module) =>
        module.routes!
          .filter((route) => (route.scope || 'group') === scope)
          .map((route) => ({
            path: route.path,
            [componentOrElement]: componentOrElement === 'Component' ? route.component: <route.component />,
          }))
      );
    return filteredModules
  } catch {
    // Modules not initialized yet
    return [];
  }
}

/**
 * Root routes configuration
 * Structure:
 * - / (root)
 *   - /login (auth)
 *   - /app (authenticated)
 *     - /messages
 *     - /groups
 *       - /:groupId (group context)
 *         - /dashboard
 *         - /[module routes]
 *     - /settings
 *       - /profile
 *       - /security
 *       - /privacy
 *       - /notifications
 *       - /preferences
 */
export const getRoutes: () => RouteObject[] = () => [
  {
    path: '/',
    Component: RootLayout,
    errorElement: <ErrorBoundary />,
    action: true,
    children: [
      {
        // Public routes (no auth required)
        path: 'campaigns/:slug',
        Component: CampaignPage,
      },
      {
        path: 'wiki',
        children: [
          {
            index: true,
            Component: PublicWikiPage,
          },
          {
            path: ':slug',
            Component: PublicWikiPage,
          },
        ],
      },
      {
        // Auth routes (unauthenticated)
        Component: AuthLayout,
        children: [
          {
            path: 'login',
            Component: LoginPage,
          },
        ],
      },
      {
        // App routes (authenticated)
        path: 'app',
        Component: AppLayout,
        children: [
          {
            index: true,
            Component: HomePage,
          },
          {
            path: 'feed',
            Component: HomePage,
          },
          {
            path: 'messages',
            Component: ConversationsPage,
          },
          {
            path: 'friends',
            Component: ContactsPage,
          },
          {
            path: 'directory',
            Component: UserDirectory,
          },
          {
            path: 'analytics',
            Component: AnalyticsPage,
          },
          {
            path: 'bulk-operations',
            Component: BulkOperationsPage,
          },
          {
            path: 'contacts/:contactId',
            Component: ContactDetailPage,
          },
          {
            path: 'engagement',
            Component: EngagementPage,
          },
          {
            path: 'onboarding',
            Component: OnboardingDemoPage,
          },
          {
            path: 'notifications',
            Component: NotificationsDemoPage,
          },
          {
            path: 'privacy',
            Component: PrivacyDemoPage,
          },
          {
            path: 'security',
            Component: SecurityDemoPage,
          },
          {
            path: 'groups',
            children: [
              {
                index: true,
                Component: GroupsPage,
              },
              {
                path: ':groupId',
                Component: GroupLayout,
                children: [
                  {
                    index: true,
                    Component: GroupDashboard,
                  },
                  {
                    path: 'feed',
                    Component: GroupFeedPage,
                  },
                  {
                    path: 'members',
                    Component: GroupMembersPage,
                  },
                  {
                    path: 'settings',
                    Component: GroupSettingsPage,
                  },
                  {
                    path: 'messages',
                    Component: GroupMessagesPage,
                  },
                  //   {
                  //   path: 'events',
                  //   Component: EventsView,
                  // },
                  // Dynamically loaded module routes (group-scoped)
                  ...getModuleRoutes('group'),
                ],
              },
            ],
          },
          // Dynamically loaded module routes (app-scoped)
          ...getModuleRoutes('app'),
          {
            path: 'settings',
            Component: SettingsLayout,
            children: [
              {
                index: true,
                Component: ProfileSettings,
              },
              {
                path: 'profile',
                Component: ProfileSettings,
              },
              {
                path: 'security',
                Component: SecuritySettings,
              },
              {
                path: 'privacy',
                Component: PrivacySettings,
              },
              {
                path: 'notifications',
                Component: NotificationSettings,
              },
              {
                path: 'preferences',
                Component: PreferencesSettings,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        Component: NotFoundPage,
      },
    ],
  },
];

export const router = createBrowserRouter(getRoutes());

