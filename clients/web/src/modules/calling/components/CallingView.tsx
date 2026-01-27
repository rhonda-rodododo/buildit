/**
 * Calling View
 * Main view for voice/video calls - shows active call or start call interface
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Video, Clock, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCalling, useIncomingCallNotification } from '../hooks/useCalling';
import { CallScreen } from './CallScreen';
import { IncomingCallDialog } from './IncomingCallDialog';
import { CallType, CallDirection, CallHistoryCallType } from '../types';
import { formatDistanceToNow } from 'date-fns';

export function CallingView() {
  const { t } = useTranslation('calling');
  const {
    activeCall,
    incomingCall,
    callHistory,
    isInCall,
    showIncomingCallDialog,
    startCall,
    answerCall,
    declineCall,
  } = useCalling();

  useIncomingCallNotification();

  const [searchQuery, setSearchQuery] = useState('');

  // If in an active call, show the call screen
  if (isInCall && activeCall) {
    return <CallScreen />;
  }

  // Filter call history by search
  const filteredHistory = callHistory.filter(
    (call) =>
      call.remoteName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.remotePubkey.includes(searchQuery)
  );

  // Get recent contacts from call history
  const recentContacts = callHistory
    .reduce((acc, call) => {
      if (!acc.find((c) => c.pubkey === call.remotePubkey)) {
        acc.push({
          pubkey: call.remotePubkey,
          name: call.remoteName,
          lastCall: call.startedAt,
        });
      }
      return acc;
    }, [] as { pubkey: string; name?: string; lastCall: number }[])
    .slice(0, 10);

  const handleStartVoiceCall = async (pubkey: string, name?: string) => {
    await startCall(pubkey, CallType.Voice, { remoteName: name });
  };

  const handleStartVideoCall = async (pubkey: string, name?: string) => {
    await startCall(pubkey, CallType.Video, { remoteName: name });
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Incoming call dialog */}
      <IncomingCallDialog
        open={showIncomingCallDialog}
        incomingCall={incomingCall}
        onAnswer={answerCall}
        onDecline={declineCall}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Phone className="h-6 w-6" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('meta.description')}</p>
      </div>

      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">
            <User className="h-4 w-4 mr-2" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            {t('history')}
          </TabsTrigger>
        </TabsList>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts or enter pubkey..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <TabsContent value="contacts" className="space-y-4">
          {/* Quick dial by pubkey */}
          {searchQuery.length === 64 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Unknown Contact</p>
                      <p className="text-sm text-muted-foreground font-mono truncate max-w-[200px]">
                        {searchQuery}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStartVoiceCall(searchQuery)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStartVideoCall(searchQuery)}
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentContacts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noCallHistory')}
                </p>
              ) : (
                recentContacts.map((contact) => (
                  <div
                    key={contact.pubkey}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {contact.name?.[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {contact.name ?? 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(contact.lastCall, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartVoiceCall(contact.pubkey, contact.name)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartVideoCall(contact.pubkey, contact.name)}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {filteredHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t('noCallHistory')}
              </CardContent>
            </Card>
          ) : (
            filteredHistory.map((call) => (
              <Card key={call.callId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {call.remoteName?.[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {call.remoteName ?? 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {call.direction === CallDirection.Incoming ? (
                            <span className="text-green-500">Incoming</span>
                          ) : (
                            <span className="text-blue-500">Outgoing</span>
                          )}
                          <span>•</span>
                          <span>
                            {call.callType === CallHistoryCallType.Video ? 'Video' : 'Voice'}
                          </span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(call.startedAt, { addSuffix: true })}
                          </span>
                        </div>
                        {call.duration !== undefined && call.duration > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t('duration')}: {Math.floor(call.duration / 60)}:
                            {String(call.duration % 60).padStart(2, '0')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartVoiceCall(call.remotePubkey, call.remoteName)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartVideoCall(call.remotePubkey, call.remoteName)}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
