/**
 * Outbound Dialer
 * Phone number input with dial button for PSTN outbound calls
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Phone, PhoneCall, Delete, AlertTriangle } from 'lucide-react';
import type { HotlineConfig, LocalCreditBalance } from '../types';

interface OutboundDialerProps {
  hotlines: HotlineConfig[];
  creditBalance?: LocalCreditBalance;
  onDial: (targetPhone: string, hotlineId: string) => Promise<void>;
  disabled?: boolean;
}

export function OutboundDialer({
  hotlines,
  creditBalance,
  onDial,
  disabled = false,
}: OutboundDialerProps) {
  const { t } = useTranslation('calling');
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedHotline, setSelectedHotline] = useState<string>('');
  const [isDialing, setIsDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter hotlines that have PSTN enabled
  const pstnHotlines = hotlines.filter((h) => h.pstnNumber);

  // Format phone number as user types
  const formatPhoneNumber = (value: string): string => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');

    // Format as US number: (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
    setError(null);
  };

  const handleKeypadPress = (digit: string) => {
    if (phoneNumber.replace(/\D/g, '').length < 10) {
      handlePhoneChange(phoneNumber + digit);
    }
  };

  const handleBackspace = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length > 0) {
      handlePhoneChange(digits.slice(0, -1));
    }
  };

  const validatePhoneNumber = (): boolean => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t('invalidPhoneNumber'));
      return false;
    }
    return true;
  };

  const handleDial = useCallback(async () => {
    if (!validatePhoneNumber()) return;
    if (!selectedHotline) {
      setError(t('selectHotline'));
      return;
    }

    // Check credits
    if (creditBalance && creditBalance.remaining <= 0) {
      setError(t('insufficientCredits'));
      return;
    }

    setIsDialing(true);
    setError(null);

    try {
      const digits = phoneNumber.replace(/\D/g, '');
      const formattedNumber = `+1${digits}`; // US format
      await onDial(formattedNumber, selectedHotline);
      setPhoneNumber('');
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dialFailed'));
    } finally {
      setIsDialing(false);
    }
  }, [phoneNumber, selectedHotline, creditBalance, onDial, t]);

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const hasLowCredits = creditBalance && creditBalance.isLow;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={disabled || pstnHotlines.length === 0}
        className="gap-2"
      >
        <Phone className="w-4 h-4" />
        {t('dialOut')}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              {t('outboundCall')}
            </DialogTitle>
            <DialogDescription>
              {t('outboundCallDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Hotline selector */}
            <div>
              <Label htmlFor="hotline">{t('selectHotlineLabel')}</Label>
              <Select value={selectedHotline} onValueChange={setSelectedHotline}>
                <SelectTrigger id="hotline" className="mt-1">
                  <SelectValue placeholder={t('selectHotline')} />
                </SelectTrigger>
                <SelectContent>
                  {pstnHotlines.map((hotline) => (
                    <SelectItem key={hotline.id} value={hotline.id}>
                      {hotline.name} ({hotline.pstnNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone number input */}
            <div>
              <Label htmlFor="phone">{t('phoneNumber')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(555) 555-5555"
                className="mt-1 text-center text-xl font-mono"
              />
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {keypadButtons.map((row, rowIndex) => (
                row.map((digit) => (
                  <Button
                    key={`${rowIndex}-${digit}`}
                    variant="outline"
                    className="h-12 text-lg font-semibold"
                    onClick={() => handleKeypadPress(digit)}
                    disabled={isDialing}
                  >
                    {digit}
                  </Button>
                ))
              ))}
              <div /> {/* Empty space */}
              <Button
                variant="ghost"
                className="h-12"
                onClick={handleBackspace}
                disabled={isDialing || phoneNumber.length === 0}
              >
                <Delete className="w-5 h-5" />
              </Button>
            </div>

            {/* Credits warning */}
            {hasLowCredits && creditBalance && (
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                creditBalance.remaining <= 0
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              )}>
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {creditBalance.remaining <= 0
                    ? t('noCreditsRemaining')
                    : t('lowCreditsWarning', { remaining: creditBalance.remaining })}
                </span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleDial}
              disabled={
                isDialing ||
                phoneNumber.replace(/\D/g, '').length !== 10 ||
                !selectedHotline ||
                (creditBalance && creditBalance.remaining <= 0)
              }
              className="gap-2"
            >
              {isDialing ? (
                <span className="animate-pulse">{t('dialing')}</span>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" />
                  {t('dial')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OutboundDialer;
