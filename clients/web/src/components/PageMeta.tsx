/**
 * PageMeta Component
 *
 * Renders document metadata (title, description, Open Graph, Twitter Cards)
 * using React 19's native document metadata support.
 * Integrates with i18n for multilingual metadata.
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface PageMetaProps {
  /**
   * Translation key for the page title (e.g., 'messages.title')
   * Will be appended with ' | BuildIt Network'
   * Optional if `title` is provided
   */
  titleKey?: string;
  /**
   * Translation key for the page description (e.g., 'messages.description')
   * If not provided, falls back to 'meta.defaultDescription'
   */
  descriptionKey?: string;
  /**
   * Optional static title (overrides titleKey)
   */
  title?: string;
  /**
   * Optional static description (overrides descriptionKey)
   */
  description?: string;
  /**
   * Optional path for canonical URL (e.g., '/messages')
   */
  path?: string;
  /**
   * Optional keywords for SEO
   */
  keywords?: string[];
}

/**
 * PageMeta - Renders document metadata for SEO and social sharing
 *
 * Uses React 19's native metadata hoisting to place tags in <head>
 *
 * @example
 * // Using translation keys
 * <PageMeta titleKey="messages.title" descriptionKey="meta.messages" />
 *
 * @example
 * // Using static values (for dynamic content)
 * <PageMeta title="Group Name" description="Custom description" />
 */
export const PageMeta: FC<PageMetaProps> = ({
  titleKey,
  descriptionKey,
  title: staticTitle,
  description: staticDescription,
  path,
  keywords,
}) => {
  const { t } = useTranslation();

  // Get app name for title suffix
  const appName = t('app.name', 'BuildIt Network');

  // Resolve title - use static value or translated key
  const pageTitle = staticTitle || (titleKey ? t(titleKey) : appName);
  const fullTitle = staticTitle || titleKey ? `${pageTitle} | ${appName}` : appName;

  // Resolve description - use static value, translated key, or default
  const pageDescription = staticDescription ||
    (descriptionKey ? t(descriptionKey) : t('meta.defaultDescription'));

  // Build canonical URL if path provided
  const baseUrl = 'https://buildit.network';
  const canonicalUrl = path ? `${baseUrl}${path}` : undefined;

  // Build keywords string
  const keywordsString = keywords?.join(', ');

  return (
    <>
      {/* Primary metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={pageDescription} />
      {keywordsString && <meta name="keywords" content={keywordsString} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:site_name" content={appName} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={pageDescription} />
      {canonicalUrl && <meta name="twitter:url" content={canonicalUrl} />}
    </>
  );
};
