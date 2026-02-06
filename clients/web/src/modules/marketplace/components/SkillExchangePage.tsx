/**
 * SkillExchangePage Component
 * Time banking and skill exchange board
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, ArrowRightLeft, Clock, Sparkles, MessageSquare } from 'lucide-react';
import { useSkillExchanges } from '../hooks/useMarketplace';
import { findSkillMatches } from '../marketplaceManager';
import type { SkillExchange } from '../types';

export function SkillExchangePage() {
  const { t } = useTranslation();
  const { exchanges, createExchange } = useSkillExchanges();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [offeredSkill, setOfferedSkill] = useState('');
  const [requestedSkill, setRequestedSkill] = useState('');
  const [availableHours, setAvailableHours] = useState('');

  const handleCreate = () => {
    if (offeredSkill.trim() && requestedSkill.trim()) {
      createExchange({
        offeredSkill: offeredSkill.trim(),
        requestedSkill: requestedSkill.trim(),
        availableHours: parseFloat(availableHours) || 0,
      });
      setOfferedSkill('');
      setRequestedSkill('');
      setAvailableHours('');
      setShowCreateDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('marketplace.skillExchange')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('marketplace.skillExchangeDescription', 'Exchange skills and time with your community')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('marketplace.createExchange')}
        </Button>
      </div>

      {/* Exchanges List */}
      {exchanges.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t('marketplace.noSkillExchanges')}</h3>
            <p className="text-muted-foreground">
              {t('marketplace.noSkillExchangesDescription', 'Offer your skills and find people who can help you.')}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('marketplace.createExchange')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exchanges.map((exchange) => (
            <SkillExchangeCard
              key={exchange.id}
              exchange={exchange}
              allExchanges={exchanges}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('marketplace.createExchange')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="offered-skill">{t('marketplace.offeredSkill')}</Label>
              <Input
                id="offered-skill"
                value={offeredSkill}
                onChange={(e) => setOfferedSkill(e.target.value)}
                placeholder="e.g., Web development, Graphic design"
                maxLength={256}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested-skill">{t('marketplace.requestedSkill')}</Label>
              <Input
                id="requested-skill"
                value={requestedSkill}
                onChange={(e) => setRequestedSkill(e.target.value)}
                placeholder="e.g., Legal consulting, Accounting"
                maxLength={256}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="available-hours">{t('marketplace.availableHours')}</Label>
              <Input
                id="available-hours"
                type="number"
                value={availableHours}
                onChange={(e) => setAvailableHours(e.target.value)}
                placeholder="Hours per week"
                min="0"
                step="0.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!offeredSkill.trim() || !requestedSkill.trim()}>
              {t('marketplace.createExchange')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillExchangeCard({
  exchange,
  allExchanges,
}: {
  exchange: SkillExchange;
  allExchanges: SkillExchange[];
}) {
  const { t } = useTranslation();
  const matches = findSkillMatches(exchange, allExchanges);

  return (
    <Card className="p-5">
      <div className="space-y-4">
        {/* Skills */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t('marketplace.offeredSkill')}
            </p>
            <p className="font-medium">{exchange.offeredSkill}</p>
          </div>
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t('marketplace.requestedSkill')}
            </p>
            <p className="font-medium">{exchange.requestedSkill}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {exchange.availableHours > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{exchange.availableHours}h/week</span>
            </div>
          )}
          {exchange.hourlyTimebank > 0 && (
            <Badge variant="outline" className="text-xs">
              {exchange.hourlyTimebank}h {t('marketplace.timebankHours')}
            </Badge>
          )}
        </div>

        {/* Matches */}
        {matches.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
            <Sparkles className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {matches.length} {t('marketplace.matchFound')}!
            </span>
          </div>
        )}

        {/* Contact */}
        <Button variant="outline" size="sm" className="w-full">
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('marketplace.contactSeller')}
        </Button>
      </div>
    </Card>
  );
}
