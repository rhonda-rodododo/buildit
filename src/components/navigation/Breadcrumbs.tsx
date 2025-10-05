import { FC } from 'react';
import { Link, useMatches } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbMatch {
  pathname: string;
  handle?: {
    crumb?: (data?: unknown) => string;
  };
}

export const Breadcrumbs: FC = () => {
  const matches = useMatches() as BreadcrumbMatch[];

  const breadcrumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => ({
      pathname: match.pathname,
      label: match.handle!.crumb!(),
      isLast: false,
    }));

  // Mark last breadcrumb
  if (breadcrumbs.length > 0) {
    breadcrumbs[breadcrumbs.length - 1].isLast = true;
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      <Link
        to="/app"
        className="hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((crumb) => (
        <div key={crumb.pathname} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.pathname}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};
