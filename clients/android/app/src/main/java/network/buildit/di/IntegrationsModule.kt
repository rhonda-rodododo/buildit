package network.buildit.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import network.buildit.modules.calling.service.OperatorStatusManager
import network.buildit.modules.calling.service.SFUConferenceManager
import network.buildit.modules.crm.integration.CRMCallingIntegration
import network.buildit.modules.events.data.EventsRepository
import network.buildit.modules.events.integration.EventCallingIntegration
import network.buildit.modules.events.integration.VolunteerCallingIntegration
import javax.inject.Singleton

/**
 * Hilt module providing cross-module integrations.
 *
 * This module wires together the calling, events, and CRM modules
 * to enable features like:
 * - Virtual event conferences
 * - Caller ID lookup from CRM
 * - Volunteer/operator management
 */
@Module
@InstallIn(SingletonComponent::class)
object IntegrationsModule {

    /**
     * Provides the Event-Calling integration for virtual events.
     *
     * Enables:
     * - Starting conference rooms for events
     * - Tracking virtual attendance
     * - Scheduling automatic conference starts
     * - Creating breakout rooms
     */
    @Provides
    @Singleton
    fun provideEventCallingIntegration(
        @ApplicationContext context: Context,
        conferenceManager: SFUConferenceManager,
        eventsRepository: EventsRepository
    ): EventCallingIntegration {
        return EventCallingIntegration(
            context = context,
            conferenceManager = conferenceManager,
            eventsRepository = eventsRepository
        )
    }

    /**
     * Provides the CRM-Calling integration for caller ID and history.
     *
     * Enables:
     * - Looking up contacts by phone number
     * - Logging call interactions to contact history
     * - Tracking engagement scores from calls
     * - Creating contacts from calls
     */
    @Provides
    @Singleton
    fun provideCRMCallingIntegration(): CRMCallingIntegration {
        return CRMCallingIntegration()
    }

    /**
     * Provides the Volunteer-Calling integration for operator management.
     *
     * Enables:
     * - Checking volunteer requirements (training, certifications)
     * - Granting/revoking hotline access
     * - Managing operator pools for shifts
     * - Processing volunteer signup confirmations
     */
    @Provides
    @Singleton
    fun provideVolunteerCallingIntegration(
        conferenceManager: SFUConferenceManager,
        eventsRepository: EventsRepository,
        operatorStatusManager: OperatorStatusManager
    ): VolunteerCallingIntegration {
        return VolunteerCallingIntegration(
            conferenceManager = conferenceManager,
            eventsRepository = eventsRepository,
            operatorStatusManager = operatorStatusManager
        )
    }
}
