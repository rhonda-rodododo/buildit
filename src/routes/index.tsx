import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { MessagesPage } from '@/pages/MessagesPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupLayout } from '@/layouts/GroupLayout';
import { GroupDashboard } from '@/pages/GroupDashboard';
import { SettingsLayout } from '@/layouts/SettingsLayout';
import { ProfileSettings } from '@/pages/settings/ProfileSettings';
import { SecuritySettings } from '@/pages/settings/SecuritySettings';
import { PrivacySettings } from '@/pages/settings/PrivacySettings';
import { NotificationSettings } from '@/pages/settings/NotificationSettings';
import { PreferencesSettings } from '@/pages/settings/PreferencesSettings';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getAllModules } from '@/lib/modules/registry';
import { CampaignPage } from '@/pages/public/CampaignPage';
import { PublicWikiPage } from '@/pages/public/PublicWikiPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';

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
        element: <CampaignPage />,
      },
      {
        path: 'wiki',
        children: [
          {
            index: true,
            element: <PublicWikiPage />,
          },
          {
            path: ':slug',
            element: <PublicWikiPage />,
          },
        ],
      },
      {
        // Auth routes (unauthenticated)
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <LoginPage />,
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
            element: <HomePage />,
          },
          {
            path: 'feed',
            element: <HomePage />,
          },
          {
            path: 'messages',
            element: <MessagesPage />,
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
          },
          {
            path: 'groups',
            children: [
              {
                index: true,
                element: <GroupsPage />,
              },
              {
                path: ':groupId',
                element: <GroupLayout />,
                children: [
                  {
                    index: true,
                    element: <GroupDashboard />,
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
            element: <SettingsLayout />,
            children: [
              {
                index: true,
                element: <ProfileSettings />,
              },
              {
                path: 'profile',
                element: <ProfileSettings />,
              },
              {
                path: 'security',
                element: <SecuritySettings />,
              },
              {
                path: 'privacy',
                element: <PrivacySettings />,
              },
              {
                path: 'notifications',
                element: <NotificationSettings />,
              },
              {
                path: 'preferences',
                element: <PreferencesSettings />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
