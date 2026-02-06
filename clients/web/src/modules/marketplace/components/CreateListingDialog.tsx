/**
 * CreateListingDialog Component
 * Create or edit a marketplace listing
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { Listing, ListingType, ContactMethod } from '../types';

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing?: Listing; // if editing
  onSave: (data: {
    type: ListingType;
    title: string;
    description: string;
    price?: number;
    currency?: string;
    images?: string[];
    availability?: string;
    tags?: string[];
    expiresAt?: number;
    contactMethod?: ContactMethod;
  }) => void;
}

export function CreateListingDialog({
  open,
  onOpenChange,
  listing,
  onSave,
}: CreateListingDialogProps) {
  const { t } = useTranslation();
  const isEditing = !!listing;

  const [type, setType] = useState<ListingType>('product');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [availability, setAvailability] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [contactMethod, setContactMethod] = useState<ContactMethod>('dm');
  const [expirationDays, setExpirationDays] = useState<string>('30');

  // Reset form when dialog opens/closes or when editing a listing
  useEffect(() => {
    if (open && listing) {
      setType(listing.type);
      setTitle(listing.title);
      setDescription(listing.description ?? '');
      setPriceText(listing.price ? (listing.price / 100).toString() : '');
      setCurrency(listing.currency ?? 'USD');
      setAvailability(listing.availability ?? '');
      setTags(listing.tags ?? []);
      setContactMethod(listing.contactMethod ?? 'dm');
    } else if (open && !listing) {
      setType('product');
      setTitle('');
      setDescription('');
      setPriceText('');
      setCurrency('USD');
      setAvailability('');
      setTags([]);
      setContactMethod('dm');
      setExpirationDays('30');
    }
  }, [open, listing]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 20) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const price = priceText ? Math.round(parseFloat(priceText) * 100) : undefined;
    const days = parseInt(expirationDays, 10);
    const expiresAt = days > 0 ? Date.now() + days * 86400000 : undefined;

    onSave({
      type,
      title: title.trim(),
      description: description.trim(),
      price: price && price > 0 ? price : undefined,
      currency,
      availability: availability.trim() || undefined,
      tags,
      expiresAt,
      contactMethod,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('marketplace.editListing') : t('marketplace.createListing')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>{t('marketplace.category', 'Category')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as ListingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">{t('marketplace.products')}</SelectItem>
                <SelectItem value="service">{t('marketplace.services')}</SelectItem>
                <SelectItem value="co-op">{t('marketplace.coops')}</SelectItem>
                <SelectItem value="initiative">{t('marketplace.initiatives')}</SelectItem>
                <SelectItem value="resource">{t('marketplace.resources')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="listing-title">{t('marketplace.title', 'Title')}</Label>
            <Input
              id="listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you offering?"
              maxLength={256}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="listing-description">{t('marketplace.description', 'Description')}</Label>
            <Textarea
              id="listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your listing in detail..."
              rows={4}
              maxLength={8192}
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="listing-price">{t('marketplace.price')} ({t('marketplace.optional', 'optional')})</Label>
              <Input
                id="listing-price"
                type="number"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('marketplace.currency', 'Currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-2">
            <Label htmlFor="listing-availability">{t('marketplace.availability')}</Label>
            <Input
              id="listing-availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g., Weekdays 9-5, Immediate, Ships in 3-5 days"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>{t('marketplace.tags')}</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                maxLength={64}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 20}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label>{t('marketplace.expiration', 'Listing Duration')}</Label>
            <Select value={expirationDays} onValueChange={setExpirationDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="0">No expiration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Method */}
          <div className="space-y-2">
            <Label>{t('marketplace.contactMethod', 'Contact Method')}</Label>
            <Select value={contactMethod} onValueChange={(v) => setContactMethod(v as ContactMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dm">Direct Message (NIP-17)</SelectItem>
                <SelectItem value="public-reply">Public Reply</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {isEditing ? t('common.save', 'Save') : t('marketplace.createListing')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
