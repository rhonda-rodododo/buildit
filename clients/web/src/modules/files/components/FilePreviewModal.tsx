/**
 * File Preview Modal
 * Preview files with support for images, PDFs, videos, audio, text, and code files
 * Epic 57: Enhanced preview with syntax highlighting, markdown rendering, archives, office, and 3D
 */

import { useState, useEffect, useCallback, FC, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Download, Share2, Clock, RotateCcw, Code2, Folder, File, FileText, Archive } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Prism as SyntaxHighlighterBase } from 'react-syntax-highlighter'
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Type fix for react-syntax-highlighter (strict mode compatibility)
const SyntaxHighlighter = SyntaxHighlighterBase as unknown as FC<SyntaxHighlighterProps>
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fileManager } from '../fileManager'
import { useFilesStore } from '../filesStore'
import type { FilePreview, FileVersion, ArchiveEntry } from '../types'

// Lazy load Three.js for 3D model preview
const Model3DPreview = lazy(() => import('./Model3DPreview').then(m => ({ default: m.Model3DPreview })))

interface FilePreviewModalProps {
  fileId: string
  groupKey?: Uint8Array
  onClose: () => void
  onShare?: () => void
}

export function FilePreviewModal({ fileId, groupKey, onClose, onShare }: FilePreviewModalProps) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const file = useFilesStore((state) => state.getFile(fileId))

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const preview = await fileManager.getFilePreview(fileId, groupKey)
      setPreview(preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }, [fileId, groupKey])

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const fileVersions = await fileManager.getFileVersions(fileId)
      setVersions(fileVersions)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoadingVersions(false)
    }
  }, [fileId])

  useEffect(() => {
    loadPreview()
    loadVersions()
  }, [loadPreview, loadVersions])

  const handleDownload = async () => {
    if (!file) return
    try {
      const blob = await fileManager.getFileBlob(fileId, groupKey)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!confirm(`Restore file to version ${versionNumber}?`)) return

    try {
      await fileManager.restoreFileVersion(fileId, versionNumber)
      await loadPreview() // Reload preview
      await loadVersions() // Reload versions
      alert('Version restored successfully')
    } catch (err) {
      console.error('Failed to restore version:', err)
      alert('Failed to restore version')
    }
  }

  if (!file) {
    return null
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{file.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t('files:fileSizeAndType', { size: (file.size / 1024 / 1024).toFixed(2), type: file.mimeType })}
            </p>
          </div>
          <div className="flex gap-2">
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="h-4 w-4 mr-2" />
                {t('filePreview.share')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {t('filePreview.download')}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">{t('filePreview.loadingPreview')}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-destructive">
                <p className="font-semibold">{t('filePreview.failedToLoad')}</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && preview && (
            <>
              {/* Image Preview */}
              {preview.type === 'image' && preview.url && (
                <div className="flex items-center justify-center h-full bg-muted/10">
                  <img
                    src={preview.url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {/* PDF Preview */}
              {preview.type === 'pdf' && preview.url && (
                <iframe
                  src={preview.url}
                  className="w-full h-full border-0"
                  title={file.name}
                />
              )}

              {/* Video Preview */}
              {preview.type === 'video' && preview.url && (
                <div className="flex items-center justify-center h-full bg-black">
                  <video
                    src={preview.url}
                    controls
                    className="max-w-full max-h-full"
                  >
                    {t('filePreview.videoNotSupported')}
                  </video>
                </div>
              )}

              {/* Audio Preview */}
              {preview.type === 'audio' && preview.url && (
                <div className="flex items-center justify-center h-full">
                  <div className="w-full max-w-2xl">
                    <audio
                      src={preview.url}
                      controls
                      className="w-full"
                    >
                      {t('filePreview.audioNotSupported')}
                    </audio>
                  </div>
                </div>
              )}

              {/* Text/Code Preview with Syntax Highlighting */}
              {preview.type === 'text' && preview.content && (
                <div className="h-full overflow-auto">
                  {preview.language === 'markdown' ? (
                    // Markdown preview with GFM support
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {preview.content}
                      </ReactMarkdown>
                    </div>
                  ) : preview.language ? (
                    // Code with syntax highlighting
                    <div className="relative">
                      <Badge variant="secondary" className="absolute top-2 right-2 z-10 text-xs">
                        <Code2 className="h-3 w-3 mr-1" />
                        {preview.language}
                      </Badge>
                      <SyntaxHighlighter
                        language={preview.language}
                        style={oneDark}
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          minHeight: '100%',
                          fontSize: '0.875rem',
                        }}
                        showLineNumbers
                        wrapLines
                      >
                        {preview.content}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    // Plain text
                    <pre className="p-4 text-sm overflow-auto h-full whitespace-pre-wrap font-mono bg-muted/10 rounded-lg">
                      {preview.content}
                    </pre>
                  )}
                </div>
              )}

              {/* Epic 57: Office File Preview */}
              {preview.type === 'office' && preview.url && (
                <div className="flex flex-col items-center justify-center h-full bg-muted/10 p-8">
                  <FileText className="h-16 w-16 text-blue-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('filePreview.officeDocument')}</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    {t('filePreview.officeDesc')}
                    <br />
                    {t('filePreview.officeApps')}
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('filePreview.downloadToView')}
                  </Button>
                </div>
              )}

              {/* Epic 57: Archive Preview */}
              {preview.type === 'archive' && preview.archiveContents && (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                    <Archive className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">{t('filePreview.archiveContents')}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {t('filePreview.itemsCount', { count: preview.archiveContents.length })}
                    </Badge>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2">
                      {preview.archiveContents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {t('filePreview.emptyArchive')}
                        </p>
                      ) : (
                        <ArchiveContentsList entries={preview.archiveContents} />
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Epic 57: 3D Model Preview */}
              {preview.type === '3d' && preview.url && (
                <div className="h-full">
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">{t('filePreview.loading3D')}</p>
                      </div>
                    </div>
                  }>
                    <Model3DPreview
                      url={preview.url}
                      filename={file.name}
                    />
                  </Suspense>
                </div>
              )}

              {/* No Preview Available */}
              {preview.type === 'none' && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <p>{t('filePreview.noPreview')}</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('filePreview.downloadToViewShort')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Metadata Tabs */}
        <Tabs defaultValue="details" className="border-t pt-4">
          <TabsList>
            <TabsTrigger value="details">{t('filePreview.detailsTab')}</TabsTrigger>
            <TabsTrigger value="activity">{t('filePreview.activityTab')}</TabsTrigger>
            <TabsTrigger value="versions">{t('filePreview.versionsTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('filePreview.fileType')}</p>
                <p className="font-medium">{file.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('filePreview.size')}</p>
                <p className="font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('filePreview.uploaded')}</p>
                <p className="font-medium">{new Date(file.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('filePreview.modified')}</p>
                <p className="font-medium">{new Date(file.updatedAt).toLocaleDateString()}</p>
              </div>
              {file.isEncrypted && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">{t('filePreview.encryption')}</p>
                  <p className="font-medium text-green-600 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-600 rounded-full" />
                    {t('filePreview.e2eEncrypted')}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="activity">
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('filePreview.fileUploaded')}</p>
                  <p className="text-muted-foreground">
                    {new Date(file.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {file.createdAt !== file.updatedAt && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('filePreview.fileModified')}</p>
                    <p className="text-muted-foreground">
                      {new Date(file.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="versions">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">{t('filePreview.loadingVersions')}</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">{t('filePreview.noVersionHistory')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium mb-2">{t('filePreview.versionHistory')}</p>
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {t('filePreview.version', { number: version.version })}
                            {version.version === file.version && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {t('filePreview.current')}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()} •{' '}
                          {(version.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {version.changeDescription && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {version.changeDescription}
                          </p>
                        )}
                      </div>
                      {version.version !== file.version && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreVersion(version.version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {t('filePreview.restore')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Epic 57: Archive contents list component
 */
function ArchiveContentsList({ entries }: { entries: ArchiveEntry[] }) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, index) => (
        <div
          key={`${entry.path}-${index}`}
          className="flex items-center gap-2 p-2 rounded hover:bg-accent text-sm"
        >
          {entry.isDirectory ? (
            <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="flex-1 truncate" title={entry.path}>
            {entry.path}
          </span>
          <span className="text-muted-foreground text-xs flex-shrink-0">
            {formatSize(entry.size)}
          </span>
        </div>
      ))}
    </div>
  )
}
