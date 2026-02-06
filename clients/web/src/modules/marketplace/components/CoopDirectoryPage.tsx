/**
 * CoopDirectoryPage Component
 * Worker co-op directory with filtering and profiles
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, MapPin, Users, Shield, Globe, Search } from 'lucide-react';
import { useCoopProfiles } from '../hooks/useMarketplace';
import type { CoopProfile, GovernanceModel } from '../types';

interface CoopDirectoryPageProps {
  onViewCoop: (coop: CoopProfile) => void;
  onCreateCoop: () => void;
}

const governanceLabels: Record<GovernanceModel, string> = {
  consensus: 'Consensus',
  democratic: 'Democratic',
  sociocracy: 'Sociocracy',
  holacracy: 'Holacracy',
  hybrid: 'Hybrid',
  other: 'Other',
};

export function CoopDirectoryPage({ onViewCoop, onCreateCoop }: CoopDirectoryPageProps) {
  const { t } = useTranslation();
  const { coops } = useCoopProfiles();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGovernance, setFilterGovernance] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');

  // Collect unique industries from co-ops
  const industries = [...new Set(coops.map((c) => c.industry).filter(Boolean))];

  // Filter co-ops
  const filteredCoops = coops.filter((coop) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !coop.name.toLowerCase().includes(q) &&
        !coop.description.toLowerCase().includes(q) &&
        !coop.industry.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filterGovernance !== 'all' && coop.governanceModel !== filterGovernance) return false;
    if (filterIndustry !== 'all' && coop.industry !== filterIndustry) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('marketplace.coopDirectory')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('marketplace.coopDirectoryDescription', 'Discover and connect with worker cooperatives')}
          </p>
        </div>
        <Button onClick={onCreateCoop}>
          <Plus className="h-4 w-4 mr-2" />
          {t('marketplace.registerCoop')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('marketplace.searchCoops', 'Search co-ops...')}
            className="pl-9"
          />
        </div>
        <Select value={filterGovernance} onValueChange={setFilterGovernance}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('marketplace.governance')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('marketplace.allGovernance', 'All Governance')}</SelectItem>
            {Object.entries(governanceLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {industries.length > 0 && (
          <Select value={filterIndustry} onValueChange={setFilterIndustry}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('marketplace.industry')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('marketplace.allIndustries', 'All Industries')}</SelectItem>
              {industries.map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Co-op Cards */}
      {filteredCoops.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-lg font-semibold">{t('marketplace.noCoops')}</h3>
            <p className="text-muted-foreground">
              {t('marketplace.noCoopsDescription', 'Register your cooperative to be found by the community.')}
            </p>
            <Button onClick={onCreateCoop}>
              <Plus className="h-4 w-4 mr-2" />
              {t('marketplace.registerCoop')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCoops.map((coop) => (
            <Card
              key={coop.id}
              className="p-6 cursor-pointer hover:border-primary transition-colors"
              onClick={() => onViewCoop(coop)}
            >
              <div className="flex items-start gap-4">
                {coop.image ? (
                  <img
                    src={coop.image}
                    alt={coop.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{coop.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{coop.description}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{coop.memberCount} {t('marketplace.members')}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {governanceLabels[coop.governanceModel] ?? coop.governanceModel}
                  </Badge>
                </div>

                {coop.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{coop.location.label}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{coop.industry}</Badge>
                  {coop.verifiedBy.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3 text-green-600" />
                      <span>{coop.verifiedBy.length} {t('marketplace.vouchers')}</span>
                    </div>
                  )}
                  {coop.website && (
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
