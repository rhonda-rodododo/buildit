package network.buildit.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import network.buildit.core.ble.BLEAdvertiser
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.BLEScanner
import network.buildit.core.ble.GattServer
import network.buildit.core.ble.MeshRouter
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.KeystoreManager
import network.buildit.core.notifications.NotificationChannels
import network.buildit.core.notifications.NotificationService
import network.buildit.core.nostr.CertificatePinStore
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.RelayPool
import network.buildit.core.storage.BuildItDatabase
import network.buildit.core.transport.MessageQueue
import network.buildit.core.transport.TransportRouter
import network.buildit.widgets.WidgetDataProvider
import okhttp3.OkHttpClient
import javax.inject.Singleton

/**
 * Hilt module providing application-wide dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideKeystoreManager(
        @ApplicationContext context: Context
    ): KeystoreManager {
        return KeystoreManager(context)
    }

    @Provides
    @Singleton
    fun provideCryptoManager(
        keystoreManager: KeystoreManager
    ): CryptoManager {
        return CryptoManager(keystoreManager)
    }

    @Provides
    @Singleton
    fun provideBLEScanner(
        @ApplicationContext context: Context
    ): BLEScanner {
        return BLEScanner(context)
    }

    @Provides
    @Singleton
    fun provideBLEAdvertiser(
        @ApplicationContext context: Context,
        keystoreManager: KeystoreManager
    ): BLEAdvertiser {
        return BLEAdvertiser(context, keystoreManager)
    }

    @Provides
    @Singleton
    fun provideGattServer(
        @ApplicationContext context: Context,
        keystoreManager: KeystoreManager
    ): GattServer {
        return GattServer(context, keystoreManager)
    }

    @Provides
    @Singleton
    fun provideMeshRouter(
        gattServer: GattServer,
        cryptoManager: CryptoManager
    ): MeshRouter {
        return MeshRouter(gattServer, cryptoManager)
    }

    @Provides
    @Singleton
    fun provideBLEManager(
        @ApplicationContext context: Context,
        scanner: BLEScanner,
        advertiser: BLEAdvertiser,
        gattServer: GattServer,
        meshRouter: MeshRouter
    ): BLEManager {
        return BLEManager(context, scanner, advertiser, gattServer, meshRouter)
    }

    @Provides
    @Singleton
    fun provideCertificatePinStore(
        @ApplicationContext context: Context
    ): CertificatePinStore {
        return CertificatePinStore(context)
    }

    @Provides
    @Singleton
    fun provideRelayPool(
        certificatePinStore: CertificatePinStore
    ): RelayPool {
        return RelayPool(certificatePinStore)
    }

    @Provides
    @Singleton
    fun provideNostrClient(
        cryptoManager: CryptoManager,
        relayPool: RelayPool
    ): NostrClient {
        return NostrClient(cryptoManager, relayPool)
    }

    @Provides
    @Singleton
    fun provideMessageQueue(
        @ApplicationContext context: Context
    ): MessageQueue {
        return MessageQueue(context)
    }

    @Provides
    @Singleton
    fun provideTransportRouter(
        bleManager: BLEManager,
        nostrClient: NostrClient,
        messageQueue: MessageQueue,
        cryptoManager: CryptoManager
    ): TransportRouter {
        return TransportRouter(bleManager, nostrClient, messageQueue, cryptoManager)
    }

    @Provides
    @Singleton
    fun provideWidgetDataProvider(
        @ApplicationContext context: Context,
        database: BuildItDatabase
    ): WidgetDataProvider {
        return WidgetDataProvider(context, database)
    }

    @Provides
    @Singleton
    fun provideNotificationChannels(
        @ApplicationContext context: Context
    ): NotificationChannels {
        return NotificationChannels(context)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder().build()
    }

    @Provides
    @Singleton
    fun provideNotificationService(
        @ApplicationContext context: Context,
        notificationChannels: NotificationChannels
    ): NotificationService {
        return NotificationService(context, notificationChannels)
    }
}
