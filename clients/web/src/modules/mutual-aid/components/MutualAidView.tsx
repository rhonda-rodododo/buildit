import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Heart, Users, MapIcon } from 'lucide-react'
import { MapView, MapPin as MapPinType } from '@/components/ui/MapView'
import { useMutualAidStore } from '../mutualAidStore'

export const MutualAidView: FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('browse')

  // Get items from store for the map view
  const aidItems = useMutualAidStore((state) => state.aidItems)

  // Build map pins from items with location data
  const mapPins: MapPinType[] = aidItems
    .filter((item) => item.locationData != null)
    .map((item) => ({
      lat: item.locationData!.lat,
      lng: item.locationData!.lng,
      label: `${item.type === 'request' ? 'Request' : 'Offer'}: ${item.title}`,
      precision: item.locationData!.precision,
      color: item.type === 'request' ? 'red' as const : 'green' as const,
    }))

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('mutualAid.title')}</h2>
          <p className="text-muted-foreground">
            {t('mutualAid.description')}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('mutualAid.createRequest')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">{t('mutualAid.browse')}</TabsTrigger>
          <TabsTrigger value="map">
            <MapIcon className="h-4 w-4 mr-1" />
            {t('mutualAid.mapView', 'Map')}
          </TabsTrigger>
          <TabsTrigger value="my-items">{t('mutualAid.myItems')}</TabsTrigger>
          <TabsTrigger value="matches">{t('mutualAid.matches')}</TabsTrigger>
          <TabsTrigger value="rides">{t('mutualAid.rideShare')}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('mutualAid.requests')}
                </CardTitle>
                <CardDescription>
                  {t('mutualAid.requestsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  {t('mutualAid.noRequests')}
                </div>
              </CardContent>
            </Card>

            {/* Offers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  {t('mutualAid.offers')}
                </CardTitle>
                <CardDescription>
                  {t('mutualAid.offersDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  {t('mutualAid.noOffers')}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('mutualAid.mapViewTitle', 'Nearby Requests & Offers')}</CardTitle>
              <CardDescription>
                {t('mutualAid.mapViewDesc', 'Red pins are requests, green pins are offers. Click a pin for details.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mapPins.length > 0 ? (
                <MapView
                  pins={mapPins}
                  height="400px"
                  interactive={true}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {t('mutualAid.noLocationItems', 'No items with location data yet. Add a location when creating requests or offers.')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-items" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            {t('mutualAid.noMyItems')}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            {t('mutualAid.noMatches')}
          </div>
        </TabsContent>

        <TabsContent value="rides" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('mutualAid.solidarityRideShare')}</CardTitle>
              <CardDescription>
                {t('mutualAid.rideShareDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {t('mutualAid.noRideShares')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
