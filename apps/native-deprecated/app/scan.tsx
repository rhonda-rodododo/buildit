/**
 * QR Scanner Screen - Device Linking via NIP-46
 *
 * Scans a QR code from another device to establish a NIP-46 remote signing connection.
 */

import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, Alert, Platform, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import {
  deviceLinkingService,
  type Nip46ConnectionData,
  type Nip46ConnectionStatus,
} from '../src/services/deviceLinking'
import { useAuthStore } from '../src/stores'

export default function ScanScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<Nip46ConnectionStatus | null>(null)
  const [bunkerUrl, setBunkerUrl] = useState('')
  const { addLinkedDevice } = useAuthStore()

  // Listen for connection status changes
  useEffect(() => {
    const unsubscribe = deviceLinkingService.onStatusChange((_, status) => {
      setConnectionStatus(status)
    })
    return unsubscribe
  }, [])

  const handleConnection = useCallback(
    async (connectionData: Nip46ConnectionData) => {
      setIsProcessing(true)
      setConnectionStatus('connecting')

      try {
        const connection = await deviceLinkingService.connect(connectionData)

        // Add to linked devices in auth store
        await addLinkedDevice({
          name: connection.name,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        })

        Alert.alert('Connected!', 'Successfully linked to your other device.', [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/settings'),
          },
        ])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed'
        Alert.alert('Connection Failed', message, [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false)
              setIsProcessing(false)
              setConnectionStatus(null)
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ])
      }
    },
    [addLinkedDevice, router]
  )

  const handleManualConnect = useCallback(() => {
    const connectionData = deviceLinkingService.parseConnectionUrl(bunkerUrl.trim())
    if (!connectionData) {
      Alert.alert('Invalid URL', 'Please enter a valid bunker:// or nostrconnect:// URL')
      return
    }
    handleConnection(connectionData)
  }, [bunkerUrl, handleConnection])

  // Web doesn't support camera scanning the same way
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <Text style={styles.title}>Device Linking</Text>
          <Text style={styles.subtitle}>
            Camera scanning is not supported on web.{'\n'}
            Paste a bunker URL to connect.
          </Text>

          <View style={styles.webInputContainer}>
            <Text style={styles.label}>Paste bunker URL</Text>
            <TextInput
              style={styles.urlInput}
              value={bunkerUrl}
              onChangeText={setBunkerUrl}
              placeholder="bunker://pubkey?relay=..."
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              You can paste a bunker:// or nostrconnect:// URL directly
            </Text>
          </View>

          <Pressable
            style={[styles.primaryButton, !bunkerUrl && styles.primaryButtonDisabled]}
            onPress={handleManualConnect}
            disabled={!bunkerUrl || isProcessing}
          >
            <Text style={styles.primaryButtonText}>
              {isProcessing ? 'Connecting...' : 'Connect'}
            </Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => router.back()}>
            <Text style={styles.linkText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (!permission) {
    // Loading permissions
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Loading camera...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    // Permission not granted
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <Text style={styles.title}>Camera Permission</Text>
          <Text style={styles.subtitle}>
            We need camera access to scan the QR code from your other device.
          </Text>

          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </Pressable>

          <Pressable
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return

    setScanned(true)

    const connectionData = deviceLinkingService.parseConnectionUrl(data)

    if (!connectionData) {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid NIP-46 device link. Please scan a QR code generated by the BuildIt web app.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false)
              setIsProcessing(false)
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      )
      return
    }

    // Show confirmation dialog
    Alert.alert(
      'Connect to Device?',
      `This will link your identity from another device.\n\nRelay: ${connectionData.relay}\n\nThis device will be able to sign events using the linked identity.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setScanned(false)
            setIsProcessing(false)
          },
        },
        {
          text: 'Connect',
          onPress: () => handleConnection(connectionData),
        },
      ]
    )
  }

  return (
    <View style={styles.scanContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top + spacing[4] }]}>
        <Text style={styles.scanTitle}>Scan QR Code</Text>
        <Text style={styles.scanSubtitle}>
          Point your camera at the QR code shown on your other device
        </Text>
      </View>

      {/* Scan frame */}
      <View style={styles.frameContainer}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      {/* Back button */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + spacing[4] }]}>
        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Processing indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>
              {connectionStatus === 'connecting'
                ? 'Connecting to relay...'
                : connectionStatus === 'awaiting_approval'
                  ? 'Waiting for approval...'
                  : 'Processing...'}
            </Text>
            {connectionStatus === 'awaiting_approval' && (
              <Text style={styles.processingHint}>
                Please approve the connection on your other device
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  scanContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.base,
    color: '#737373',
    marginBottom: spacing[8],
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  primaryButtonText: {
    color: '#fafafa',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  linkButton: {
    padding: spacing[2],
  },
  linkText: {
    color: '#0a0a0a',
    fontSize: fontSize.sm,
  },
  webInputContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  hint: {
    fontSize: fontSize.xs,
    color: '#737373',
  },
  urlInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[2],
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  primaryButtonDisabled: {
    backgroundColor: '#a3a3a3',
  },
  backButton: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fafafa',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  // Scanner styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing[6],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#ffffff',
    marginBottom: spacing[2],
  },
  scanSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[6],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    borderRadius: 24,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingBox: {
    backgroundColor: '#ffffff',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
  },
  processingText: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  processingHint: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginTop: spacing[2],
    textAlign: 'center',
  },
})
