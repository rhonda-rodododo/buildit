/**
 * Poll Panel
 * Create and manage polls during conference calls
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X,
  Plus,
  Trash2,
  Play,
  Square,
  BarChart3,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import {
  createPollManager,
  type PollManager,
  type Poll,
  type PollResults,
} from '../services/pollManager';

interface PollPanelProps {
  roomId: string;
  isHost: boolean;
  localPubkey: string;
  onClose: () => void;
}

export function PollPanel({ roomId, isHost, localPubkey, onClose }: PollPanelProps) {
  const { t } = useTranslation('calling');
  const [manager] = useState<PollManager>(() => createPollManager(roomId, localPubkey));
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<Map<string, PollResults>>(new Map());
  const [_selectedPoll, _setSelectedPoll] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'create'>('active');

  // Create poll form state
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [settings, setSettings] = useState({
    anonymous: true,
    multiSelect: false,
    showLiveResults: true,
    allowChangeVote: false,
  });

  useEffect(() => {
    const handlePollLaunched = (_poll: Poll) => {
      setPolls(manager.getAllPolls());
    };

    const handlePollClosed = (poll: Poll, pollResults: PollResults) => {
      setPolls(manager.getAllPolls());
      setResults((prev) => new Map(prev).set(poll.id, pollResults));
    };

    const handleResultsUpdated = (pollId: string, pollResults: PollResults) => {
      setResults((prev) => new Map(prev).set(pollId, pollResults));
    };

    manager.on('poll-launched', handlePollLaunched);
    manager.on('poll-closed', handlePollClosed);
    manager.on('results-updated', handleResultsUpdated);

    setPolls(manager.getAllPolls());

    return () => {
      manager.off('poll-launched', handlePollLaunched);
      manager.off('poll-closed', handlePollClosed);
      manager.off('results-updated', handleResultsUpdated);
    };
  }, [manager]);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatePoll = () => {
    const validOptions = options.filter((o) => o.trim());
    if (question.trim() && validOptions.length >= 2) {
      const poll = manager.createPoll(question, validOptions, settings);
      setQuestion('');
      setOptions(['', '']);
      setTab('active');
      _setSelectedPoll(poll.id);
    }
  };

  const handleLaunchPoll = async (pollId: string) => {
    await manager.launchPoll(pollId);
    setPolls(manager.getAllPolls());
  };

  const handleClosePoll = async (pollId: string) => {
    const pollResults = await manager.closePoll(pollId);
    setPolls(manager.getAllPolls());
    setResults((prev) => new Map(prev).set(pollId, pollResults));
  };

  const handleVote = async (pollId: string, optionIds: string[]) => {
    await manager.vote(pollId, optionIds);
    setPolls(manager.getAllPolls());
  };

  const activePolls = polls.filter((p) => p.status === 'active');
  const closedPolls = polls.filter((p) => p.status === 'closed');
  const draftPolls = polls.filter((p) => p.status === 'draft');

  const renderPoll = (poll: Poll) => {
    const pollResults = results.get(poll.id) || manager.calculateResults(poll.id);
    const myVote = manager.getMyVote(poll.id);
    const hasVoted = manager.hasVoted(poll.id);

    return (
      <Card key={poll.id} className="bg-gray-700/50 border-gray-600">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white">
              {poll.question}
            </CardTitle>
            {poll.status === 'draft' && isHost && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleLaunchPoll(poll.id)}
              >
                <Play className="w-4 h-4 mr-1" />
                {t('launch')}
              </Button>
            )}
            {poll.status === 'active' && isHost && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClosePoll(poll.id)}
              >
                <Square className="w-4 h-4 mr-1" />
                {t('close')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {poll.settings.anonymous && <span>{t('anonymous')}</span>}
            {poll.settings.multiSelect && <span>{t('multiSelect')}</span>}
            <span>{pollResults.totalVotes} {t('votes')}</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2">
            {poll.options.map((option) => {
              const percentage = pollResults.percentages.get(option.id) || 0;
              const isSelected = myVote?.includes(option.id);
              const showResults = poll.status === 'closed' || (poll.settings.showLiveResults && hasVoted);

              return (
                <div
                  key={option.id}
                  className={cn(
                    'relative rounded-lg p-3 cursor-pointer transition-colors',
                    poll.status === 'active' && !hasVoted
                      ? 'hover:bg-gray-600/50 border border-gray-600'
                      : 'border border-transparent',
                    isSelected && 'bg-primary/20 border-primary'
                  )}
                  onClick={() => {
                    if (poll.status === 'active' && (!hasVoted || poll.settings.allowChangeVote)) {
                      if (poll.settings.multiSelect) {
                        const current = myVote || [];
                        const newVote = current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id];
                        handleVote(poll.id, newVote);
                      } else {
                        handleVote(poll.id, [option.id]);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      {poll.status === 'active' && !hasVoted ? (
                        poll.settings.multiSelect ? (
                          <div className={cn(
                            'w-4 h-4 rounded border-2',
                            isSelected ? 'bg-primary border-primary' : 'border-gray-400'
                          )} />
                        ) : (
                          <Circle className={cn(
                            'w-4 h-4',
                            isSelected ? 'text-primary fill-primary' : 'text-gray-400'
                          )} />
                        )
                      ) : isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : null}
                      <span className="text-white text-sm">{option.text}</span>
                    </div>
                    {showResults && (
                      <span className="text-gray-300 text-sm font-medium">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                  {showResults && (
                    <Progress
                      value={percentage}
                      className="mt-2 h-1"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h3 className="text-white font-medium">{t('polls')}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 m-2 mb-0">
          <TabsTrigger value="active">{t('active')}</TabsTrigger>
          {isHost && <TabsTrigger value="create">{t('create')}</TabsTrigger>}
        </TabsList>

        {/* Active polls */}
        <TabsContent value="active" className="flex-1 m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-3">
              {activePolls.length === 0 && closedPolls.length === 0 && draftPolls.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {t('noPolls')}
                </div>
              ) : (
                <>
                  {/* Active polls */}
                  {activePolls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-400 uppercase px-2">
                        {t('activePolls')}
                      </h4>
                      {activePolls.map(renderPoll)}
                    </div>
                  )}

                  {/* Draft polls */}
                  {isHost && draftPolls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-400 uppercase px-2">
                        {t('draftPolls')}
                      </h4>
                      {draftPolls.map(renderPoll)}
                    </div>
                  )}

                  {/* Closed polls */}
                  {closedPolls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-400 uppercase px-2">
                        {t('closedPolls')}
                      </h4>
                      {closedPolls.map(renderPoll)}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Create poll */}
        {isHost && (
          <TabsContent value="create" className="flex-1 m-0 mt-2">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Question */}
                <div>
                  <Label htmlFor="question" className="text-gray-300">
                    {t('question')}
                  </Label>
                  <Input
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t('enterQuestion')}
                    className="mt-1 bg-gray-700 border-gray-600"
                  />
                </div>

                {/* Options */}
                <div>
                  <Label className="text-gray-300">{t('options')}</Label>
                  <div className="mt-1 space-y-2">
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`${t('option')} ${index + 1}`}
                          className="bg-gray-700 border-gray-600"
                        />
                        {options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-red-500"
                            onClick={() => handleRemoveOption(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {options.length < 10 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleAddOption}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {t('addOption')}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="anonymous" className="text-gray-300">
                      {t('anonymousVoting')}
                    </Label>
                    <Switch
                      id="anonymous"
                      checked={settings.anonymous}
                      onCheckedChange={(checked) => setSettings({ ...settings, anonymous: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="multiSelect" className="text-gray-300">
                      {t('allowMultipleChoices')}
                    </Label>
                    <Switch
                      id="multiSelect"
                      checked={settings.multiSelect}
                      onCheckedChange={(checked) => setSettings({ ...settings, multiSelect: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="liveResults" className="text-gray-300">
                      {t('showLiveResults')}
                    </Label>
                    <Switch
                      id="liveResults"
                      checked={settings.showLiveResults}
                      onCheckedChange={(checked) => setSettings({ ...settings, showLiveResults: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowChange" className="text-gray-300">
                      {t('allowChangeVote')}
                    </Label>
                    <Switch
                      id="allowChange"
                      checked={settings.allowChangeVote}
                      onCheckedChange={(checked) => setSettings({ ...settings, allowChangeVote: checked })}
                    />
                  </div>
                </div>

                {/* Create button */}
                <Button
                  className="w-full"
                  disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
                  onClick={handleCreatePoll}
                >
                  {t('createPoll')}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default PollPanel;
