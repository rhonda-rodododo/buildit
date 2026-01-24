import { FC } from 'react';
import { useGroupContext } from '@/contexts/GroupContext';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

/**
 * Group Members Page
 * Manage group members and invitations
 */
export const GroupMembersPage: FC = () => {
  const { group, members, isLoading } = useGroupContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!group) {
    return <div>Group not found</div>;
  }

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <PageMeta
        title={`${group.name} - Members`}
        descriptionKey="meta.groups"
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">
            {members.length} {members.length === 1 ? 'member' : 'members'} in {group.name}
          </p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Members
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.pubkey}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {member.pubkey.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {member.pubkey.slice(0, 8)}...{member.pubkey.slice(-8)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Joined {new Date(member.joined).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                  {member.role}
                </Badge>
              </div>
            ))}
            {members.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No members found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
