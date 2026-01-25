package network.buildit

import android.Manifest
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumentation tests for permission handling.
 *
 * BuildIt requires several permissions:
 * - Bluetooth (BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE)
 * - Location (for BLE scanning on older Android versions)
 * - Camera (for QR code scanning)
 * - Notifications (Android 13+)
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class PermissionHandlingTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    // Grant BLE permissions for tests
    @get:Rule(order = 1)
    val bluetoothPermissionRule: GrantPermissionRule = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        GrantPermissionRule.grant(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        )
    } else {
        GrantPermissionRule.grant(
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
    }

    private val context by lazy {
        InstrumentationRegistry.getInstrumentation().targetContext
    }

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun bluetoothPermissions_areGranted() {
        // Verify that Bluetooth permissions are available
        // This is ensured by GrantPermissionRule
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            assertTrue(
                "BLUETOOTH_SCAN should be granted",
                hasPermission(Manifest.permission.BLUETOOTH_SCAN)
            )
            assertTrue(
                "BLUETOOTH_CONNECT should be granted",
                hasPermission(Manifest.permission.BLUETOOTH_CONNECT)
            )
            assertTrue(
                "BLUETOOTH_ADVERTISE should be granted",
                hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE)
            )
        } else {
            assertTrue(
                "BLUETOOTH should be granted",
                hasPermission(Manifest.permission.BLUETOOTH)
            )
            assertTrue(
                "BLUETOOTH_ADMIN should be granted",
                hasPermission(Manifest.permission.BLUETOOTH_ADMIN)
            )
        }
    }

    @Test
    fun locationPermission_forBleScanning() {
        // Location is required for BLE scanning on API < 31
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            assertTrue(
                "ACCESS_FINE_LOCATION should be granted for BLE scanning",
                hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            )
        }
    }

    @Test
    fun appContext_hasCorrectPackage() {
        // Verify the app context is correct
        assertTrue(
            "Package name should be network.buildit or network.buildit.dev",
            context.packageName.startsWith("network.buildit")
        )
    }

    private fun hasPermission(permission: String): Boolean {
        return context.checkSelfPermission(permission) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}
