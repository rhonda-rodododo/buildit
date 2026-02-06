# ProGuard rules for BuildIt Android
# https://www.guardsquare.com/manual/configuration/usage

# ============== General Android ==============

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes InnerClasses,EnclosingMethod
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations

# Keep exception names
-keepattributes Exceptions

# ============== Hilt/Dagger ==============

# Dagger/Hilt rules
-dontwarn dagger.hilt.**
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ComponentSupplier { *; }
-keep class * extends dagger.hilt.internal.GeneratedEntryPoint { *; }

# Keep Hilt generated classes
-keepclasseswithmembers class * {
    @dagger.hilt.* <methods>;
}
-keepclasseswithmembers class * {
    @dagger.* <fields>;
}

# ============== Room Database ==============

# Room entities and DAOs
-keep class * extends androidx.room.RoomDatabase { *; }
-keep @androidx.room.Entity class * { *; }
-keep @androidx.room.Dao interface * { *; }

# Keep Room generated implementations
-keepclassmembers class * {
    @androidx.room.* <methods>;
}

# Preserve type converters
-keep class network.buildit.core.storage.*Converter { *; }

# ============== OkHttp & WebSocket ==============

-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Keep OkHttp for WebSocket connections
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ============== Kotlin Coroutines ==============

-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# ============== Kotlin Serialization ==============

-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

# ============== buildit-crypto Native Library ==============

# JNI native methods
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Keep UniFfi generated code
-keep class buildit_crypto.** { *; }
-keep class uniffi.** { *; }

# Keep all classes in the generated bindings
-keep,allowoptimization class network.buildit.uniffi.** { *; }

# ============== Data Classes ==============

# Keep data classes used in JSON/transport
-keep class network.buildit.core.transport.* { *; }
-keep class network.buildit.core.nostr.* { *; }
-keep class network.buildit.core.ble.* { *; }

# Keep sealed class hierarchies
-keep class network.buildit.** extends java.lang.Enum { *; }

# ============== Compose ==============

# Keep Compose stability annotations
-keep class androidx.compose.runtime.** { *; }

# ============== ZXing QR Code ==============

-keep class com.google.zxing.** { *; }

# ============== Biometric ==============

-keep class androidx.biometric.** { *; }

# ============== Debugging ==============

# Uncomment for better stack traces during development
# -keepattributes SourceFile,LineNumberTable
# -renamesourcefileattribute SourceFile

# ============== Misc ==============

# Remove logging in release builds (strip ALL log levels including w/e to prevent
# leaking sensitive data such as certificate fingerprints, hostnames, or key info)
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Don't warn about missing classes from optional dependencies
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
