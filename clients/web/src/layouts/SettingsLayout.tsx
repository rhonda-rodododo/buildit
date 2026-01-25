import { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { SettingsSidebar } from '@/components/navigation/SettingsSidebar';
import { SettingsMobileNav } from '@/components/navigation/SettingsMobileNav';

/**
 * Settings layout - wraps settings pages
 * Includes settings sidebar navigation (desktop) and dropdown (mobile)
 */
export const SettingsLayout: FC = () => {
  return (
    <div className="space-y-4">
      {/* Mobile settings dropdown */}
      <div className="lg:hidden">
        <SettingsMobileNav />
      </div>

      <div className="flex gap-6">
        {/* Desktop settings sidebar */}
        <SettingsSidebar className="hidden lg:flex" />

        {/* Settings content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
