import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, AlertTriangle, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { MediaAttachment } from '@/types/media';
import { decryptFile } from '@/lib/media/mediaEncryption';

interface ImageGalleryProps {
  images: MediaAttachment[];
  onClose?: () => void;
  initialIndex?: number;
}

export const ImageGallery: FC<ImageGalleryProps> = ({
  images,
  onClose,
  initialIndex = 0,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [decryptedUrls, setDecryptedUrls] = useState<Record<string, string>>({});
  const [showBlurred, setShowBlurred] = useState<Record<string, boolean>>({});

  const currentImage = images[currentIndex];

  const handleDecrypt = async (image: MediaAttachment) => {
    if (!image.encrypted || !image.encryptionKey) return;

    try {
      const response = await fetch(image.url);
      const encryptedBlob = await response.blob();

      const decryptedBlob = await decryptFile(
        encryptedBlob,
        image.encryptionKey,
        '', // IV would be stored with the image metadata
        image.mimeType
      );

      const url = URL.createObjectURL(decryptedBlob);
      setDecryptedUrls(prev => ({ ...prev, [image.id]: url }));
    } catch (error) {
      console.error('Decryption failed:', error);
    }
  };

  const getImageUrl = (image: MediaAttachment) => {
    if (image.encrypted && decryptedUrls[image.id]) {
      return decryptedUrls[image.id];
    }
    return image.url;
  };

  const handleDownload = async (image: MediaAttachment) => {
    const url = getImageUrl(image);
    const a = document.createElement('a');
    a.href = url;
    a.download = image.filename;
    a.click();
  };

  const toggleBlur = (imageId: string) => {
    setShowBlurred(prev => ({ ...prev, [imageId]: !prev[imageId] }));
  };

  return (
    <Dialog open onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{currentImage.filename}</span>
              {currentImage.contentWarning && (
                <div className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">{t('media.sensitiveContent')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentImage.contentWarning && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleBlur(currentImage.id)}
                >
                  {showBlurred[currentImage.id] ? (
                    <><EyeOff className="h-4 w-4 mr-2" /> {t('common.hide')}</>
                  ) : (
                    <><Eye className="h-4 w-4 mr-2" /> {t('common.show')}</>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(currentImage)}
                aria-label={t('media.downloadImage')}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t('media.closeGallery')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-16">
            {currentImage.encrypted && !decryptedUrls[currentImage.id] ? (
              <div className="text-center space-y-4">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('media.imageEncrypted')}</p>
                <Button onClick={() => handleDecrypt(currentImage)}>
                  {t('media.decryptAndView')}
                </Button>
              </div>
            ) : (
              <img
                src={getImageUrl(currentImage)}
                alt={currentImage.alt || currentImage.filename}
                className={`max-w-full max-h-full object-contain ${
                  currentImage.contentWarning && !showBlurred[currentImage.id] ? 'blur-lg' : ''
                }`}
              />
            )}
          </div>

          {/* Navigation */}
          {images.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur p-4">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex((currentIndex - 1 + images.length) % images.length)}
                >
                  {t('common.previous')}
                </Button>
                <span className="text-sm">
                  {currentIndex + 1} / {images.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex((currentIndex + 1) % images.length)}
                >
                  {t('common.next')}
                </Button>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2 justify-center mt-4 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      index === currentIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={image.thumbnailUrl || image.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Simple Image Display Component
export const ImageDisplay: FC<{
  image: MediaAttachment;
  onClick?: () => void;
  className?: string;
}> = ({ image, onClick, className = '' }) => {
  const { t } = useTranslation();
  const [showBlurred, setShowBlurred] = useState(image.blurOnLoad || image.contentWarning);

  return (
    <div className={`relative ${className}`}>
      <img
        src={image.url}
        alt={image.alt || image.filename}
        className={`w-full h-full object-cover rounded-lg ${
          showBlurred ? 'blur-lg' : ''
        } ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      />
      {showBlurred && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowBlurred(false);
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            {t('media.showContent')}
          </Button>
        </div>
      )}
      {image.contentWarning && !showBlurred && (
        <div className="absolute top-2 right-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setShowBlurred(true);
            }}
            aria-label={t('media.hideContent')}
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      )}
      {onClick && (
        <div className="absolute bottom-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="icon" aria-label={t('media.viewFullscreen')}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Video Player Component
export const VideoPlayer: FC<{
  video: MediaAttachment;
  className?: string;
}> = ({ video, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <video
        src={video.url}
        controls
        className="w-full h-full rounded-lg"
      />
    </div>
  );
};

// Audio Player Component
export const AudioPlayer: FC<{
  audio: MediaAttachment;
  className?: string;
}> = ({ audio, className = '' }) => {
  return (
    <div className={`${className}`}>
      <audio
        src={audio.url}
        controls
        className="w-full"
      />
      <p className="text-sm text-muted-foreground mt-2">{audio.filename}</p>
    </div>
  );
};
