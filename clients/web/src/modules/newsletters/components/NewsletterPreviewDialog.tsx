/**
 * NewsletterPreviewDialog Component
 * Renders newsletter markdown/HTML to styled preview with mobile/desktop modes
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Monitor,
  Smartphone,
  X,
  Send,
  Mail,
} from 'lucide-react';
import type { NewsletterIssue, Newsletter } from '../types';
import { toast } from 'sonner';

type PreviewMode = 'desktop' | 'mobile';

interface NewsletterPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: NewsletterIssue;
  newsletter: Newsletter;
  /** Send test email callback - sends to the current user's Nostr DM */
  onSendTest?: () => void;
  className?: string;
}

export const NewsletterPreviewDialog: FC<NewsletterPreviewDialogProps> = ({
  open,
  onOpenChange,
  issue,
  newsletter,
  onSendTest,
}) => {
  const { t } = useTranslation();
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Build styled HTML for preview
  const renderedHtml = useMemo(() => {
    return buildStyledNewsletter(issue, newsletter);
  }, [issue, newsletter]);

  // Handle send test
  const handleSendTest = async () => {
    if (!onSendTest) return;
    setIsSendingTest(true);
    try {
      onSendTest();
      toast.success(t('newsletterPreview.testSent'));
    } catch {
      toast.error(t('newsletterPreview.testFailed'));
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t('newsletterPreview.title')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Preview Mode Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className="rounded-r-none"
                >
                  <Monitor className="h-4 w-4 mr-1" />
                  {t('newsletterPreview.desktop')}
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className="rounded-l-none"
                >
                  <Smartphone className="h-4 w-4 mr-1" />
                  {t('newsletterPreview.mobile')}
                </Button>
              </div>

              {/* Send Test */}
              {onSendTest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {isSendingTest
                    ? t('newsletterPreview.sending')
                    : t('newsletterPreview.sendTest')}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Metadata */}
        <div className="px-4 py-3 border-b flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('newsletterPreview.from')}:</span>{' '}
              <span className="font-medium">{newsletter.name}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div>
              <span className="text-muted-foreground">{t('newsletterPreview.subject')}:</span>{' '}
              <span className="font-medium">{issue.subject}</span>
            </div>
            {issue.previewText && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="truncate max-w-xs">
                  <span className="text-muted-foreground">{t('newsletterPreview.previewText')}:</span>{' '}
                  <span className="text-muted-foreground italic">{issue.previewText}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4">
          <div
            className={`bg-background border rounded-lg shadow-sm overflow-auto transition-all duration-300 ${
              previewMode === 'mobile'
                ? 'w-[375px] max-w-full'
                : 'w-full max-w-[640px]'
            }`}
          >
            {/* Device Frame (mobile only) */}
            {previewMode === 'mobile' && (
              <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground">
                    {t('newsletterPreview.mobilePreview')}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">375px</Badge>
              </div>
            )}

            {/* Rendered Newsletter */}
            <div
              className="newsletter-preview"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Build a fully styled HTML newsletter for preview.
 * Applies the newsletter theme and wraps content in a styled template.
 */
function buildStyledNewsletter(
  issue: NewsletterIssue,
  newsletter: Newsletter
): string {
  const theme = newsletter.theme;
  const content = issue.contentFormat === 'markdown'
    ? markdownToHtml(issue.content)
    : issue.content;

  const fontFamilyMap: Record<string, string> = {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    serif: 'Georgia, "Times New Roman", Times, serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Courier, monospace',
  };

  const fontFamily = fontFamilyMap[theme.fontFamily] || fontFamilyMap.sans;

  return `
    <div style="
      font-family: ${fontFamily};
      color: ${theme.textColor};
      background-color: ${theme.backgroundColor};
      max-width: 100%;
      margin: 0;
      padding: 0;
    ">
      <!-- Header -->
      ${newsletter.headerImage ? `
        <div style="width: 100%; overflow: hidden;">
          <img
            src="${escapeHtml(newsletter.headerImage)}"
            alt="${escapeHtml(newsletter.name)}"
            style="width: 100%; height: auto; display: block;"
          />
        </div>
      ` : ''}

      <!-- Newsletter Name -->
      <div style="
        padding: 24px 24px 16px;
        text-align: center;
        border-bottom: 1px solid #e5e7eb;
      ">
        <h1 style="
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: ${theme.primaryColor};
        ">${escapeHtml(newsletter.name)}</h1>
      </div>

      <!-- Subject Line -->
      <div style="padding: 24px 24px 8px;">
        <h2 style="
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.3;
          color: ${theme.textColor};
        ">${escapeHtml(issue.subject)}</h2>
      </div>

      ${issue.previewText ? `
        <div style="padding: 0 24px 16px;">
          <p style="
            margin: 0;
            font-size: 16px;
            color: #6b7280;
            line-height: 1.5;
          ">${escapeHtml(issue.previewText)}</p>
        </div>
      ` : ''}

      <div style="
        padding: 0 24px;
        margin-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      "></div>

      <!-- Content -->
      <div style="
        padding: 16px 24px;
        line-height: 1.7;
        font-size: 16px;
      ">
        ${content}
      </div>

      <!-- Footer -->
      <div style="
        padding: 24px;
        margin-top: 16px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 13px;
        color: #9ca3af;
      ">
        ${newsletter.footerText ? `<p style="margin: 0 0 8px;">${escapeHtml(newsletter.footerText)}</p>` : ''}
        <p style="margin: 0;">
          Sent via ${escapeHtml(newsletter.name)} on BuildIt Network
        </p>
        <p style="margin: 8px 0 0;">
          <a href="#" style="color: ${theme.linkColor}; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * Simple markdown to HTML converter for preview purposes.
 * Handles common markdown patterns.
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb;">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 3px solid #d1d5db; padding-left: 16px; color: #6b7280; margin: 16px 0;">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul style="padding-left: 20px;">$&</ul>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p style="margin: 16px 0;">');
  html = `<p style="margin: 16px 0;">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p style="margin: 16px 0;"><\/p>/g, '');
  html = html.replace(/<p style="margin: 16px 0;">(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');

  return html;
}

/**
 * Escape HTML entities to prevent XSS in preview
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
