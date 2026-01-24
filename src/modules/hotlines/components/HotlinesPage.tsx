/**
 * Hotlines Page Component
 * Main page for managing hotlines and call logs
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Phone, Plus, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHotlinesStore } from '../hotlinesStore';
import { HotlinesList } from './HotlinesList';
import { CallLogList } from './CallLogList';
import { ActiveCallsPanel } from './ActiveCallsPanel';

export function HotlinesPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const {
    hotlines,
    activeCalls,
    stats,
    currentHotlineId,
    isLoading,
    loadHotlines,
    loadStats,
    setCurrentHotline,
  } = useHotlinesStore();

  useEffect(() => {
    if (groupId) {
      loadHotlines(groupId);
    }
  }, [groupId, loadHotlines]);

  useEffect(() => {
    if (currentHotlineId) {
      loadStats(currentHotlineId);
    }
  }, [currentHotlineId, loadStats]);

  const currentHotline = hotlines.find((h) => h.id === currentHotlineId);

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            {t('hotlines.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('hotlines.subtitle')}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('hotlines.createHotline')}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('hotlines.totalCalls')}</CardDescription>
              <CardTitle className="text-2xl">{stats.totalCalls}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('hotlines.activeCalls')}</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {stats.activeCalls}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('hotlines.avgDuration')}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.round(stats.averageCallDuration / 60)}m
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('hotlines.operatorsOnDuty')}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-1">
                <Users className="h-4 w-4" />
                {stats.activeOperators}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hotlines List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('hotlines.title')}</CardTitle>
            <CardDescription>{t('hotlines.selectHotline')}</CardDescription>
          </CardHeader>
          <CardContent>
            <HotlinesList
              hotlines={hotlines}
              selectedId={currentHotlineId}
              onSelect={setCurrentHotline}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {currentHotline ? (
            <Card>
              <CardHeader>
                <CardTitle>{currentHotline.name}</CardTitle>
                <CardDescription>
                  {currentHotline.description || `${currentHotline.type} hotline`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="active">
                  <TabsList>
                    <TabsTrigger value="active">
                      {t('hotlines.active')} ({activeCalls.length})
                    </TabsTrigger>
                    <TabsTrigger value="history">{t('hotlines.callHistory')}</TabsTrigger>
                    <TabsTrigger value="operators">{t('hotlines.operators')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="mt-4">
                    <ActiveCallsPanel hotlineId={currentHotline.id} />
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    <CallLogList hotlineId={currentHotline.id} />
                  </TabsContent>

                  <TabsContent value="operators" className="mt-4">
                    <div className="text-muted-foreground text-center py-8">
                      {t('hotlines.operatorManagementSoon')}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">
                  {t('hotlines.selectHotlineToView')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default HotlinesPage;
