import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { VotingSystem } from '../types';
import { proposalManager } from '../proposalManager';
import { getCurrentPrivateKey } from '@/stores/authStore';

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onCreated?: () => void;
}

export const CreateProposalDialog: FC<CreateProposalDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [votingSystem, setVotingSystem] = useState<VotingSystem>('simple-majority');
  const [options, setOptions] = useState('');
  const [duration, setDuration] = useState('7');
  const [quorum, setQuorum] = useState('50');
  const [threshold, setThreshold] = useState('50');
  const [tokenBudget, setTokenBudget] = useState('100');
  const [maxTokensPerOption, setMaxTokensPerOption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    const privateKey = getCurrentPrivateKey();
    if (!privateKey) {
      setError(t('createProposalDialog.errors.noIdentity'));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await proposalManager.createProposal(
        {
          groupId,
          title,
          description,
          votingSystem,
          optionLabels: (votingSystem === 'ranked-choice' || votingSystem === 'quadratic')
            ? options.split('\n').filter(o => o.trim())
            : undefined,
          votingDuration: parseInt(duration) * 24 * 60 * 60, // days to seconds
          quorumType: 'percentage',
          quorumValue: parseInt(quorum),
          thresholdType: 'simple-majority',
          thresholdPercentage: parseInt(threshold),
          quadraticTokenBudget: votingSystem === 'quadratic' ? parseInt(tokenBudget) || 100 : undefined,
          quadraticMaxTokensPerOption: votingSystem === 'quadratic' && maxTokensPerOption
            ? parseInt(maxTokensPerOption)
            : undefined,
        },
        privateKey
      );

      // Reset form
      setTitle('');
      setDescription('');
      setVotingSystem('simple-majority');
      setOptions('');
      setDuration('7');
      setQuorum('50');
      setThreshold('50');
      setTokenBudget('100');
      setMaxTokensPerOption('');

      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('createProposalDialog.errors.createFailed');
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createProposalDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createProposalDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">{t('createProposalDialog.fields.titleLabel')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('createProposalDialog.fields.titlePlaceholder')}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{t('createProposalDialog.fields.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('createProposalDialog.fields.descriptionPlaceholder')}
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="voting-system">{t('createProposalDialog.fields.votingMethodLabel')}</Label>
            <Select value={votingSystem} onValueChange={(v) => setVotingSystem(v as VotingSystem)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple-majority">{t('createProposalDialog.votingMethods.simple')}</SelectItem>
                <SelectItem value="ranked-choice">{t('createProposalDialog.votingMethods.rankedChoice')}</SelectItem>
                <SelectItem value="quadratic">{t('createProposalDialog.votingMethods.quadratic')}</SelectItem>
                <SelectItem value="consensus">{t('createProposalDialog.votingMethods.consensus')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(votingSystem === 'ranked-choice' || votingSystem === 'quadratic') && (
            <div className="grid gap-2">
              <Label htmlFor="options">{t('createProposalDialog.fields.optionsLabel')}</Label>
              <Textarea
                id="options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder={t('createProposalDialog.fields.optionsPlaceholder')}
                rows={4}
              />
            </div>
          )}

          {votingSystem === 'quadratic' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="token-budget">
                  {t('createProposalDialog.fields.tokenBudget', 'Token Budget')}
                </Label>
                <Input
                  id="token-budget"
                  type="number"
                  min="1"
                  value={tokenBudget}
                  onChange={(e) => setTokenBudget(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  {t('createProposalDialog.fields.tokenBudgetHint', 'Tokens each voter receives to allocate')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max-tokens-per-option">
                  {t('createProposalDialog.fields.maxTokensPerOption', 'Max per Option')}
                </Label>
                <Input
                  id="max-tokens-per-option"
                  type="number"
                  min="1"
                  value={maxTokensPerOption}
                  onChange={(e) => setMaxTokensPerOption(e.target.value)}
                  placeholder={t('createProposalDialog.fields.maxTokensPlaceholder', 'No limit')}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  {t('createProposalDialog.fields.maxTokensHint', 'Optional cap per option')}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quorum">{t('createProposalDialog.fields.quorumLabel')}</Label>
              <Input
                id="quorum"
                type="number"
                min="0"
                max="100"
                value={quorum}
                onChange={(e) => setQuorum(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="threshold">{t('createProposalDialog.fields.thresholdLabel')}</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">{t('createProposalDialog.fields.durationLabel')}</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('createProposalDialog.buttons.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!title || !description || isSubmitting}>
            {isSubmitting ? t('createProposalDialog.buttons.creating') : t('createProposalDialog.buttons.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
