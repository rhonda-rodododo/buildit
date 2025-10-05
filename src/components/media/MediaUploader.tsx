import { FC, useState, useCallback, useRef } from 'react';
import { Upload, X, AlertTriangle, Lock, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MediaMetadata, MediaUploadProgress, MediaPrivacyLevel, MediaStorageProvider } from '@/types/media';
import { DEFAULT_MEDIA_CONFIG } from '@/types/media';
import { stripExif, generateThumbnail, isExifCapable } from '@/lib/media/exifStripper';
import { encryptMediaWithThumbnail } from '@/lib/media/mediaEncryption';
import { uploadMedia } from '@/lib/media/mediaStorage';
import { useAuthStore } from '@/stores/authStore';

interface MediaUploaderProps {
  onUploadComplete: (metadata: MediaMetadata) => void;
  onCancel?: () => void;
  accept?: string; // MIME types to accept
  maxFiles?: number;
  defaultPrivacyLevel?: MediaPrivacyLevel;
  defaultStorageProvider?: MediaStorageProvider;
  allowEncryption?: boolean;
  className?: string;
}

export const MediaUploader: FC<MediaUploaderProps> = ({
  onUploadComplete,
  onCancel,
  accept,
  maxFiles = 1,
  defaultPrivacyLevel = 'group',
  defaultStorageProvider = 'nip96',
  allowEncryption = true,
  className = '',
}) => {
  const { currentIdentity } = useAuthStore();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<MediaUploadProgress[]>([]);
  const [stripEXIF, setStripEXIF] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [contentWarning, setContentWarning] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState<MediaPrivacyLevel>(defaultPrivacyLevel);
  const [storageProvider, setStorageProvider] = useState<MediaStorageProvider>(defaultStorageProvider);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = Array.from(selectedFiles).slice(0, maxFiles);

    // Validate file sizes
    for (const file of newFiles) {
      const config = DEFAULT_MEDIA_CONFIG;
      const mediaType = file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('video/') ? 'video' :
        file.type.startsWith('audio/') ? 'audio' : 'document';

      if (file.size > config.maxFileSize[mediaType]) {
        alert(`File ${file.name} exceeds maximum size for ${mediaType}`);
        return;
      }
    }

    setFiles(newFiles);
    setProgress(newFiles.map(f => ({
      id: crypto.randomUUID(),
      filename: f.name,
      progress: 0,
      status: 'pending',
    })));
  }, [maxFiles]);

  const handleUpload = async () => {
    if (!currentIdentity) {
      alert('Please login first');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progressId = progress[i].id;

      try {
        // Update status
        setProgress(prev => prev.map(p =>
          p.id === progressId ? { ...p, status: 'processing' } : p
        ));

        let processedFile: File = file;
        let thumbnail: File | undefined;
        let exifStripped = false;

        // Strip EXIF if enabled and file is capable
        if (stripEXIF && isExifCapable(file)) {
          setProgress(prev => prev.map(p =>
            p.id === progressId ? { ...p, progress: 10 } : p
          ));

          const { file: strippedFile } = await stripExif(file, {
            maxWidth: DEFAULT_MEDIA_CONFIG.imageCompression.maxWidth,
            maxHeight: DEFAULT_MEDIA_CONFIG.imageCompression.maxHeight,
            quality: DEFAULT_MEDIA_CONFIG.imageCompression.quality,
          });

          processedFile = strippedFile;
          exifStripped = true;
        }

        // Generate thumbnail for images
        if (file.type.startsWith('image/')) {
          setProgress(prev => prev.map(p =>
            p.id === progressId ? { ...p, progress: 20 } : p
          ));

          thumbnail = await generateThumbnail(
            processedFile,
            DEFAULT_MEDIA_CONFIG.thumbnailSize.width,
            DEFAULT_MEDIA_CONFIG.thumbnailSize.height
          );
        }

        let uploadFile: File | Blob = processedFile;
        let encryptionKey: string | undefined;

        // Encrypt if enabled
        if (encrypt && allowEncryption) {
          setProgress(prev => prev.map(p =>
            p.id === progressId ? { ...p, status: 'encrypting', progress: 30 } : p
          ));

          const encrypted = await encryptMediaWithThumbnail(processedFile, thumbnail);
          uploadFile = encrypted.encryptedFile;
          encryptionKey = encrypted.keyString;
        }

        // Upload
        setProgress(prev => prev.map(p =>
          p.id === progressId ? { ...p, status: 'uploading', progress: 40 } : p
        ));

        const result = await uploadMedia({
          provider: storageProvider,
          file: uploadFile,
          metadata: {
            type: file.type.startsWith('image/') ? 'image' :
              file.type.startsWith('video/') ? 'video' :
              file.type.startsWith('audio/') ? 'audio' : 'document',
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            privacyLevel,
            encrypted: encrypt,
            encryptionKey,
            exifStripped,
            contentWarning,
            caption: captions[file.name],
            alt: altTexts[file.name],
          },
          privateKey: currentIdentity.privateKey,
          onProgress: (prog) => {
            setProgress(prev => prev.map(p =>
              p.id === progressId ? { ...p, progress: 40 + (prog * 0.6) } : p
            ));
          },
        });

        // Complete
        setProgress(prev => prev.map(p =>
          p.id === progressId ? { ...p, status: 'complete', progress: 100 } : p
        ));

        onUploadComplete(result.metadata);

      } catch (error) {
        console.error('Upload error:', error);
        setProgress(prev => prev.map(p =>
          p.id === progressId ? { ...p, status: 'error', error: String(error) } : p
        ));
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Input */}
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Click to select {maxFiles > 1 ? 'files' : 'a file'} or drag and drop
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file, index) => (
            <div key={index} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFiles(prev => prev.filter((_, i) => i !== index));
                    setProgress(prev => prev.filter((_, i) => i !== index));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress */}
              {progress[index] && progress[index].status !== 'pending' && (
                <div className="space-y-1">
                  <Progress value={progress[index].progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {progress[index].status === 'complete' ? 'Complete' :
                      progress[index].status === 'error' ? `Error: ${progress[index].error}` :
                      progress[index].status}
                  </p>
                </div>
              )}

              {/* Caption and Alt Text */}
              <div className="mt-3 space-y-2">
                <Input
                  placeholder="Caption (optional)"
                  value={captions[file.name] || ''}
                  onChange={(e) => setCaptions({ ...captions, [file.name]: e.target.value })}
                />
                {file.type.startsWith('image/') && (
                  <Input
                    placeholder="Alt text for accessibility"
                    value={altTexts[file.name] || ''}
                    onChange={(e) => setAltTexts({ ...altTexts, [file.name]: e.target.value })}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {files.length > 0 && (
        <div className="space-y-4 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold">Upload Settings</h3>

          {/* Privacy Level */}
          <div className="space-y-2">
            <Label>Privacy Level</Label>
            <Select value={privacyLevel} onValueChange={(v) => setPrivacyLevel(v as MediaPrivacyLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="group">Group Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="encrypted">Encrypted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Storage Provider */}
          <div className="space-y-2">
            <Label>Storage Provider</Label>
            <Select value={storageProvider} onValueChange={(v) => setStorageProvider(v as MediaStorageProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nip96">NIP-96 (HTTP Storage)</SelectItem>
                <SelectItem value="nip94">NIP-94 (File Metadata)</SelectItem>
                <SelectItem value="blossom">Blossom (Decentralized)</SelectItem>
                <SelectItem value="ipfs">IPFS</SelectItem>
                <SelectItem value="local">Local (Dev)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Strip EXIF */}
          {files.some(f => isExifCapable(f)) && (
            <div className="flex items-center justify-between">
              <Label htmlFor="strip-exif">Strip EXIF Data (Privacy)</Label>
              <Switch
                id="strip-exif"
                checked={stripEXIF}
                onCheckedChange={setStripEXIF}
              />
            </div>
          )}

          {/* Encryption */}
          {allowEncryption && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <Label htmlFor="encrypt">Encrypt Media</Label>
              </div>
              <Switch
                id="encrypt"
                checked={encrypt}
                onCheckedChange={setEncrypt}
              />
            </div>
          )}

          {/* Content Warning */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <Label htmlFor="content-warning">Content Warning</Label>
              </div>
              <Switch
                id="content-warning"
                checked={contentWarning}
                onCheckedChange={setContentWarning}
              />
            </div>
            {contentWarning && (
              <Textarea
                placeholder="Describe the sensitive content..."
                rows={2}
              />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={progress.some(p => p.status === 'uploading' || p.status === 'processing')}
            className="flex-1"
          >
            Upload {files.length > 1 ? `${files.length} Files` : 'File'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
