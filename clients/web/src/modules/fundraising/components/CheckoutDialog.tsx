/**
 * CheckoutDialog Component
 *
 * Payment method selection and checkout flow for Stripe/PayPal donations.
 * Part of Epic 49B: Stripe/PayPal Integration.
 *
 * Shows a dialog where the user can:
 * 1. Enter/confirm a donation amount
 * 2. Choose payment method (Stripe, PayPal, or crypto)
 * 3. Get redirected to hosted checkout
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CreditCard,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { Campaign, DonationTier } from '../types';
import { initiateCheckout } from '../paymentService';
import { toast } from 'sonner';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign;
  tier?: DonationTier;
  donorPubkey: string;
  backendUrl: string;
}

export const CheckoutDialog: FC<CheckoutDialogProps> = ({
  open,
  onOpenChange,
  campaign,
  tier,
  donorPubkey,
  backendUrl,
}) => {
  const { t } = useTranslation();
  const currencySymbol = campaign.currency === 'USD' ? '$' : campaign.currency;

  const [amount, setAmount] = useState<string>(
    tier ? (tier.amount / 100).toFixed(2) : ''
  );
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);

  const enabledProcessors = campaign.settings.enabledProcessors || [];
  const hasStripe = enabledProcessors.includes('stripe');
  const hasPaypal = enabledProcessors.includes('paypal');

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const isValidAmount =
    amountCents > 0 &&
    (!campaign.minAmount || amountCents >= campaign.minAmount) &&
    (!campaign.maxAmount || amountCents <= campaign.maxAmount);

  const handleCheckout = async () => {
    if (!isValidAmount) {
      toast.error(t('checkout.invalidAmount', 'Please enter a valid donation amount'));
      return;
    }

    setIsProcessing(true);

    try {
      await initiateCheckout({
        provider,
        amount: amountCents,
        currency: campaign.currency,
        campaignId: campaign.id,
        campaignName: campaign.title,
        donorPubkey,
        backendUrl,
      });
      // User will be redirected; dialog will unmount
    } catch (error) {
      setIsProcessing(false);
      toast.error(
        error instanceof Error ? error.message : t('checkout.failed', 'Payment failed. Please try again.')
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('checkout.title', 'Make a Donation')}
          </DialogTitle>
          <DialogDescription>
            {t('checkout.description', { campaign: campaign.title })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              {t('checkout.amount', 'Donation Amount')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="amount"
                type="number"
                min={campaign.minAmount ? (campaign.minAmount / 100).toFixed(2) : '1'}
                max={campaign.maxAmount ? (campaign.maxAmount / 100).toFixed(2) : undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                disabled={!!tier}
              />
            </div>
            {tier && (
              <p className="text-sm text-muted-foreground">
                {tier.name}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>{t('checkout.paymentMethod', 'Payment Method')}</Label>
            <RadioGroup
              value={provider}
              onValueChange={(val) => setProvider(val as 'stripe' | 'paypal')}
              className="space-y-2"
            >
              {hasStripe && (
                <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-4 w-4" />
                    {t('checkout.stripe', 'Credit/Debit Card (Stripe)')}
                  </Label>
                </div>
              )}
              {hasPaypal && (
                <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="paypal" id="paypal" />
                  <Label htmlFor="paypal" className="flex items-center gap-2 cursor-pointer flex-1">
                    <ExternalLink className="h-4 w-4" />
                    {t('checkout.paypal', 'PayPal')}
                  </Label>
                </div>
              )}
            </RadioGroup>
            {!hasStripe && !hasPaypal && (
              <p className="text-sm text-muted-foreground">
                {t('checkout.noProcessors', 'No payment processors configured for this campaign.')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {t('checkout.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={!isValidAmount || isProcessing || (!hasStripe && !hasPaypal)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('checkout.processing', 'Processing...')}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {t('checkout.donate', {
                  amount: `${currencySymbol}${parseFloat(amount || '0').toFixed(2)}`,
                })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
