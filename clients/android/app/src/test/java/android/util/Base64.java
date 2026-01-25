package android.util;

/**
 * Mock implementation of android.util.Base64 for unit tests.
 * This allows tests to run without Robolectric while using code that calls Base64 methods.
 */
public class Base64 {
    public static final int DEFAULT = 0;
    public static final int NO_PADDING = 1;
    public static final int NO_WRAP = 2;
    public static final int CRLF = 4;
    public static final int URL_SAFE = 8;

    public static byte[] decode(String str, int flags) {
        return java.util.Base64.getDecoder().decode(str);
    }

    public static byte[] decode(byte[] input, int flags) {
        return java.util.Base64.getDecoder().decode(input);
    }

    public static byte[] decode(byte[] input, int offset, int len, int flags) {
        byte[] subset = new byte[len];
        System.arraycopy(input, offset, subset, 0, len);
        return java.util.Base64.getDecoder().decode(subset);
    }

    public static String encodeToString(byte[] input, int flags) {
        java.util.Base64.Encoder encoder = java.util.Base64.getEncoder();
        if ((flags & NO_PADDING) != 0) {
            encoder = encoder.withoutPadding();
        }
        // NO_WRAP just means no newlines, which java.util.Base64 doesn't add anyway
        return encoder.encodeToString(input);
    }

    public static String encodeToString(byte[] input, int offset, int len, int flags) {
        byte[] subset = new byte[len];
        System.arraycopy(input, offset, subset, 0, len);
        return encodeToString(subset, flags);
    }

    public static byte[] encode(byte[] input, int flags) {
        return encodeToString(input, flags).getBytes();
    }

    public static byte[] encode(byte[] input, int offset, int len, int flags) {
        byte[] subset = new byte[len];
        System.arraycopy(input, offset, subset, 0, len);
        return encode(subset, flags);
    }
}
