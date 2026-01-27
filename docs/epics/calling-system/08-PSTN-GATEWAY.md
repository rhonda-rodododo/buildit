# Epic 8: PSTN Gateway Integration

> Connect BuildIt to the traditional phone network for hotline accessibility

## Overview

Enable BuildIt hotlines to receive calls from and make calls to regular phone numbers. This is critical for jail support, legal intake, and crisis hotlines where callers may not have internet access or a BuildIt account.

## Dependencies

- **Epic 7**: Hotline Module Enhancement (queue, operator systems)

## Important Privacy Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                 PSTN PRIVACY LIMITATIONS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  PSTN calls CANNOT be end-to-end encrypted                   │
│                                                                  │
│  The phone network is inherently not encrypted:                  │
│  - Telco has access to call audio                                │
│  - Law enforcement can wiretap                                   │
│  - Provider (Twilio/Plivo) processes audio                       │
│                                                                  │
│  Mitigations:                                                    │
│  1. Clear disclosure to callers ("this call may be monitored")   │
│  2. Minimize sensitive info over PSTN                            │
│  3. Offer callback to encrypted line when possible               │
│  4. Use PSTN only for initial contact, E2EE for follow-up        │
│  5. Self-hosted option reduces third-party exposure              │
│                                                                  │
│  Recommendation: BuildIt-to-BuildIt calls remain E2EE            │
│  PSTN is a accessibility fallback, not the primary channel       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Architecture Options

### 1.1 Provider Comparison

| Provider | Self-Hostable | Pricing | Privacy | Features |
|----------|---------------|---------|---------|----------|
| **Twilio** | No | ~$0.0085/min | Logs retained | Full featured |
| **Plivo** | No | ~$0.0065/min | Logs retained | Good API |
| **Telnyx** | No | ~$0.005/min | Logs retained | WebRTC native |
| **Asterisk** | Yes | Carrier cost | You control | Complex setup |
| **FreeSWITCH** | Yes | Carrier cost | You control | Flexible |
| **Kamailio** | Yes | Carrier cost | You control | SIP routing |

**Recommendation**:
- **Production**: Telnyx or Twilio for reliability
- **Privacy-focused**: Self-hosted Asterisk with SIP trunking
- **Hybrid**: Twilio for fallback, self-hosted primary

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 PSTN GATEWAY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INBOUND (Caller dials hotline number)                           │
│                                                                  │
│  ┌────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │   Phone    │───▶│  Twilio/Telnyx  │───▶│ Cloudflare Worker│  │
│  │  Network   │    │  (SIP → WebRTC) │    │  (Routing Logic) │  │
│  └────────────┘    └─────────────────┘    └────────┬─────────┘  │
│                                                    │             │
│                                                    ▼             │
│                                           ┌──────────────────┐  │
│                                           │  Hotline Queue   │  │
│                                           │  (Epic 7)        │  │
│                                           └────────┬─────────┘  │
│                                                    │             │
│                                                    ▼             │
│                                           ┌──────────────────┐  │
│                                           │ BuildIt Operator │  │
│                                           │  (WebRTC client) │  │
│                                           └──────────────────┘  │
│                                                                  │
│  OUTBOUND (Operator calls external number)                       │
│                                                                  │
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │ BuildIt Operator │───▶│ Cloudflare Worker│───▶│  Twilio    │  │
│  │  (WebRTC client) │    │  (Auth, Billing) │    │  (WebRTC → │  │
│  └──────────────────┘    └─────────────────┘    │   PSTN)    │  │
│                                                  └────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Self-Hosted Option (Asterisk)

```
┌─────────────────────────────────────────────────────────────────┐
│                 SELF-HOSTED PSTN (ASTERISK)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │   Phone    │───▶│  SIP Trunk      │───▶│    Asterisk      │  │
│  │  Network   │    │  (VoIP.ms, etc) │    │    Server        │  │
│  └────────────┘    └─────────────────┘    └────────┬─────────┘  │
│                                                    │             │
│                                    ┌───────────────┼───────────┐ │
│                                    │               ▼           │ │
│                                    │    ┌──────────────────┐   │ │
│                                    │    │   WebRTC to SIP  │   │ │
│                                    │    │   Gateway        │   │ │
│                                    │    └────────┬─────────┘   │ │
│                                    │             │             │ │
│                                    │             ▼             │ │
│                                    │    ┌──────────────────┐   │ │
│                                    │    │  BuildIt Client  │   │ │
│                                    │    │  (WebRTC)        │   │ │
│                                    │    └──────────────────┘   │ │
│                                    │                           │ │
│                                    │   Your Infrastructure     │ │
│                                    └───────────────────────────┘ │
│                                                                  │
│  Benefits:                                                       │
│  - No third-party processing audio                               │
│  - Full control over logging/retention                           │
│  - Cost = SIP trunk rates only                                   │
│                                                                  │
│  Downsides:                                                      │
│  - Operational complexity                                        │
│  - Need reliable infrastructure                                  │
│  - DIDs harder to provision                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Twilio Integration

### 2.1 Phone Number Provisioning

```typescript
// workers/pstn/src/numbers.ts

interface HotlineNumber {
  id: string;
  hotlineId: string;
  groupId: string;
  phoneNumber: string;      // E.164 format: +15551234567
  provider: 'twilio' | 'telnyx' | 'self-hosted';
  capabilities: {
    voice: boolean;
    sms: boolean;
  };
  monthlyCredits: number;   // Prepaid minutes
  usedThisMonth: number;
  createdAt: number;
}

// Provision a new phone number for a hotline
export async function provisionNumber(
  request: Request,
  env: Env
): Promise<Response> {
  const { hotlineId, groupId, areaCode, country } = await request.json();

  // Validate authorization (group admin)
  const pubkey = await validateAuth(request);
  if (!await isGroupAdmin(pubkey, groupId, env)) {
    return new Response('Unauthorized', { status: 403 });
  }

  // Search for available numbers
  const twilio = new Twilio(env.TWILIO_SID, env.TWILIO_TOKEN);
  const available = await twilio.availablePhoneNumbers(country)
    .local.list({
      areaCode,
      voiceEnabled: true,
      limit: 5,
    });

  if (available.length === 0) {
    return Response.json({ error: 'No numbers available' }, { status: 404 });
  }

  // Purchase first available
  const purchased = await twilio.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    voiceUrl: `${env.WEBHOOK_BASE}/voice/incoming`,
    voiceMethod: 'POST',
    statusCallback: `${env.WEBHOOK_BASE}/voice/status`,
    statusCallbackMethod: 'POST',
  });

  // Store mapping
  const hotlineNumber: HotlineNumber = {
    id: crypto.randomUUID(),
    hotlineId,
    groupId,
    phoneNumber: purchased.phoneNumber,
    provider: 'twilio',
    capabilities: { voice: true, sms: false },
    monthlyCredits: 1000,  // 1000 minutes
    usedThisMonth: 0,
    createdAt: Date.now(),
  };

  await env.NUMBERS.put(purchased.phoneNumber, JSON.stringify(hotlineNumber));
  await env.HOTLINE_NUMBERS.put(hotlineId, purchased.phoneNumber);

  return Response.json({
    phoneNumber: purchased.phoneNumber,
    hotlineId,
  });
}
```

### 2.2 Inbound Call Handler

```typescript
// workers/pstn/src/voice/incoming.ts

export async function handleIncomingCall(
  request: Request,
  env: Env
): Promise<Response> {
  const formData = await request.formData();
  const callSid = formData.get('CallSid') as string;
  const from = formData.get('From') as string;
  const to = formData.get('To') as string;

  // Look up hotline for this number
  const hotlineNumber = await env.NUMBERS.get(to);
  if (!hotlineNumber) {
    return generateTwiML(`
      <Response>
        <Say>This number is not in service.</Say>
        <Hangup/>
      </Response>
    `);
  }

  const { hotlineId, groupId, monthlyCredits, usedThisMonth } = JSON.parse(hotlineNumber);

  // Check credits
  if (usedThisMonth >= monthlyCredits) {
    return generateTwiML(`
      <Response>
        <Say>This hotline has exceeded its monthly limit. Please try again later.</Say>
        <Hangup/>
      </Response>
    `);
  }

  // Check if hotline is active and has operators
  const hotlineStatus = await getHotlineStatus(hotlineId, env);

  if (!hotlineStatus.isActive) {
    // Play after-hours message
    return generateTwiML(`
      <Response>
        <Say>${hotlineStatus.afterHoursMessage || 'This hotline is currently closed.'}</Say>
        ${hotlineStatus.voicemailEnabled ? '<Record maxLength="120" transcribe="false"/>' : ''}
        <Hangup/>
      </Response>
    `);
  }

  // Create call record in BuildIt
  const callId = await createPSTNCallRecord({
    hotlineId,
    groupId,
    callerPhone: from,
    callSid,
    provider: 'twilio',
  }, env);

  // Connect to WebRTC bridge
  return generateTwiML(`
    <Response>
      <Say>Please hold while we connect you to an operator.</Say>
      <Play loop="0">${env.HOLD_MUSIC_URL}</Play>
      <Connect>
        <Stream url="${env.WEBRTC_BRIDGE_URL}?callId=${callId}&amp;hotlineId=${hotlineId}"/>
      </Connect>
    </Response>
  `);
}

function generateTwiML(xml: string): Response {
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

### 2.3 WebRTC-to-PSTN Bridge

```typescript
// Bridge PSTN audio to WebRTC

class PSTNWebRTCBridge {
  private twilioStream: TwilioMediaStream;
  private webrtcConnection: RTCPeerConnection;

  async connect(twilioStreamSid: string, callId: string): Promise<void> {
    // Create WebRTC connection to BuildIt
    this.webrtcConnection = new RTCPeerConnection(iceConfig);

    // Set up audio tracks
    const audioTrack = await this.createAudioTrack();
    this.webrtcConnection.addTrack(audioTrack);

    // Handle incoming WebRTC audio → Twilio
    this.webrtcConnection.ontrack = (event) => {
      const audioStream = event.streams[0];
      this.pipeToTwilio(audioStream);
    };

    // Create offer and connect to hotline queue
    const offer = await this.webrtcConnection.createOffer();
    await this.webrtcConnection.setLocalDescription(offer);

    // Signal to hotline system
    await this.signaling.sendPSTNCallOffer({
      callId,
      sdp: offer.sdp,
      callerType: 'pstn',
    });
  }

  // Pipe Twilio media to WebRTC
  handleTwilioMedia(message: TwilioMediaMessage): void {
    // Twilio sends μ-law encoded audio
    const pcmAudio = this.decodeUlaw(message.payload);

    // Pipe to WebRTC audio track
    this.audioSource.write(pcmAudio);
  }

  // Pipe WebRTC audio to Twilio
  pipeToTwilio(stream: MediaStream): void {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // Create processor to get raw samples
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (event) => {
      const pcmData = event.inputBuffer.getChannelData(0);
      const ulawData = this.encodeUlaw(pcmData);

      // Send to Twilio stream
      this.twilioStream.send({
        event: 'media',
        media: {
          payload: ulawData,
        },
      });
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }
}
```

---

## Part 3: Outbound Calling

### 3.1 Click-to-Call

```typescript
// Operator initiates outbound PSTN call

class OutboundPSTNManager {
  async initiateCall(
    operatorPubkey: string,
    targetNumber: string,
    hotlineId: string
  ): Promise<OutboundCall> {
    // Validate operator has permission
    const hotline = await this.getHotline(hotlineId);
    if (!await this.canMakeOutboundCalls(operatorPubkey, hotlineId)) {
      throw new Error('Not authorized for outbound calls');
    }

    // Validate phone number format
    const e164Number = this.normalizePhoneNumber(targetNumber);
    if (!e164Number) {
      throw new Error('Invalid phone number');
    }

    // Check credits
    if (!await this.hasCredits(hotlineId)) {
      throw new Error('Insufficient call credits');
    }

    // Get caller ID (hotline's number)
    const callerId = await this.getHotlineNumber(hotlineId);

    // Create WebRTC connection first
    const webrtcSession = await this.createWebRTCSession(operatorPubkey);

    // Initiate PSTN call via Twilio
    const call = await this.twilio.calls.create({
      to: e164Number,
      from: callerId,
      twiml: `
        <Response>
          <Connect>
            <Stream url="${this.bridgeUrl}?sessionId=${webrtcSession.id}"/>
          </Connect>
        </Response>
      `,
      statusCallback: this.statusCallbackUrl,
    });

    // Track call
    return {
      id: crypto.randomUUID(),
      hotlineId,
      operatorPubkey,
      targetNumber: e164Number,
      twilioCallSid: call.sid,
      webrtcSessionId: webrtcSession.id,
      status: 'initiated',
      startedAt: Date.now(),
    };
  }
}
```

### 3.2 Outbound Call UI

```typescript
function OutboundCallDialog({ hotlineId, onCall }: OutboundCallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);
  const { credits, used } = useHotlineCredits(hotlineId);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    setIsValid(isValidPhoneNumber(value));
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('make_outbound_call')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('phone_number')}</Label>
            <PhoneInput
              value={phoneNumber}
              onChange={handlePhoneChange}
              defaultCountry="US"
              placeholder="+1 (555) 123-4567"
            />
            {!isValid && phoneNumber && (
              <p className="text-sm text-destructive mt-1">
                {t('invalid_phone_number')}
              </p>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {t('credits_remaining', { credits: credits - used })}
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('pstn_not_encrypted_warning')}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => onCall(phoneNumber)}
            disabled={!isValid || credits <= used}
          >
            <Phone className="mr-2 h-4 w-4" />
            {t('call')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Part 4: Usage & Billing

### 4.1 Credit System

```typescript
// Prepaid credit system for PSTN usage

interface HotlinePSTNCredits {
  hotlineId: string;
  groupId: string;
  monthlyAllocation: number;    // Minutes per month
  usedThisMonth: number;
  bonusCredits: number;         // Purchased or granted
  resetDay: number;             // Day of month credits reset
  lastReset: number;            // Timestamp
}

class CreditManager {
  async checkAndDeductCredits(
    hotlineId: string,
    durationSeconds: number
  ): Promise<boolean> {
    const credits = await this.getCredits(hotlineId);
    const durationMinutes = Math.ceil(durationSeconds / 60);

    const totalAvailable = credits.monthlyAllocation - credits.usedThisMonth + credits.bonusCredits;

    if (durationMinutes > totalAvailable) {
      return false;
    }

    // Deduct from monthly first, then bonus
    const fromMonthly = Math.min(
      durationMinutes,
      credits.monthlyAllocation - credits.usedThisMonth
    );
    const fromBonus = durationMinutes - fromMonthly;

    await this.updateCredits(hotlineId, {
      usedThisMonth: credits.usedThisMonth + fromMonthly,
      bonusCredits: credits.bonusCredits - fromBonus,
    });

    return true;
  }

  // Monthly reset
  async resetMonthlyCredits(): Promise<void> {
    const today = new Date().getDate();
    const allCredits = await this.getAllCredits();

    for (const credits of allCredits) {
      if (credits.resetDay === today) {
        await this.updateCredits(credits.hotlineId, {
          usedThisMonth: 0,
          lastReset: Date.now(),
        });
      }
    }
  }

  // Low credits warning
  async checkLowCredits(hotlineId: string): Promise<void> {
    const credits = await this.getCredits(hotlineId);
    const percentUsed = credits.usedThisMonth / credits.monthlyAllocation;

    if (percentUsed > 0.8) {
      await this.notifyGroupAdmins(hotlineId, 'low_credits', {
        remaining: credits.monthlyAllocation - credits.usedThisMonth,
        percentUsed: Math.round(percentUsed * 100),
      });
    }
  }
}
```

### 4.2 Usage Dashboard

```typescript
function PSTNUsageDashboard({ hotlineId }: { hotlineId: string }) {
  const { credits, callLog, stats } = usePSTNUsage(hotlineId);

  return (
    <div className="space-y-6">
      {/* Credits overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pstn_credits')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>{t('monthly_allocation')}</span>
              <span className="font-bold">{credits.monthlyAllocation} {t('minutes')}</span>
            </div>

            <Progress
              value={(credits.usedThisMonth / credits.monthlyAllocation) * 100}
              className={credits.usedThisMonth > credits.monthlyAllocation * 0.8 ? 'bg-destructive' : ''}
            />

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{credits.usedThisMonth} {t('used')}</span>
              <span>{credits.monthlyAllocation - credits.usedThisMonth} {t('remaining')}</span>
            </div>

            {credits.bonusCredits > 0 && (
              <div className="text-sm">
                {t('bonus_credits')}: {credits.bonusCredits} {t('minutes')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage stats */}
      <Card>
        <CardHeader>
          <CardTitle>{t('usage_stats')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Stat label={t('inbound_calls')} value={stats.inboundCalls} />
            <Stat label={t('outbound_calls')} value={stats.outboundCalls} />
            <Stat label={t('avg_duration')} value={formatDuration(stats.avgDuration)} />
          </div>
        </CardContent>
      </Card>

      {/* Recent calls */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recent_pstn_calls')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('direction')}</TableHead>
                <TableHead>{t('phone_number')}</TableHead>
                <TableHead>{t('duration')}</TableHead>
                <TableHead>{t('cost')}</TableHead>
                <TableHead>{t('time')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLog.map(call => (
                <TableRow key={call.id}>
                  <TableCell>
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="h-4 w-4" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell>{formatPhoneNumber(call.phoneNumber)}</TableCell>
                  <TableCell>{formatDuration(call.duration)}</TableCell>
                  <TableCell>{call.creditsUsed} {t('min')}</TableCell>
                  <TableCell>{formatRelativeTime(call.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Part 5: Self-Hosted Option

### 5.1 Asterisk Configuration

```ini
; /etc/asterisk/sip.conf

[general]
context=default
bindport=5060
bindaddr=0.0.0.0
transport=udp,tcp,tls
tlsenable=yes
tlscertfile=/etc/asterisk/keys/asterisk.pem
tlscafile=/etc/asterisk/keys/ca.crt

; SIP Trunk to carrier
[voipms]
type=peer
host=atlanta.voip.ms
username=YOUR_USERNAME
secret=YOUR_PASSWORD
fromuser=YOUR_USERNAME
fromdomain=atlanta.voip.ms
qualify=yes
context=from-voipms

; WebRTC endpoint
[webrtc]
type=peer
encryption=yes
avpf=yes
icesupport=yes
directmedia=no
transport=wss
```

```ini
; /etc/asterisk/extensions.conf

[from-voipms]
; Incoming calls from PSTN
exten => _X.,1,NoOp(Incoming PSTN call to ${EXTEN})
exten => _X.,n,Set(HOTLINE_ID=${DB(numbers/${EXTEN})})
exten => _X.,n,GotoIf($["${HOTLINE_ID}" = ""]?invalid)
exten => _X.,n,Answer()
exten => _X.,n,Playback(custom/welcome)
; Bridge to WebRTC
exten => _X.,n,Dial(PJSIP/${HOTLINE_ID}@webrtc,30)
exten => _X.,n,Hangup()
exten => _X.,n(invalid),Playback(number-not-in-service)
exten => _X.,n,Hangup()

[to-pstn]
; Outgoing calls to PSTN
exten => _1NXXNXXXXXX,1,NoOp(Outgoing PSTN call to ${EXTEN})
exten => _1NXXNXXXXXX,n,Set(CALLERID(num)=${HOTLINE_CALLERID})
exten => _1NXXNXXXXXX,n,Dial(PJSIP/${EXTEN}@voipms)
exten => _1NXXNXXXXXX,n,Hangup()
```

### 5.2 WebRTC-SIP Gateway

```typescript
// Self-hosted bridge using JsSIP or similar

import JsSIP from 'jssip';

class SelfHostedPSTNBridge {
  private ua: JsSIP.UA;

  constructor(asteriskConfig: AsteriskConfig) {
    const socket = new JsSIP.WebSocketInterface(asteriskConfig.wsUrl);

    this.ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${asteriskConfig.extension}@${asteriskConfig.domain}`,
      password: asteriskConfig.password,
      register: true,
    });

    this.ua.start();
  }

  // Handle incoming PSTN call
  onIncomingCall(session: JsSIP.RTCSession): void {
    // Get hotline ID from SIP headers
    const hotlineId = session.remote_identity.uri.user;

    // Create WebRTC offer to BuildIt
    session.on('peerconnection', (e) => {
      const pc = e.peerconnection;

      pc.ontrack = (event) => {
        // Bridge audio to BuildIt
        this.bridgeToBuildit(hotlineId, event.streams[0]);
      };
    });

    // Answer the PSTN call
    session.answer({
      mediaConstraints: { audio: true, video: false },
    });
  }

  // Initiate outbound PSTN call
  async callPSTN(
    hotlineId: string,
    targetNumber: string,
    buildItStream: MediaStream
  ): Promise<void> {
    const session = this.ua.call(`sip:${targetNumber}@asterisk`, {
      mediaConstraints: { audio: true, video: false },
      mediaStream: buildItStream,
    });

    session.on('confirmed', () => {
      console.log('PSTN call connected');
    });
  }
}
```

### 5.3 Docker Deployment

```yaml
# docker-compose.yml for self-hosted PSTN

version: '3.8'

services:
  asterisk:
    image: andrius/asterisk:alpine-18
    ports:
      - "5060:5060/udp"
      - "5061:5061/tcp"
      - "8089:8089/tcp"   # WebSocket
      - "10000-10100:10000-10100/udp"  # RTP
    volumes:
      - ./asterisk/sip.conf:/etc/asterisk/sip.conf
      - ./asterisk/extensions.conf:/etc/asterisk/extensions.conf
      - ./asterisk/keys:/etc/asterisk/keys
    environment:
      - ASTERISK_UID=1000
      - ASTERISK_GID=1000

  webrtc-bridge:
    build: ./webrtc-bridge
    depends_on:
      - asterisk
    environment:
      - ASTERISK_WS=wss://asterisk:8089/ws
      - BUILDIT_SIGNALING=wss://signaling.buildit.network
    ports:
      - "3000:3000"

  coturn:
    image: coturn/coturn
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/tcp"
    command: >
      --lt-cred-mech
      --realm=buildit.network
      --user=buildit:${TURN_PASSWORD}
      --fingerprint
```

---

## Part 6: Privacy Enhancements

### 6.1 Caller Number Masking

```typescript
// Don't expose real caller numbers to operators

class CallerPrivacy {
  // Generate masked caller ID
  generateMaskedId(realNumber: string): string {
    // Hash the number deterministically
    const hash = crypto.createHash('sha256')
      .update(realNumber + this.salt)
      .digest('hex')
      .slice(0, 8);

    return `caller_${hash}`;
  }

  // Operator sees masked ID, real number stored encrypted
  async storeCallerInfo(
    callId: string,
    realNumber: string
  ): Promise<{ maskedId: string }> {
    const maskedId = this.generateMaskedId(realNumber);

    // Encrypt real number with group key
    const encrypted = await this.encrypt(realNumber);

    await this.db.storeCallerMapping({
      callId,
      maskedId,
      encryptedNumber: encrypted,
    });

    return { maskedId };
  }

  // Only authorized personnel can reveal real number
  async revealNumber(
    callId: string,
    requesterPubkey: string,
    reason: string
  ): Promise<string | null> {
    // Check authorization
    if (!await this.canRevealNumbers(requesterPubkey)) {
      await this.logUnauthorizedAccess(callId, requesterPubkey);
      return null;
    }

    // Log the reveal
    await this.logNumberReveal(callId, requesterPubkey, reason);

    // Decrypt and return
    const mapping = await this.db.getCallerMapping(callId);
    return this.decrypt(mapping.encryptedNumber);
  }
}
```

### 6.2 Call Data Retention

```typescript
// Configurable retention policies

interface RetentionPolicy {
  callMetadata: number;    // Days to keep call records
  callNotes: number;       // Days to keep notes
  recordings: number;      // Days to keep recordings (if any)
  phoneNumbers: number;    // Days to keep caller numbers
}

const defaultRetention: RetentionPolicy = {
  callMetadata: 90,    // 3 months
  callNotes: 90,       // 3 months
  recordings: 30,      // 1 month
  phoneNumbers: 7,     // 1 week (minimal retention)
};

class DataRetentionManager {
  async purgeExpiredData(hotlineId: string): Promise<void> {
    const policy = await this.getPolicy(hotlineId);
    const now = Date.now();

    // Purge phone numbers (most sensitive)
    const phoneNumberCutoff = now - policy.phoneNumbers * 24 * 60 * 60 * 1000;
    await this.db.purgeCallerNumbers(hotlineId, phoneNumberCutoff);

    // Purge recordings
    const recordingCutoff = now - policy.recordings * 24 * 60 * 60 * 1000;
    await this.storage.purgeRecordings(hotlineId, recordingCutoff);

    // Purge old call metadata
    const metadataCutoff = now - policy.callMetadata * 24 * 60 * 60 * 1000;
    await this.db.purgeCallMetadata(hotlineId, metadataCutoff);

    // Log purge operation
    await this.logPurge(hotlineId, {
      phoneNumbers: phoneNumberCutoff,
      recordings: recordingCutoff,
      metadata: metadataCutoff,
    });
  }
}
```

---

## Implementation Tasks

### Phase 1: Twilio Integration
- [ ] Phone number provisioning
- [ ] Inbound call webhook
- [ ] WebRTC-PSTN bridge
- [ ] TwiML generation

### Phase 2: Outbound Calling
- [ ] Click-to-call API
- [ ] Outbound call UI
- [ ] Caller ID management
- [ ] Call status tracking

### Phase 3: Billing
- [ ] Credit system
- [ ] Usage tracking
- [ ] Low credit alerts
- [ ] Usage dashboard

### Phase 4: Self-Hosted
- [ ] Asterisk configuration
- [ ] WebRTC-SIP bridge
- [ ] Docker deployment
- [ ] Documentation

### Phase 5: Privacy
- [ ] Caller number masking
- [ ] Data retention policies
- [ ] Audit logging
- [ ] Number reveal workflow

---

## Success Criteria

- [ ] Inbound PSTN calls reach hotline queue
- [ ] Outbound calls work from operator UI
- [ ] Credit system prevents overuse
- [ ] Self-hosted option documented
- [ ] Caller numbers masked by default
- [ ] Clear privacy warnings displayed

## Open Questions

1. **Provider choice**: Twilio vs Telnyx vs multi-provider?
2. **Credit pricing**: How much to allocate per group tier?
3. **SMS support**: Should hotlines support text messages?
4. **Call recording**: Allow for PSTN calls? (legal considerations)
5. **International**: Support numbers outside US/Canada?
