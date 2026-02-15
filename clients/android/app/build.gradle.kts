import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
}

// Load keystore properties for signing
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    namespace = "network.buildit"
    compileSdk = 34

    // NDK configuration for buildit-crypto native library
    ndkVersion = "25.2.9519653"

    defaultConfig {
        applicationId = "network.buildit"
        minSdk = 26
        targetSdk = 34
        versionCode = 102
        versionName = "0.1.2"

        testInstrumentationRunner = "network.buildit.HiltTestRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // ABI filters for native library
        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86_64")
        }

        // Supported locales for i18n
        resourceConfigurations += listOf(
            "en", "es", "fr", "ar", "zh-rCN",
            "vi", "ko", "ru", "pt", "ht", "tl"
        )
    }

    // JNI libraries directory
    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("src/main/jniLibs")
        }
    }

    // Product flavors for different environments
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            buildConfigField("String", "DEFAULT_RELAY", "\"wss://relay.dev.buildit.network\"")
            buildConfigField("Boolean", "DEBUG_LOGGING", "true")
        }
        create("prod") {
            dimension = "environment"
            buildConfigField("String", "DEFAULT_RELAY", "\"wss://relay.buildit.network\"")
            buildConfigField("Boolean", "DEBUG_LOGGING", "false")
        }
    }

    // Signing configurations
    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = file(keystoreProperties.getProperty("storeFile", ""))
                storePassword = keystoreProperties.getProperty("storePassword", "")
                keyAlias = keystoreProperties.getProperty("keyAlias", "")
                keyPassword = keystoreProperties.getProperty("keyPassword", "")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api"
        freeCompilerArgs += "-opt-in=androidx.compose.foundation.ExperimentalFoundationApi"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.compose.compiler.get()
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    lint {
        // TODO: Create lint baseline to track regressions
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    // Core Android
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.compose.bom))
    implementation(libs.bundles.compose)
    debugImplementation(libs.compose.ui.tooling)

    // Navigation
    implementation(libs.navigation.compose)

    // Lifecycle
    implementation(libs.bundles.lifecycle)

    // Coroutines
    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)

    // Hilt DI
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Room Database with SQLCipher encryption
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.sqlcipher)
    implementation(libs.sqlite)

    // Kotlin Serialization
    implementation(libs.kotlinx.serialization.json)

    // OkHttp
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // DataStore
    implementation(libs.datastore.preferences)

    // Biometric
    implementation(libs.biometric)

    // Security (EncryptedSharedPreferences)
    implementation(libs.security.crypto)

    // QR Code
    implementation(libs.zxing.core)

    // Cryptography (Argon2id via BouncyCastle)
    implementation(libs.bouncycastle)

    // Permissions
    implementation(libs.accompanist.permissions)

    // Play Services Location
    implementation(libs.play.services.location)
    implementation(libs.coroutines.play.services)

    // Image Loading
    implementation(libs.coil.compose)

    // Glance (Compose-based Widgets)
    implementation(libs.bundles.glance)

    // WorkManager
    implementation(libs.bundles.workmanager)

    // CameraX for QR scanning
    implementation(libs.bundles.camerax)
    implementation(libs.mlkit.barcode)

    // WebRTC for voice/video calling
    implementation(libs.webrtc)

    // Testing - Unit
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.junit.jupiter.params)
    testRuntimeOnly(libs.junit.jupiter.engine)
    testImplementation(libs.mockk)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.truth)
    testImplementation(libs.room.testing)
    testImplementation(libs.robolectric)
    testImplementation(libs.json)

    // Testing - Instrumentation
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.hilt.testing)
    androidTestImplementation(libs.truth)
    androidTestImplementation(libs.coroutines.test)
    kspAndroidTest(libs.hilt.compiler)
    debugImplementation(libs.compose.ui.test.manifest)
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
