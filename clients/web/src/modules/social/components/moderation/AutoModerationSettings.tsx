/**
 * AutoModerationSettings Component
 * Configure auto-moderation rules and keyword filters
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Shield,
  AlertTriangle,
  Zap,
  Edit,
  X,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { AutoModerationRule } from '../../types';

interface AutoModerationSettingsProps {
  className?: string;
  groupId?: string;
}

const RULE_TYPES: { value: AutoModerationRule['ruleType']; labelKey: string; descriptionKey: string }[] = [
  { value: 'keyword', labelKey: 'autoModerationRuleForm.ruleTypes.keyword', descriptionKey: 'autoModerationRuleForm.ruleTypes.keywordDescription' },
  { value: 'regex', labelKey: 'autoModerationRuleForm.ruleTypes.regex', descriptionKey: 'autoModerationRuleForm.ruleTypes.regexDescription' },
  { value: 'spam-detection', labelKey: 'autoModerationRuleForm.ruleTypes.spamDetection', descriptionKey: 'autoModerationRuleForm.ruleTypes.spamDetectionDescription' },
  { value: 'link-filter', labelKey: 'autoModerationRuleForm.ruleTypes.linkFilter', descriptionKey: 'autoModerationRuleForm.ruleTypes.linkFilterDescription' },
];

const ACTIONS: { value: AutoModerationRule['action']; labelKey: string; descriptionKey: string }[] = [
  { value: 'flag', labelKey: 'autoModerationRuleForm.actions.flag', descriptionKey: 'autoModerationRuleForm.actions.flagDescription' },
  { value: 'hide', labelKey: 'autoModerationRuleForm.actions.hide', descriptionKey: 'autoModerationRuleForm.actions.hideDescription' },
  { value: 'delete', labelKey: 'autoModerationRuleForm.actions.delete', descriptionKey: 'autoModerationRuleForm.actions.deleteDescription' },
  { value: 'warn', labelKey: 'autoModerationRuleForm.actions.warn', descriptionKey: 'autoModerationRuleForm.actions.warnDescription' },
];

export const AutoModerationSettings: FC<AutoModerationSettingsProps> = ({
  className,
  groupId,
}) => {
  const { t } = useTranslation();
  const {
    moderationRules,
    createAutoModRule,
    updateAutoModRule,
    deleteAutoModRule,
  } = useSocialStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoModerationRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<AutoModerationRule['ruleType']>('keyword');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [action, setAction] = useState<AutoModerationRule['action']>('flag');
  const [notifyModerators, setNotifyModerators] = useState(true);

  // Filter rules by group
  const filteredRules = groupId
    ? moderationRules.filter((r) => r.groupId === groupId)
    : moderationRules.filter((r) => !r.groupId);

  const resetForm = () => {
    setRuleName('');
    setRuleType('keyword');
    setPatterns([]);
    setNewPattern('');
    setAction('flag');
    setNotifyModerators(true);
    setEditingRule(null);
  };

  const handleAddPattern = () => {
    if (newPattern.trim() && !patterns.includes(newPattern.trim())) {
      setPatterns([...patterns, newPattern.trim()]);
      setNewPattern('');
    }
  };

  const handleRemovePattern = (pattern: string) => {
    setPatterns(patterns.filter((p) => p !== pattern));
  };

  const handleCreateRule = async () => {
    if (!ruleName.trim()) {
      toast.error(t('autoModerationSettings.toasts.enterName'));
      return;
    }

    if ((ruleType === 'keyword' || ruleType === 'regex') && patterns.length === 0) {
      toast.error(t('autoModerationSettings.toasts.addPattern'));
      return;
    }

    setIsProcessing(true);
    try {
      await createAutoModRule({
        name: ruleName,
        groupId,
        ruleType,
        patterns: patterns.length > 0 ? patterns : undefined,
        action,
        notifyModerators,
        isEnabled: true,
        createdBy: 'current-user', // Would be replaced with actual user
      });

      toast.success(t('autoModerationSettings.toasts.created'));
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create rule:', error);
      toast.error(t('autoModerationSettings.toasts.createFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    setIsProcessing(true);
    try {
      await updateAutoModRule(editingRule.id, {
        name: ruleName,
        ruleType,
        patterns: patterns.length > 0 ? patterns : undefined,
        action,
        notifyModerators,
      });

      toast.success(t('autoModerationSettings.toasts.updated'));
      setEditingRule(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error(t('autoModerationSettings.toasts.updateFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return;

    setIsProcessing(true);
    try {
      await deleteAutoModRule(deleteRuleId);
      toast.success(t('autoModerationSettings.toasts.deleted'));
      setDeleteRuleId(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error(t('autoModerationSettings.toasts.deleteFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRule = async (rule: AutoModerationRule) => {
    try {
      await updateAutoModRule(rule.id, { isEnabled: !rule.isEnabled });
      toast.success(rule.isEnabled ? t('autoModerationSettings.toasts.disabled') : t('autoModerationSettings.toasts.enabled'));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error(t('autoModerationSettings.toasts.toggleFailed'));
    }
  };

  const startEditing = (rule: AutoModerationRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleType(rule.ruleType);
    setPatterns(rule.patterns || []);
    setAction(rule.action);
    setNotifyModerators(rule.notifyModerators);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t('autoModerationSettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('autoModerationSettings.description')}
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t('autoModerationSettings.newRule')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('autoModerationSettings.createRule')}</DialogTitle>
              <DialogDescription>
                {t('autoModerationSettings.createRuleDescription')}
              </DialogDescription>
            </DialogHeader>
            <RuleForm
              ruleName={ruleName}
              setRuleName={setRuleName}
              ruleType={ruleType}
              setRuleType={setRuleType}
              patterns={patterns}
              newPattern={newPattern}
              setNewPattern={setNewPattern}
              onAddPattern={handleAddPattern}
              onRemovePattern={handleRemovePattern}
              action={action}
              setAction={setAction}
              notifyModerators={notifyModerators}
              setNotifyModerators={setNotifyModerators}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                {t('autoModerationSettings.cancel')}
              </Button>
              <Button onClick={handleCreateRule} disabled={isProcessing}>
                {isProcessing ? t('autoModerationSettings.creating') : t('autoModerationSettings.createRule')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {filteredRules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('autoModerationSettings.noRulesTitle')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('autoModerationSettings.noRulesDescription')}
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('autoModerationSettings.createFirstRule')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredRules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={() => handleToggleRule(rule)}
                    />
                    <div>
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{rule.ruleType}</Badge>
                        <Badge
                          variant={
                            rule.action === 'delete'
                              ? 'destructive'
                              : rule.action === 'hide'
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          {rule.action}
                        </Badge>
                        {rule.triggerCount > 0 && (
                          <span className="text-xs">
                            {t('autoModerationSettings.triggeredTimes', { count: rule.triggerCount })}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(rule)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteRuleId(rule.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {rule.patterns && rule.patterns.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {rule.patterns.slice(0, 5).map((pattern, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {pattern}
                      </Badge>
                    ))}
                    {rule.patterns.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        {t('autoModerationSettings.more', { count: rule.patterns.length - 5 })}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('autoModerationSettings.editRule')}</DialogTitle>
          </DialogHeader>
          <RuleForm
            ruleName={ruleName}
            setRuleName={setRuleName}
            ruleType={ruleType}
            setRuleType={setRuleType}
            patterns={patterns}
            newPattern={newPattern}
            setNewPattern={setNewPattern}
            onAddPattern={handleAddPattern}
            onRemovePattern={handleRemovePattern}
            action={action}
            setAction={setAction}
            notifyModerators={notifyModerators}
            setNotifyModerators={setNotifyModerators}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingRule(null);
                resetForm();
              }}
            >
              {t('autoModerationSettings.cancel')}
            </Button>
            <Button onClick={handleUpdateRule} disabled={isProcessing}>
              {isProcessing ? t('autoModerationSettings.saving') : t('autoModerationSettings.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('autoModerationSettings.deleteRuleTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('autoModerationSettings.deleteRuleDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('autoModerationSettings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('autoModerationSettings.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Rule form component
interface RuleFormProps {
  ruleName: string;
  setRuleName: (v: string) => void;
  ruleType: AutoModerationRule['ruleType'];
  setRuleType: (v: AutoModerationRule['ruleType']) => void;
  patterns: string[];
  newPattern: string;
  setNewPattern: (v: string) => void;
  onAddPattern: () => void;
  onRemovePattern: (p: string) => void;
  action: AutoModerationRule['action'];
  setAction: (v: AutoModerationRule['action']) => void;
  notifyModerators: boolean;
  setNotifyModerators: (v: boolean) => void;
}

const RuleForm: FC<RuleFormProps> = ({
  ruleName,
  setRuleName,
  ruleType,
  setRuleType,
  patterns,
  newPattern,
  setNewPattern,
  onAddPattern,
  onRemovePattern,
  action,
  setAction,
  notifyModerators,
  setNotifyModerators,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rule-name">{t('autoModerationRuleForm.ruleName')}</Label>
        <Input
          id="rule-name"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder={t('autoModerationRuleForm.ruleNamePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('autoModerationRuleForm.ruleType')}</Label>
        <Select value={ruleType} onValueChange={(v) => setRuleType(v as AutoModerationRule['ruleType'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{t(type.labelKey)}</div>
                  <div className="text-xs text-muted-foreground">{t(type.descriptionKey)}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(ruleType === 'keyword' || ruleType === 'regex' || ruleType === 'link-filter') && (
        <div className="space-y-2">
          <Label>{t('autoModerationRuleForm.patterns')}</Label>
          <div className="flex gap-2">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={
                ruleType === 'regex'
                  ? t('autoModerationRuleForm.patternPlaceholderRegex')
                  : ruleType === 'link-filter'
                  ? t('autoModerationRuleForm.patternPlaceholderLink')
                  : t('autoModerationRuleForm.patternPlaceholderKeyword')
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddPattern();
                }
              }}
            />
            <Button type="button" onClick={onAddPattern}>
              {t('autoModerationRuleForm.add')}
            </Button>
          </div>
          {patterns.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {patterns.map((pattern, i) => (
                <Badge key={i} variant="secondary" className="pr-1">
                  {pattern}
                  <button
                    type="button"
                    onClick={() => onRemovePattern(pattern)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('autoModerationRuleForm.action')}</Label>
        <Select value={action} onValueChange={(v) => setAction(v as AutoModerationRule['action'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                <div>
                  <div className="font-medium">{t(a.labelKey)}</div>
                  <div className="text-xs text-muted-foreground">{t(a.descriptionKey)}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="notify-mods" className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('autoModerationRuleForm.notifyModerators')}
        </Label>
        <Switch
          id="notify-mods"
          checked={notifyModerators}
          onCheckedChange={setNotifyModerators}
        />
      </div>
    </div>
  );
};
