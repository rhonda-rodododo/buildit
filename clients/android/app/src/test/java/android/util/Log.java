package android.util;

/**
 * Mock implementation of android.util.Log for unit tests.
 * This allows tests to run without Robolectric while using code that calls Log methods.
 */
public class Log {
    public static int d(String tag, String msg) {
        System.out.println("DEBUG: " + tag + ": " + msg);
        return 0;
    }

    public static int d(String tag, String msg, Throwable tr) {
        System.out.println("DEBUG: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static int i(String tag, String msg) {
        System.out.println("INFO: " + tag + ": " + msg);
        return 0;
    }

    public static int i(String tag, String msg, Throwable tr) {
        System.out.println("INFO: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static int w(String tag, String msg) {
        System.out.println("WARN: " + tag + ": " + msg);
        return 0;
    }

    public static int w(String tag, String msg, Throwable tr) {
        System.out.println("WARN: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static int w(String tag, Throwable tr) {
        System.out.println("WARN: " + tag);
        tr.printStackTrace();
        return 0;
    }

    public static int e(String tag, String msg) {
        System.out.println("ERROR: " + tag + ": " + msg);
        return 0;
    }

    public static int e(String tag, String msg, Throwable tr) {
        System.out.println("ERROR: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static int v(String tag, String msg) {
        System.out.println("VERBOSE: " + tag + ": " + msg);
        return 0;
    }

    public static int v(String tag, String msg, Throwable tr) {
        System.out.println("VERBOSE: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static int wtf(String tag, String msg) {
        System.out.println("WTF: " + tag + ": " + msg);
        return 0;
    }

    public static int wtf(String tag, Throwable tr) {
        System.out.println("WTF: " + tag);
        tr.printStackTrace();
        return 0;
    }

    public static int wtf(String tag, String msg, Throwable tr) {
        System.out.println("WTF: " + tag + ": " + msg);
        tr.printStackTrace();
        return 0;
    }

    public static boolean isLoggable(String tag, int level) {
        return true;
    }
}
