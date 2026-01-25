import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Plus, Table, Columns, Calendar } from 'lucide-react'

export const CRMView: FC = () => {
  const { t } = useTranslation()

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('crmView.title')}</h2>
          <p className="text-muted-foreground">
            {t('crmView.subtitle')}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('crmView.addContact')}
        </Button>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">
            <Table className="h-4 w-4 mr-2" />
            {t('crmView.views.table')}
          </TabsTrigger>
          <TabsTrigger value="board">
            <Columns className="h-4 w-4 mr-2" />
            {t('crmView.views.board')}
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            {t('crmView.views.calendar')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('crmView.contacts.title')}
              </CardTitle>
              <CardDescription>
                {t('crmView.contacts.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                {t('crmView.contacts.emptyState')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            {t('crmView.emptyStates.board')}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            {t('crmView.emptyStates.calendar')}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('crmView.templates.title')}</CardTitle>
          <CardDescription>{t('crmView.templates.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">{t('crmView.templates.unionOrganizing.title')}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t('crmView.templates.unionOrganizing.description')}
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">{t('crmView.templates.fundraising.title')}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t('crmView.templates.fundraising.description')}
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">{t('crmView.templates.legalTracking.title')}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t('crmView.templates.legalTracking.description')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
