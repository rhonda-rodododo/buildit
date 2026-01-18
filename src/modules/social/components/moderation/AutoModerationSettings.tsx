/**
 * AutoModerationSettings Component
 * Configure auto-moderation rules and keyword filters
 */

import { FC, useState } from 'react';
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

const RULE_TYPES: { value: AutoModerationRule['ruleType']; label: string; description: string }[] = [
  { value: 'keyword', label: 'Keyword Filter', description: 'Match exact keywords or phrases' },
  { value: 'regex', label: 'Regex Pattern', description: 'Use regular expressions for advanced matching' },
  { value: 'spam-detection', label: 'Spam Detection', description: 'Automatically detect spam-like content' },
  { value: 'link-filter', label: 'Link Filter', description: 'Filter posts containing certain links' },
];

const ACTIONS: { value: AutoModerationRule['action']; label: string; description: string }[] = [
  { value: 'flag', label: 'Flag for Review', description: 'Add to moderation queue' },
  { value: 'hide', label: 'Hide Content', description: 'Hide but do not delete' },
  { value: 'delete', label: 'Delete', description: 'Remove content immediately' },
  { value: 'warn', label: 'Warn User', description: 'Send warning to user' },
];

export const AutoModerationSettings: FC<AutoModerationSettingsProps> = ({
  className,
  groupId,
}) => {
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
      toast.error('Please enter a rule name');
      return;
    }

    if ((ruleType === 'keyword' || ruleType === 'regex') && patterns.length === 0) {
      toast.error('Please add at least one pattern');
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

      toast.success('Auto-moderation rule created');
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create rule:', error);
      toast.error('Failed to create rule');
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

      toast.success('Rule updated');
      setEditingRule(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error('Failed to update rule');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return;

    setIsProcessing(true);
    try {
      await deleteAutoModRule(deleteRuleId);
      toast.success('Rule deleted');
      setDeleteRuleId(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRule = async (rule: AutoModerationRule) => {
    try {
      await updateAutoModRule(rule.id, { isEnabled: !rule.isEnabled });
      toast.success(rule.isEnabled ? 'Rule disabled' : 'Rule enabled');
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error('Failed to toggle rule');
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
            Auto-Moderation Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Automatically detect and handle problematic content
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Auto-Moderation Rule</DialogTitle>
              <DialogDescription>
                Set up automatic detection and handling of content
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
                Cancel
              </Button>
              <Button onClick={handleCreateRule} disabled={isProcessing}>
                {isProcessing ? 'Creating...' : 'Create Rule'}
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
              <h3 className="font-semibold text-lg mb-2">No rules configured</h3>
              <p className="text-muted-foreground mb-4">
                Create auto-moderation rules to automatically handle content.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
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
                            Triggered {rule.triggerCount} times
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
                        +{rule.patterns.length - 5} more
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
            <DialogTitle>Edit Auto-Moderation Rule</DialogTitle>
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
              Cancel
            </Button>
            <Button onClick={handleUpdateRule} disabled={isProcessing}>
              {isProcessing ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this auto-moderation rule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
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
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="rule-name">Rule Name</Label>
      <Input
        id="rule-name"
        value={ruleName}
        onChange={(e) => setRuleName(e.target.value)}
        placeholder="e.g., Block slurs, Filter spam links"
      />
    </div>

    <div className="space-y-2">
      <Label>Rule Type</Label>
      <Select value={ruleType} onValueChange={(v) => setRuleType(v as AutoModerationRule['ruleType'])}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RULE_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              <div>
                <div className="font-medium">{type.label}</div>
                <div className="text-xs text-muted-foreground">{type.description}</div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {(ruleType === 'keyword' || ruleType === 'regex' || ruleType === 'link-filter') && (
      <div className="space-y-2">
        <Label>Patterns</Label>
        <div className="flex gap-2">
          <Input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder={
              ruleType === 'regex'
                ? 'Enter regex pattern'
                : ruleType === 'link-filter'
                ? 'Enter domain or URL pattern'
                : 'Enter keyword or phrase'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddPattern();
              }
            }}
          />
          <Button type="button" onClick={onAddPattern}>
            Add
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
      <Label>Action</Label>
      <Select value={action} onValueChange={(v) => setAction(v as AutoModerationRule['action'])}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIONS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              <div>
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.description}</div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center justify-between">
      <Label htmlFor="notify-mods" className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Notify Moderators
      </Label>
      <Switch
        id="notify-mods"
        checked={notifyModerators}
        onCheckedChange={setNotifyModerators}
      />
    </div>
  </div>
);
