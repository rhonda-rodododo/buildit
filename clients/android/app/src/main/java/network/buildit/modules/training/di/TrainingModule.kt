package network.buildit.modules.training.di

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import network.buildit.core.modules.BuildItModule
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.training.TrainingModuleImpl
import network.buildit.modules.training.data.local.*
import network.buildit.modules.training.data.repository.TrainingRepositoryImpl
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Singleton

/**
 * Hilt module providing Training module dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class TrainingHiltModule {

    /**
     * Binds the TrainingRepository implementation.
     */
    @Binds
    @Singleton
    abstract fun bindTrainingRepository(
        impl: TrainingRepositoryImpl
    ): TrainingRepository

    /**
     * Binds the TrainingModule as a BuildItModule.
     */
    @Binds
    @IntoSet
    abstract fun bindTrainingModule(
        impl: TrainingModuleImpl
    ): BuildItModule
}

/**
 * Provides DAOs for the Training module.
 */
@Module
@InstallIn(SingletonComponent::class)
object TrainingDaoModule {

    @Provides
    @Singleton
    fun provideTrainingCourseDao(database: BuildItDatabase): TrainingCourseDao {
        return database.trainingCourseDao()
    }

    @Provides
    @Singleton
    fun provideTrainingModuleDao(database: BuildItDatabase): TrainingModuleDao {
        return database.trainingModuleDao()
    }

    @Provides
    @Singleton
    fun provideTrainingLessonDao(database: BuildItDatabase): TrainingLessonDao {
        return database.trainingLessonDao()
    }

    @Provides
    @Singleton
    fun provideTrainingProgressDao(database: BuildItDatabase): TrainingProgressDao {
        return database.trainingProgressDao()
    }

    @Provides
    @Singleton
    fun provideTrainingQuizDao(database: BuildItDatabase): TrainingQuizDao {
        return database.trainingQuizDao()
    }

    @Provides
    @Singleton
    fun provideTrainingAssignmentDao(database: BuildItDatabase): TrainingAssignmentDao {
        return database.trainingAssignmentDao()
    }

    @Provides
    @Singleton
    fun provideTrainingCertificationDao(database: BuildItDatabase): TrainingCertificationDao {
        return database.trainingCertificationDao()
    }

    @Provides
    @Singleton
    fun provideTrainingLiveSessionDao(database: BuildItDatabase): TrainingLiveSessionDao {
        return database.trainingLiveSessionDao()
    }
}
