/**
 * Custom entry file for Expo Router
 *
 * Polyfills MUST be imported before anything else to ensure
 * nostr-tools and other crypto libraries work in React Native.
 */

// Polyfill crypto.getRandomValues() - required for nostr-tools
import 'react-native-get-random-values';

// Polyfill TextEncoder/TextDecoder - required for nostr-tools
import 'text-encoding-polyfill';

// Now load Expo Router
import 'expo-router/entry';
