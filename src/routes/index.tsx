import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RootLayout } from '@/layouts/RootLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getAllModules } from '@/lib/modules/registry';

// Loading fallback component
const LoadingPage = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
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

// Wrapper to add Suspense to lazy-loaded components
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<LoadingPage />}>
    <Component />
  </Suspense>
);

/**
 * Get module routes by scope
 */
function getModuleRoutes(scope: 'app' | 'group'): RouteObject[] {
  try {
    const modules = getAllModules();
    return modules
      .filter((module) => module.routes && module.routes.length > 0)
      .flatMap((module) =>
        module.routes!
          .filter((route) => (route.scope || 'group') === scope)
          .map((route) => ({
            path: route.path,
            element: <route.component />,
          }))
      );
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
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        // Public routes (no auth required)
        path: 'campaigns/:slug',
        element: withSuspense(CampaignPage),
      },
      {
        path: 'wiki',
        children: [
          {
            index: true,
            element: withSuspense(PublicWikiPage),
          },
          {
            path: ':slug',
            element: withSuspense(PublicWikiPage),
          },
        ],
      },
      {
        // Auth routes (unauthenticated)
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: withSuspense(LoginPage),
          },
        ],
      },
      {
        // App routes (authenticated)
        path: 'app',
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: withSuspense(HomePage),
          },
          {
            path: 'feed',
            element: withSuspense(HomePage),
          },
          {
            path: 'messages',
            element: withSuspense(MessagesPage),
          },
          {
            path: 'analytics',
            element: withSuspense(AnalyticsPage),
          },
          {
            path: 'bulk-operations',
            element: withSuspense(BulkOperationsPage),
          },
          {
            path: 'contacts/:contactId',
            element: withSuspense(ContactDetailPage),
          },
          {
            path: 'engagement',
            element: withSuspense(EngagementPage),
          },
          {
            path: 'onboarding',
            element: withSuspense(OnboardingDemoPage),
          },
          {
            path: 'notifications',
            element: withSuspense(NotificationsDemoPage),
          },
          {
            path: 'privacy',
            element: withSuspense(PrivacyDemoPage),
          },
          {
            path: 'security',
            element: withSuspense(SecurityDemoPage),
          },
          {
            path: 'groups',
            children: [
              {
                index: true,
                element: withSuspense(GroupsPage),
              },
              {
                path: ':groupId',
                element: withSuspense(GroupLayout),
                children: [
                  {
                    index: true,
                    element: withSuspense(GroupDashboard),
                  },
                  {
                    path: 'feed',
                    element: withSuspense(GroupFeedPage),
                  },
                  {
                    path: 'members',
                    element: withSuspense(GroupMembersPage),
                  },
                  {
                    path: 'settings',
                    element: withSuspense(GroupSettingsPage),
                  },
                  {
                    path: 'messages',
                    element: withSuspense(GroupMessagesPage),
                  },
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
            element: withSuspense(SettingsLayout),
            children: [
              {
                index: true,
                element: withSuspense(ProfileSettings),
              },
              {
                path: 'profile',
                element: withSuspense(ProfileSettings),
              },
              {
                path: 'security',
                element: withSuspense(SecuritySettings),
              },
              {
                path: 'privacy',
                element: withSuspense(PrivacySettings),
              },
              {
                path: 'notifications',
                element: withSuspense(NotificationSettings),
              },
              {
                path: 'preferences',
                element: withSuspense(PreferencesSettings),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: withSuspense(NotFoundPage),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
