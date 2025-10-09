/**
 * Tiers Editor Component
 * Edit donation tiers for a campaign
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { DonationTier } from '../../types';

interface TiersEditorProps {
  tiers: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[];
  onUpdate: (tiers: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[]) => void;
  currency: string;
}

export function TiersEditor({ tiers, onUpdate, currency }: TiersEditorProps) {
  const handleAddTier = () => {
    const newTier: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'> = {
      name: `Tier ${tiers.length + 1}`,
      amount: 1000, // $10 in cents
      order: tiers.length,
    };
    onUpdate([...tiers, newTier]);
  };

  const handleUpdateTier = (index: number, updates: Partial<typeof tiers[0]>) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], ...updates };
    onUpdate(updated);
  };

  const handleRemoveTier = (index: number) => {
    onUpdate(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Donation Tiers</h3>
          <p className="text-sm text-muted-foreground">
            Create preset donation amounts with benefits
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAddTier}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No donation tiers yet</p>
          <p className="text-sm">Add tiers to suggest donation amounts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <Card key={index} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Tier Name</Label>
                      <Input
                        value={tier.name}
                        onChange={(e) => handleUpdateTier(index, { name: e.target.value })}
                        placeholder="Supporter"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Amount ({currency})</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={tier.amount / 100}
                        onChange={(e) => handleUpdateTier(index, { amount: Math.round(parseFloat(e.target.value) * 100) })}
                        placeholder="25.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Description (optional)</Label>
                    <Input
                      value={tier.description || ''}
                      onChange={(e) => handleUpdateTier(index, { description: e.target.value })}
                      placeholder="What supporters get at this level"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTier(index)}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
