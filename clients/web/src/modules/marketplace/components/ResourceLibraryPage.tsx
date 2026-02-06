/**
 * ResourceLibraryPage Component
 * Tool, space, and vehicle sharing library
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Wrench,
  Building2,
  Car,
  MapPin,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { useResourceShares } from '../hooks/useMarketplace';
import { getDayLabel } from '../marketplaceManager';
import type { ResourceShare, ResourceType } from '../types';

const resourceTypeIcons: Record<ResourceType, React.ElementType> = {
  tool: Wrench,
  space: Building2,
  vehicle: Car,
};

const resourceTypeLabels: Record<ResourceType, string> = {
  tool: 'Tool',
  space: 'Space',
  vehicle: 'Vehicle',
};

export function ResourceLibraryPage() {
  const { t } = useTranslation();
  const { resources, shareResource } = useResourceShares();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [formType, setFormType] = useState<ResourceType>('tool');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDeposit, setFormDeposit] = useState(false);
  const [formDepositAmount, setFormDepositAmount] = useState('');

  const filteredResources =
    filterType === 'all'
      ? resources
      : resources.filter((r) => r.resourceType === filterType);

  const handleCreate = () => {
    if (formName.trim()) {
      shareResource({
        resourceType: formType,
        name: formName.trim(),
        description: formDescription.trim(),
        availability: [],
        depositRequired: formDeposit,
        depositAmount: formDeposit ? Math.round(parseFloat(formDepositAmount) * 100) || 0 : undefined,
        depositCurrency: formDeposit ? 'USD' : undefined,
      });
      setFormName('');
      setFormDescription('');
      setFormDeposit(false);
      setFormDepositAmount('');
      setShowCreateDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('marketplace.resourceLibrary')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('marketplace.resourceLibraryDescription', 'Borrow tools, share spaces, and coordinate vehicles')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('marketplace.shareResource')}
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex gap-2">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
        >
          {t('marketplace.allCategories')}
        </Button>
        {(['tool', 'space', 'vehicle'] as ResourceType[]).map((type) => {
          const Icon = resourceTypeIcons[type];
          return (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              <Icon className="h-4 w-4 mr-1" />
              {t(`marketplace.${type}s` as any, resourceTypeLabels[type] + 's')}
            </Button>
          );
        })}
      </div>

      {/* Resources List */}
      {filteredResources.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t('marketplace.noResources')}</h3>
            <p className="text-muted-foreground">
              {t('marketplace.noResourcesDescription', 'Share your tools, spaces, or vehicles with your community.')}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('marketplace.shareResource')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('marketplace.shareResource')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('marketplace.resourceType', 'Resource Type')}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as ResourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tool">{t('marketplace.tools')}</SelectItem>
                  <SelectItem value="space">{t('marketplace.spaces')}</SelectItem>
                  <SelectItem value="vehicle">{t('marketplace.vehicles')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource-name">{t('marketplace.name', 'Name')}</Label>
              <Input
                id="resource-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Electric drill, Meeting room, Cargo van"
                maxLength={256}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource-description">{t('marketplace.description', 'Description')}</Label>
              <Textarea
                id="resource-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the resource, conditions for borrowing, etc."
                rows={3}
                maxLength={4096}
              />
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="deposit-required"
                checked={formDeposit}
                onChange={(e) => setFormDeposit(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="deposit-required">{t('marketplace.depositRequired')}</Label>
            </div>

            {formDeposit && (
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">{t('marketplace.depositAmount', 'Deposit Amount')}</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  value={formDepositAmount}
                  onChange={(e) => setFormDepositAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>
              {t('marketplace.shareResource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResourceCard({ resource }: { resource: ResourceShare }) {
  const { t } = useTranslation();
  const Icon = resourceTypeIcons[resource.resourceType];
  const isAvailable = resource.status === 'available';

  return (
    <Card className="p-5">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isAvailable ? 'bg-green-100 dark:bg-green-900' : 'bg-orange-100 dark:bg-orange-900'
            }`}>
              <Icon className={`h-5 w-5 ${
                isAvailable ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold">{resource.name}</h3>
              <Badge variant={isAvailable ? 'default' : 'secondary'} className="text-xs mt-0.5">
                {isAvailable
                  ? t('marketplace.currentlyAvailable')
                  : t('marketplace.currentlyBorrowed')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
        )}

        {/* Images */}
        {resource.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {resource.images.slice(0, 3).map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`${resource.name} ${idx + 1}`}
                className="w-16 h-16 rounded object-cover"
              />
            ))}
          </div>
        )}

        {/* Location */}
        {resource.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{resource.location.label}</span>
          </div>
        )}

        {/* Schedule */}
        {resource.availability.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">{t('marketplace.scheduleAvailability')}:</p>
            <div className="flex flex-wrap gap-1">
              {resource.availability.map((slot, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {getDayLabel(slot.dayOfWeek).slice(0, 3)} {slot.startHour}:00-{slot.endHour}:00
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Deposit */}
        {resource.depositRequired && (
          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>
              {t('marketplace.depositRequired')}: ${((resource.depositAmount ?? 0) / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!isAvailable}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {isAvailable ? t('marketplace.requestToBorrow') : t('marketplace.currentlyBorrowed')}
        </Button>
      </div>
    </Card>
  );
}
