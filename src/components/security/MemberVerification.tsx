/**
 * Member Verification Component
 * In-person verification system for high-security campaigns
 * Prevents infiltration through trust scores and vouching
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  QrCode,
  UserPlus,
  Star,
  AlertTriangle,
  Info,
  Check
} from 'lucide-react';

export interface Member {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
  trustScore: number; // 0-100
  vouchedBy: string[];
  joinedDate: string;
  lastActive: string;
  role: 'member' | 'organizer' | 'admin';
}

interface MemberVerificationProps {
  currentUserId: string;
  isAdmin?: boolean;
  className?: string;
}

export const MemberVerification: FC<MemberVerificationProps> = ({
  currentUserId,
  isAdmin = false,
  className
}) => {
  const [members, setMembers] = useState<Member[]>([
    {
      id: 'member-1',
      name: 'Keisha Johnson',
      initials: 'KJ',
      verified: true,
      trustScore: 95,
      vouchedBy: ['admin-1', 'organizer-2'],
      joinedDate: '2024-01-15',
      lastActive: '2025-10-05',
      role: 'organizer'
    },
    {
      id: 'member-2',
      name: 'Marcus Chen',
      initials: 'MC',
      verified: true,
      trustScore: 85,
      vouchedBy: ['member-1', 'organizer-3'],
      joinedDate: '2024-03-20',
      lastActive: '2025-10-04',
      role: 'member'
    },
    {
      id: 'member-3',
      name: 'Tyler Morrison',
      initials: 'TM',
      verified: false,
      trustScore: 45,
      vouchedBy: [],
      joinedDate: '2025-09-28',
      lastActive: '2025-10-05',
      role: 'member'
    },
    {
      id: 'member-4',
      name: 'Aisha Williams',
      initials: 'AW',
      verified: true,
      trustScore: 78,
      vouchedBy: ['member-2'],
      joinedDate: '2024-07-10',
      lastActive: '2025-10-03',
      role: 'member'
    },
    {
      id: 'member-5',
      name: 'New Member',
      initials: 'NM',
      verified: false,
      trustScore: 20,
      vouchedBy: [],
      joinedDate: '2025-10-01',
      lastActive: '2025-10-05',
      role: 'member'
    }
  ]);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [vouchInput, setVouchInput] = useState('');

  const handleVerifyMember = (memberId: string) => {
    setMembers(prev => prev.map(m =>
      m.id === memberId
        ? { ...m, verified: true, trustScore: Math.min(m.trustScore + 30, 100) }
        : m
    ));
  };

  const handleVouchForMember = (memberId: string) => {
    setMembers(prev => prev.map(m =>
      m.id === memberId
        ? {
            ...m,
            vouchedBy: [...m.vouchedBy, currentUserId],
            trustScore: Math.min(m.trustScore + 15, 100)
          }
        : m
    ));
    setVouchInput('');
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getTrustScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-blue-500/10 border-blue-500/20';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getTrustScoreIcon = (score: number) => {
    if (score >= 80) return <ShieldCheck className="w-5 h-5 text-green-500" />;
    if (score >= 60) return <Shield className="w-5 h-5 text-blue-500" />;
    if (score >= 40) return <ShieldQuestion className="w-5 h-5 text-yellow-500" />;
    return <ShieldAlert className="w-5 h-5 text-red-500" />;
  };

  const getTrustScoreLabel = (score: number) => {
    if (score >= 80) return 'Trusted';
    if (score >= 60) return 'Verified';
    if (score >= 40) return 'New';
    return 'Unverified';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Member Verification</h2>
        <p className="text-muted-foreground">
          Verify members in-person to build trust and prevent infiltration
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">How Verification Works</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>In-Person Verification:</strong> Scan member's QR code when you meet face-to-face</li>
              <li>• <strong>Vouching:</strong> Vouch for members you trust to increase their trust score</li>
              <li>• <strong>Trust Score:</strong> Calculated based on verification, vouches, and activity</li>
              <li>• <strong>Verified Badge:</strong> Shows member has been verified in-person</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* QR Scanner (Demo) */}
      {isAdmin && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">QR Code Verification</h3>
            </div>
            <Button
              variant={showQRScanner ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowQRScanner(!showQRScanner)}
            >
              {showQRScanner ? 'Close Scanner' : 'Scan QR Code'}
            </Button>
          </div>

          {showQRScanner && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-6 text-center border-2 border-dashed">
                <QrCode className="w-16 h-16 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  QR Scanner would appear here in production
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Camera access required for in-person verification
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Or enter member ID manually..."
                  className="flex-1"
                />
                <Button size="sm">Verify</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Member List */}
      <div>
        <h3 className="font-semibold mb-3">Members</h3>
        <div className="space-y-2">
          {members.map((member) => {
            const isVouchedByMe = member.vouchedBy.includes(currentUserId);
            const canVouch = !isVouchedByMe && member.id !== currentUserId;

            return (
              <Card
                key={member.id}
                className={`p-4 ${getTrustScoreBgColor(member.trustScore)}`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{member.name}</h4>
                      {member.verified && (
                        <Badge variant="outline" className="gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          Verified
                        </Badge>
                      )}
                      {member.role === 'admin' && (
                        <Badge variant="default" className="shrink-0">Admin</Badge>
                      )}
                      {member.role === 'organizer' && (
                        <Badge variant="secondary" className="shrink-0">Organizer</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        {getTrustScoreIcon(member.trustScore)}
                        <span className={getTrustScoreColor(member.trustScore)}>
                          {getTrustScoreLabel(member.trustScore)} ({member.trustScore})
                        </span>
                      </div>
                      <div>•</div>
                      <div>Joined {new Date(member.joinedDate).toLocaleDateString()}</div>
                      {member.vouchedBy.length > 0 && (
                        <>
                          <div>•</div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {member.vouchedBy.length} {member.vouchedBy.length === 1 ? 'vouch' : 'vouches'}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!member.verified && isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyMember(member.id)}
                          className="gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Verify In-Person
                        </Button>
                      )}

                      {canVouch && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVouchForMember(member.id)}
                          className="gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          Vouch for Member
                        </Button>
                      )}

                      {isVouchedByMe && (
                        <Badge variant="outline" className="gap-1">
                          <Check className="w-3 h-3" />
                          You vouched
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Trust Score Badge */}
                  <div className="text-right shrink-0">
                    <div className={`text-2xl font-bold ${getTrustScoreColor(member.trustScore)}`}>
                      {member.trustScore}
                    </div>
                    <div className="text-xs text-muted-foreground">Trust Score</div>
                  </div>
                </div>

                {/* Warning for Low Trust */}
                {member.trustScore < 40 && (
                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        <strong>Low trust score.</strong> Consider in-person verification before sharing sensitive information.
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Trust Score Levels</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <div className="text-xs">
              <div className="font-medium">Trusted (80+)</div>
              <div className="text-muted-foreground">Verified + multiple vouches</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <div className="text-xs">
              <div className="font-medium">Verified (60-79)</div>
              <div className="text-muted-foreground">In-person verified</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-yellow-500" />
            <div className="text-xs">
              <div className="font-medium">New (40-59)</div>
              <div className="text-muted-foreground">Active but unverified</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <div className="text-xs">
              <div className="font-medium">Unverified (&lt;40)</div>
              <div className="text-muted-foreground">Requires verification</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
