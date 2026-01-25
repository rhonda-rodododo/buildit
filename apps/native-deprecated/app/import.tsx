/**
 * Import Screen - Import Existing Identity
 *
 * Import via recovery phrase, private key, or device link (QR/NIP-46).
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { validateRecoveryPhrase, isValidPrivateKey } from '@buildit/sdk'
import { useAuthStore } from '../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

type ImportMethod = 'phrase' | 'key' | 'link'

export default function ImportScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { importFromPhrase, importFromPrivateKey, isLoading } = useAuthStore()

  const [method, setMethod] = useState<ImportMethod>('phrase')
  const [input, setInput] = useState('')

  const handleImport = async () => {
    if (!input.trim() && method !== 'link') {
      Alert.alert('Input Required', 'Please enter your recovery phrase or key')
      return
    }

    try {
      if (method === 'phrase') {
        if (!validateRecoveryPhrase(input.trim())) {
          Alert.alert('Invalid Phrase', 'Please enter a valid 12 or 24 word recovery phrase')
          return
        }
        const keypair = await importFromPhrase(input.trim())
        Alert.alert(
          'Identity Imported',
          `Welcome back! Your public key: ${keypair.publicKey.slice(0, 16)}...`,
          [{ text: 'Continue', onPress: () => router.push('/') }]
        )
      } else if (method === 'key') {
        if (!isValidPrivateKey(input.trim())) {
          Alert.alert('Invalid Key', 'Please enter a valid 64-character hex private key or nsec')
          return
        }
        const keypair = await importFromPrivateKey(input.trim())
        Alert.alert(
          'Identity Imported',
          `Your public key: ${keypair.publicKey.slice(0, 16)}...`,
          [{ text: 'Continue', onPress: () => router.push('/') }]
        )
      } else {
        // Device link - navigate to QR scanner
        router.push('/scan')
      }
    } catch (error) {
      Alert.alert('Import Failed', 'Could not import identity. Please check your input.')
      console.error(error)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Import Identity</Text>
        <Text style={styles.subtitle}>
          Restore your existing Nostr identity
        </Text>

        {/* Method selector */}
        <View style={styles.methodSelector}>
          <Pressable
            style={[styles.methodButton, method === 'phrase' && styles.methodButtonActive]}
            onPress={() => setMethod('phrase')}
          >
            <Text style={[styles.methodText, method === 'phrase' && styles.methodTextActive]}>
              Phrase
            </Text>
          </Pressable>
          <Pressable
            style={[styles.methodButton, method === 'key' && styles.methodButtonActive]}
            onPress={() => setMethod('key')}
          >
            <Text style={[styles.methodText, method === 'key' && styles.methodTextActive]}>
              Private Key
            </Text>
          </Pressable>
          <Pressable
            style={[styles.methodButton, method === 'link' && styles.methodButtonActive]}
            onPress={() => setMethod('link')}
          >
            <Text style={[styles.methodText, method === 'link' && styles.methodTextActive]}>
              Device Link
            </Text>
          </Pressable>
        </View>

        {/* Input area */}
        {method !== 'link' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {method === 'phrase' ? 'Recovery Phrase' : 'Private Key (hex or nsec)'}
            </Text>
            <TextInput
              style={[styles.input, method === 'phrase' && styles.multilineInput]}
              value={input}
              onChangeText={setInput}
              placeholder={
                method === 'phrase'
                  ? 'Enter your 12 or 24 word recovery phrase'
                  : 'Enter your 64-character private key or nsec'
              }
              placeholderTextColor="#a3a3a3"
              multiline={method === 'phrase'}
              numberOfLines={method === 'phrase' ? 3 : 1}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={method === 'key'}
            />
          </View>
        )}

        {method === 'link' && (
          <View style={styles.linkInfo}>
            <View style={styles.linkIconContainer}>
              <Text style={styles.linkIcon}>📱</Text>
            </View>
            <Text style={styles.linkInfoText}>
              Scan a QR code from another device to link your identity securely.
            </Text>
            <Text style={styles.linkInfoSubtext}>
              This uses NIP-46 remote signing for secure device authorization.
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {method === 'link' ? 'Open Scanner' : isLoading ? 'Importing...' : 'Import'}
          </Text>
        </Pressable>

        <Link href="/" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.linkText}>Back</Text>
          </Pressable>
        </Link>
      </View>
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
  },
  subtitle: {
    fontSize: fontSize.base,
    color: '#737373',
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  methodSelector: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing[6],
  },
  methodButton: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 10,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#ffffff',
  },
  methodText: {
    fontSize: fontSize.sm,
    color: '#737373',
    fontWeight: String(fontWeight.medium) as '500',
  },
  methodTextActive: {
    color: '#0a0a0a',
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing[6],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  linkInfo: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: spacing[6],
    marginBottom: spacing[6],
    alignItems: 'center',
  },
  linkIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  linkIcon: {
    fontSize: 32,
  },
  linkInfoText: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
    textAlign: 'center',
    marginBottom: spacing[2],
    fontWeight: String(fontWeight.medium) as '500',
  },
  linkInfoSubtext: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
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
  buttonDisabled: {
    opacity: 0.6,
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
})
