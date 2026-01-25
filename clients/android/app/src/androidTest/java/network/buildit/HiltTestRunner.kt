package network.buildit

import android.app.Application
import android.content.Context
import androidx.test.runner.AndroidJUnitRunner
import dagger.hilt.android.testing.HiltTestApplication

/**
 * Custom test runner for Hilt instrumentation tests.
 *
 * This runner replaces the default application with HiltTestApplication,
 * allowing dependency injection in tests.
 */
class HiltTestRunner : AndroidJUnitRunner() {
    override fun newApplication(
        classLoader: ClassLoader?,
        className: String?,
        context: Context?
    ): Application {
        return super.newApplication(
            classLoader,
            HiltTestApplication::class.java.name,
            context
        )
    }
}
