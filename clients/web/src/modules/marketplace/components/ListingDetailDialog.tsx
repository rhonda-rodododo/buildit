/**
 * ListingDetailDialog Component
 * Full listing view with image gallery, description, reviews, and contact
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { MapPin, Star, MessageSquare, Flag, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { formatListingPrice } from '../marketplaceManager';
import { useReviews } from '../hooks/useMarketplace';
import type { Listing, LocationValue } from '../types';
import { SocialShareDialog } from '@/modules/social-publishing/components/SocialShareDialog';

interface ListingDetailDialogProps {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListingDetailDialog({ listing, open, onOpenChange }: ListingDetailDialogProps) {
  const { t } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  const { reviews, averageRating, submitReview } = useReviews(listing?.id ?? '');

  if (!listing) return null;

  const handleSubmitReview = () => {
    if (reviewText.trim()) {
      submitReview(reviewRating, reviewText.trim());
      setReviewText('');
      setReviewRating(5);
      setShowReviewForm(false);
    }
  };

  const handleContactSeller = () => {
    // In a full implementation, this would open a NIP-17 DM with the seller
    // For now, we indicate this is future functionality
  };

  const images = listing.images ?? [];
  const tags = listing.tags ?? [];
  const location = listing.location as LocationValue | undefined;

  const nextImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((i) => (i + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((i) => (i - 1 + images.length) % images.length);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{listing.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={images[currentImageIndex]}
                alt={`${listing.title} - image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        className={`w-2 h-2 rounded-full ${
                          idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                        onClick={() => setCurrentImageIndex(idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Price and Status */}
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">
              {formatListingPrice(listing.price, listing.currency)}
            </p>
            <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
              {listing.status}
            </Badge>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-medium mb-2">{t('marketplace.description', 'Description')}</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{location.label}</span>
              <Badge variant="outline" className="text-xs">
                {location.precision}
              </Badge>
            </div>
          )}

          {/* Availability */}
          {listing.availability && (
            <div>
              <h4 className="font-medium mb-1">{t('marketplace.availability')}</h4>
              <p className="text-sm text-muted-foreground">{listing.availability}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleContactSeller}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('marketplace.contactSeller')}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Flag className="h-4 w-4" />
            </Button>
          </div>

          <SocialShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            sourceModule="marketplace"
            sourceContentId={listing.id}
            title={listing.title}
            description={listing.description || ''}
            contentUrl={`${window.location.origin}/marketplace/${listing.id}`}
          />

          <Separator />

          {/* Reviews Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{t('marketplace.reviews')}</h4>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({reviews.length})</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewForm(!showReviewForm)}
              >
                {t('marketplace.writeReview')}
              </Button>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <div className="border rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= reviewRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write your review..."
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button size="sm" onClick={handleSubmitReview} disabled={!reviewText.trim()}>
                    {t('common.submit', 'Submit')}
                  </Button>
                </div>
              </div>
            )}

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('marketplace.noReviews')}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{review.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
