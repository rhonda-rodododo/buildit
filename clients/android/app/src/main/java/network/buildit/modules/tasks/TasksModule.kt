package network.buildit.modules.tasks

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.BuildItModule
import network.buildit.core.nostr.NostrClient
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.tasks.data.TaskRepository
import network.buildit.modules.tasks.data.local.TaskDao
import network.buildit.modules.tasks.domain.TasksBuildItModule
import network.buildit.modules.tasks.domain.TasksUseCase
import javax.inject.Singleton

/**
 * Hilt module for Tasks dependency injection.
 */
@Module
@InstallIn(SingletonComponent::class)
object TasksHiltModule {

    @Provides
    fun provideTaskDao(database: BuildItDatabase): TaskDao {
        return database.taskDao()
    }

    @Provides
    @Singleton
    fun provideTaskRepository(taskDao: TaskDao): TaskRepository {
        return TaskRepository(taskDao)
    }

    @Provides
    @Singleton
    fun provideTasksUseCase(
        repository: TaskRepository,
        cryptoManager: CryptoManager,
        nostrClient: NostrClient
    ): TasksUseCase {
        return TasksUseCase(repository, cryptoManager, nostrClient)
    }

    @Provides
    @Singleton
    fun provideTasksBuildItModule(
        tasksUseCase: TasksUseCase
    ): TasksBuildItModule {
        return TasksBuildItModule(tasksUseCase)
    }
}

/**
 * Binds TasksBuildItModule into the BuildItModule set for automatic registration.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class TasksBindingModule {
    @Binds
    @IntoSet
    abstract fun bindTasksModule(impl: TasksBuildItModule): BuildItModule
}
