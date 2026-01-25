/**
 * Compose Message Screen
 *
 * Allows starting a new conversation by entering a recipient's
 * Nostr public key (npub or hex format).
 */

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { nip19 } from 'nostr-tools'
import { useAuthStore } from '../src/stores'
import { useTranslation } from '../src/i18n'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

/**
 * Validate and convert npub/hex to hex pubkey
 */
function isValidPubkey(input: string): { valid: boolean; hex?: string; error?: string } {
  const trimmed = input.trim()

  // Check if it's a valid hex pubkey (64 characters)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return { valid: true, hex: trimmed.toLowerCase() }
  }

  // Check if it starts with npub1 (Bech32 encoded)
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') {
        return { valid: true, hex: decoded.data }
      }
      return { valid: false, error: 'Invalid npub format' }
    } catch (e) {
      return { valid: false, error: 'Invalid npub encoding' }
    }
  }

  // Check if it starts with nprofile1 (NIP-19 profile)
  if (trimmed.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'nprofile') {
        return { valid: true, hex: decoded.data.pubkey }
      }
      return { valid: false, error: 'Invalid nprofile format' }
    } catch (e) {
      return { valid: false, error: 'Invalid nprofile encoding' }
    }
  }

  return { valid: false, error: 'Invalid public key. Enter npub or hex format.' }
}

export default function ComposeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { identity } = useAuthStore()
  const [recipient, setRecipient] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleStartChat = useCallback(() => {
    setError(null)

    if (!recipient.trim()) {
      setError(t('messages.recipientPublicKey') + ' is required')
      return
    }

    const validation = isValidPubkey(recipient)
    if (!validation.valid) {
      setError(validation.error || t('messages.invalidPublicKey'))
      return
    }

    // Check if trying to message yourself
    if (validation.hex === identity?.publicKey) {
      setError("You can't message yourself")
      return
    }

    // Navigate to chat with the validated hex pubkey
    if (validation.hex) {
      router.replace(`/chat/${validation.hex}`)
    }
  }, [recipient, identity?.publicKey, router, t])

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (text) {
        setRecipient(text.trim())
        setError(null)
      }
    } catch (err) {
      console.error('Failed to paste:', err)
    }
  }, [])

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>Not Logged In</Text>
        <Text style={styles.errorSubtitle}>
          Please create or import an identity to send messages.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/')}>
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Start a conversation</Text>
          <Text style={styles.instructionsText}>
            Enter the recipient's Nostr public key to start a private, encrypted conversation.
          </Text>
        </View>

        {/* Recipient Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, error && styles.textInputError]}
              placeholder="npub1... or hex public key"
              placeholderTextColor="#a3a3a3"
              value={recipient}
              onChangeText={(text) => {
                setRecipient(text)
                setError(null)
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Pressable style={styles.pasteButton} onPress={handlePaste}>
              <Text style={styles.pasteButtonText}>Paste</Text>
            </Pressable>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.helpText}>
            You can find someone's public key on their Nostr profile.
          </Text>
        </View>

        {/* QR Scan Option */}
        <Pressable style={styles.scanOption} onPress={() => router.push('/scan')}>
          <Text style={styles.scanIcon}>📷</Text>
          <View style={styles.scanContent}>
            <Text style={styles.scanTitle}>Scan QR Code</Text>
            <Text style={styles.scanSubtitle}>Scan a contact's Nostr QR code</Text>
          </View>
          <Text style={styles.scanArrow}>{'>'}</Text>
        </Pressable>

        {/* Start Button */}
        <Pressable
          style={[styles.startButton, !recipient.trim() && styles.startButtonDisabled]}
          onPress={handleStartChat}
          disabled={!recipient.trim()}
        >
          <Text style={styles.startButtonText}>Start Conversation</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSize.xl,
    color: '#0a0a0a',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[6],
  },
  instructions: {
    marginBottom: spacing[6],
  },
  instructionsTitle: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  instructionsText: {
    fontSize: fontSize.base,
    color: '#737373',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: spacing[6],
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textInputError: {
    borderColor: '#ef4444',
  },
  pasteButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: spacing[4],
    borderRadius: 10,
    justifyContent: 'center',
  },
  pasteButtonText: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: '#ef4444',
    marginTop: spacing[2],
  },
  helpText: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
    marginTop: spacing[2],
  },
  scanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[6],
  },
  scanIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  scanContent: {
    flex: 1,
  },
  scanTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  scanSubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  scanArrow: {
    fontSize: fontSize.lg,
    color: '#a3a3a3',
  },
  startButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  errorSubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
})
