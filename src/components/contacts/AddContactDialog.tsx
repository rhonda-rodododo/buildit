import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { useContactsStore } from '@/stores/contactsStore';
import { nip19 } from 'nostr-tools';

export const AddContactDialog: FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [npubOrHex, setNpubOrHex] = useState('');
  const [petname, setPetname] = useState('');
  const [error, setError] = useState('');
  const { followUser } = useContactsStore();

  const handleAdd = async () => {
    setError('');
    try {
      let pubkey = npubOrHex;

      // Try to decode if it's an npub
      if (npubOrHex.startsWith('npub')) {
        const decoded = nip19.decode(npubOrHex);
        if (decoded.type === 'npub') {
          pubkey = decoded.data as string;
        }
      } else if (npubOrHex.startsWith('nprofile')) {
        const decoded = nip19.decode(npubOrHex);
        if (decoded.type === 'nprofile') {
          pubkey = decoded.data.pubkey;
        }
      }

      // Validate hex pubkey
      if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
        setError(t('addContactDialog.invalidPubkey'));
        return;
      }

      await followUser(pubkey, undefined, petname || undefined);
      setOpen(false);
      setNpubOrHex('');
      setPetname('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          {t('addContactDialog.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addContactDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('addContactDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pubkey">{t('addContactDialog.pubkeyLabel')}</Label>
            <Input
              id="pubkey"
              placeholder={t('addContactDialog.pubkeyPlaceholder')}
              value={npubOrHex}
              onChange={(e) => setNpubOrHex(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="petname">{t('addContactDialog.petnameLabel')}</Label>
            <Input
              id="petname"
              placeholder={t('addContactDialog.petnamePlaceholder')}
              value={petname}
              onChange={(e) => setPetname(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleAdd} className="w-full">
            {t('addContactDialog.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
