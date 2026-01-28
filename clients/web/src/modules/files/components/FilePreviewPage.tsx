/**
 * File Preview Page
 * Full-page version of the file preview
 * Route: /app/groups/:groupId/files/:fileId
 */

import { FC, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Clock, RotateCcw, File, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Prism as SyntaxHighlighterBase } from 'react-syntax-highlighter';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fileManager } from '../fileManager';
import { useFilesStore } from '../filesStore';
import type { FilePreview, FileVersion } from '../types';
import { format } from 'date-fns';

// Type fix for react-syntax-highlighter (strict mode compatibility)
const SyntaxHighlighter = SyntaxHighlighterBase as unknown as FC<SyntaxHighlighterProps>;

// Lazy load Three.js for 3D model preview
const Model3DPreview = lazy(() => import('./Model3DPreview').then(m => ({ default: m.Model3DPreview })));

export const FilePreviewPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId, fileId } = useParams<{ groupId: string; fileId: string }>();

  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const file = useFilesStore((state) => fileId ? state.getFile(fileId) : null);

  const loadPreview = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    try {
      const preview = await fileManager.getFilePreview(fileId);
      setPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const loadVersions = useCallback(async () => {
    if (!fileId) return;
    setLoadingVersions(true);
    try {
      const fileVersions = await fileManager.getFileVersions(fileId);
      setVersions(fileVersions);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  }, [fileId]);

  useEffect(() => {
    loadPreview();
    loadVersions();
  }, [loadPreview, loadVersions]);

  const handleDownload = async () => {
    if (!file || !fileId) return;
    try {
      const blob = await fileManager.getFileBlob(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!fileId || !confirm(`Restore file to version ${versionNumber}?`)) return;

    try {
      await fileManager.restoreFileVersion(fileId, versionNumber);
      await loadPreview();
      await loadVersions();
      alert('Version restored successfully');
    } catch (err) {
      console.error('Failed to restore version:', err);
      alert('Failed to restore version');
    }
  };

  const handleBack = () => {
    if (groupId) {
      navigate(`/app/groups/${groupId}/files`);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="container max-w-4xl py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('filePreview.notFound', 'File not found')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <File className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {t('filePreview.download', 'Download File')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPreviewContent = () => {
    if (!preview) return null;

    switch (preview.type) {
      case 'image':
        return (
          <div className="flex items-center justify-center bg-muted/20 rounded-lg p-4">
            <img
              src={preview.url}
              alt={file.name}
              className="max-w-full max-h-[60vh] object-contain rounded"
            />
          </div>
        );

      case 'video':
        return (
          <div className="bg-muted/20 rounded-lg p-4">
            <video
              src={preview.url}
              controls
              className="max-w-full max-h-[60vh] mx-auto rounded"
            />
          </div>
        );

      case 'audio':
        return (
          <div className="bg-muted/20 rounded-lg p-8">
            <audio src={preview.url} controls className="w-full" />
          </div>
        );

      case 'pdf':
        return (
          <div className="bg-muted/20 rounded-lg h-[70vh]">
            <iframe
              src={preview.url}
              className="w-full h-full rounded"
              title={file.name}
            />
          </div>
        );

      case 'code':
        return (
          <ScrollArea className="h-[60vh] rounded-lg border">
            <SyntaxHighlighter
              language={preview.language || 'text'}
              style={oneDark}
              customStyle={{ margin: 0, borderRadius: '0.5rem' }}
              showLineNumbers
            >
              {preview.content || ''}
            </SyntaxHighlighter>
          </ScrollArea>
        );

      case 'text':
        return (
          <ScrollArea className="h-[60vh] rounded-lg border p-4 bg-muted/20">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {preview.content}
            </pre>
          </ScrollArea>
        );

      case '3d':
        return (
          <div className="h-[60vh] rounded-lg overflow-hidden">
            <Suspense fallback={
              <div className="h-full flex items-center justify-center bg-muted/20">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <Model3DPreview url={preview.url || ''} filename={file.name} />
            </Suspense>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-lg">
            <File className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {t('filePreview.noPreview', 'No preview available for this file type')}
            </p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {t('filePreview.download', 'Download File')}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Back button */}
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back', 'Back')}
      </Button>

      <Card>
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{file.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('files:fileSizeAndType', { size: (file.size / 1024 / 1024).toFixed(2), type: file.mimeType })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                {t('filePreview.download', 'Download')}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent justify-start px-4">
              <TabsTrigger value="preview" className="gap-2">
                <FileText className="h-4 w-4" />
                {t('filePreview.tabs.preview', 'Preview')}
              </TabsTrigger>
              <TabsTrigger value="versions" className="gap-2">
                <Clock className="h-4 w-4" />
                {t('filePreview.tabs.versions', 'Versions')}
                {versions.length > 1 && (
                  <Badge variant="secondary" className="ml-1">
                    {versions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="p-4 mt-0">
              {renderPreviewContent()}
            </TabsContent>

            <TabsContent value="versions" className="p-4 mt-0">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('filePreview.noVersions', 'No version history available')}
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.version}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                    >
                      <div>
                        <p className="font-medium">
                          {t('filePreview.versionLabel', 'Version {{number}}', {
                            number: version.version,
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(version.createdAt), 'PPp')} •{' '}
                          {(version.size / 1024).toFixed(1)} KB
                        </p>
                        {version.changeDescription && (
                          <p className="text-sm mt-1">{version.changeDescription}</p>
                        )}
                      </div>
                      {version.version !== versions[0]?.version && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreVersion(version.version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {t('filePreview.restore', 'Restore')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FilePreviewPage;
