/**
 * Phone Number Manager
 * Provision and manage PSTN phone numbers for hotlines
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Phone,
  Plus,
  Search,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
} from 'lucide-react';
import type { HotlineConfig } from '../types';

/**
 * Phone number with metadata
 */
interface PhoneNumber {
  number: string;
  friendlyName: string;
  region: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: 'active' | 'pending' | 'released';
  assignedTo?: string; // hotlineId
  monthlyFee: number;
  provisionedAt: number;
}

/**
 * Available number for provisioning
 */
interface AvailableNumber {
  number: string;
  region: string;
  locality?: string;
  rateCenter?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  monthlyFee: number;
}

interface PhoneNumberManagerProps {
  hotlines: HotlineConfig[];
  provisionedNumbers: PhoneNumber[];
  onProvision: (number: string, hotlineId?: string) => Promise<void>;
  onRelease: (number: string) => Promise<void>;
  onAssign: (number: string, hotlineId: string) => Promise<void>;
  onUnassign: (number: string) => Promise<void>;
  onSearchNumbers: (areaCode?: string, region?: string) => Promise<AvailableNumber[]>;
  className?: string;
}

export function PhoneNumberManager({
  hotlines,
  provisionedNumbers,
  onProvision,
  onRelease,
  onAssign,
  onUnassign,
  onSearchNumbers,
  className,
}: PhoneNumberManagerProps) {
  const { t } = useTranslation('calling');
  const [showProvision, setShowProvision] = useState(false);
  const [showAssign, setShowAssign] = useState<PhoneNumber | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<PhoneNumber | null>(null);
  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState<string | null>(null);
  const [selectedHotline, setSelectedHotline] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // US regions for filtering
  const regions = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
    'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ];

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const numbers = await onSearchNumbers(
        searchAreaCode || undefined,
        searchRegion || undefined
      );
      setAvailableNumbers(numbers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('searchFailed'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleProvision = async (number: string) => {
    setIsProvisioning(number);
    setError(null);
    try {
      await onProvision(number, selectedHotline || undefined);
      // Remove from available list
      setAvailableNumbers((prev) => prev.filter((n) => n.number !== number));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('provisionFailed'));
    } finally {
      setIsProvisioning(null);
    }
  };

  const handleAssign = async () => {
    if (!showAssign) return;
    setError(null);
    try {
      if (selectedHotline) {
        // Assign to a hotline
        await onAssign(showAssign.number, selectedHotline);
      } else if (showAssign.assignedTo) {
        // Unassign from current hotline
        await onUnassign(showAssign.number);
      }
      setShowAssign(null);
      setSelectedHotline('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assignFailed'));
    }
  };

  const handleRelease = async () => {
    if (!confirmRelease) return;
    setError(null);
    try {
      await onRelease(confirmRelease.number);
      setConfirmRelease(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('releaseFailed'));
    }
  };

  const formatPhoneNumber = (number: string): string => {
    // Format +1XXXXXXXXXX to +1 (XXX) XXX-XXXX
    if (number.startsWith('+1') && number.length === 12) {
      const areaCode = number.slice(2, 5);
      const prefix = number.slice(5, 8);
      const line = number.slice(8);
      return `+1 (${areaCode}) ${prefix}-${line}`;
    }
    return number;
  };

  const getHotlineName = (hotlineId: string): string => {
    const hotline = hotlines.find((h) => h.id === hotlineId);
    return hotline?.name || hotlineId;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">{t('phoneNumbers')}</h3>
          <p className="text-sm text-gray-400">{t('phoneNumbersDescription')}</p>
        </div>
        <Button onClick={() => setShowProvision(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('addNumber')}
        </Button>
      </div>

      {/* Provisioned numbers list */}
      <div className="space-y-2">
        {provisionedNumbers.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-8 text-center text-gray-400">
              <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('noPhoneNumbers')}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowProvision(true)}
              >
                {t('provisionFirst')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          provisionedNumbers.map((phoneNumber) => (
            <Card key={phoneNumber.number} className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Phone className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-mono text-white">
                        {formatPhoneNumber(phoneNumber.number)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {phoneNumber.region}
                        {phoneNumber.assignedTo && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="text-blue-400">
                              {getHotlineName(phoneNumber.assignedTo)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Capabilities badges */}
                    <div className="flex gap-1">
                      {phoneNumber.capabilities.voice && (
                        <Badge variant="outline" className="text-xs">Voice</Badge>
                      )}
                      {phoneNumber.capabilities.sms && (
                        <Badge variant="outline" className="text-xs">SMS</Badge>
                      )}
                    </div>

                    {/* Status */}
                    {phoneNumber.status === 'active' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : phoneNumber.status === 'pending' ? (
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}

                    {/* Actions */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowAssign(phoneNumber);
                        setSelectedHotline(phoneNumber.assignedTo || '');
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setConfirmRelease(phoneNumber)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Provision dialog */}
      <Dialog open={showProvision} onOpenChange={setShowProvision}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('provisionNumber')}</DialogTitle>
            <DialogDescription>{t('provisionNumberDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search filters */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('areaCode')}</Label>
                <Input
                  value={searchAreaCode}
                  onChange={(e) => setSearchAreaCode(e.target.value)}
                  placeholder="e.g., 415"
                  maxLength={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('region')}</Label>
                <Select value={searchRegion} onValueChange={setSearchRegion}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('anyRegion')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('anyRegion')}</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full gap-2"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {t('searchNumbers')}
            </Button>

            {/* Assign to hotline */}
            <div>
              <Label>{t('assignToHotline')}</Label>
              <Select value={selectedHotline} onValueChange={setSelectedHotline}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('dontAssign')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('dontAssign')}</SelectItem>
                  {hotlines.map((hotline) => (
                    <SelectItem key={hotline.id} value={hotline.id}>
                      {hotline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Available numbers */}
            {availableNumbers.length > 0 && (
              <div>
                <Label className="mb-2 block">{t('availableNumbers')}</Label>
                <ScrollArea className="h-48 border rounded-lg border-gray-700">
                  <div className="p-2 space-y-1">
                    {availableNumbers.map((number) => (
                      <div
                        key={number.number}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-700/50"
                      >
                        <div>
                          <div className="font-mono text-white">
                            {formatPhoneNumber(number.number)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {number.locality || number.region}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">
                            ${number.monthlyFee}/mo
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleProvision(number.number)}
                            disabled={isProvisioning === number.number}
                          >
                            {isProvisioning === number.number ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              t('provision')
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-red-500 text-sm text-center p-3 bg-red-500/10 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProvision(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manageNumber')}</DialogTitle>
            <DialogDescription>
              {showAssign && formatPhoneNumber(showAssign.number)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('assignToHotline')}</Label>
              <Select value={selectedHotline} onValueChange={setSelectedHotline}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('notAssigned')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('notAssigned')}</SelectItem>
                  {hotlines.map((hotline) => (
                    <SelectItem key={hotline.id} value={hotline.id}>
                      {hotline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center p-3 bg-red-500/10 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAssign}>
              {t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release confirmation */}
      <AlertDialog open={!!confirmRelease} onOpenChange={() => setConfirmRelease(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('releaseNumber')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t('releaseNumberWarning', {
                  number: confirmRelease && formatPhoneNumber(confirmRelease.number),
                })}
              </p>
              <p className="text-yellow-400">
                {t('releaseNumberNote')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRelease}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('releaseNumber')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PhoneNumberManager;
