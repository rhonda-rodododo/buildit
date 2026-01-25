/**
 * Login Screen - Create New Identity
 *
 * Generates a new Nostr keypair with recovery phrase backup flow.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ScrollView } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

type Step = 'name' | 'backup' | 'confirm'

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { createIdentity, isLoading } = useAuthStore()

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [confirmWord, setConfirmWord] = useState('')
  const [wordIndex, setWordIndex] = useState(0)

  const handleCreateIdentity = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a display name')
      return
    }

    try {
      const result = await createIdentity(name.trim())
      setRecoveryPhrase(result.recoveryPhrase)
      // Select a random word index (1-12) for confirmation
      setWordIndex(Math.floor(Math.random() * 12) + 1)
      setStep('backup')
    } catch (error) {
      Alert.alert('Error', 'Failed to create identity')
    }
  }

  const handleConfirmBackup = () => {
    const words = recoveryPhrase.split(' ')
    const expectedWord = words[wordIndex - 1]

    if (confirmWord.toLowerCase().trim() !== expectedWord.toLowerCase()) {
      Alert.alert(
        'Incorrect Word',
        `Please enter word #${wordIndex} from your recovery phrase.`
      )
      return
    }

    // Success - navigate to home
    Alert.alert(
      'Identity Created!',
      'Your identity has been created and your recovery phrase has been saved securely.',
      [{ text: 'Continue', onPress: () => router.push('/') }]
    )
  }

  const handleSkipBackup = () => {
    Alert.alert(
      'Skip Backup?',
      'Without backing up your recovery phrase, you may lose access to your identity forever if you lose this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip Anyway',
          style: 'destructive',
          onPress: () => router.push('/'),
        },
      ]
    )
  }

  // Step 1: Enter name
  if (step === 'name') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Identity</Text>
          <Text style={styles.subtitle}>
            Generate a new Nostr keypair for secure, decentralized communication.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#a3a3a3"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateIdentity}
            />
          </View>

          <Pressable
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreateIdentity}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Creating...' : 'Create Identity'}
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

  // Step 2: Show recovery phrase
  if (step === 'backup') {
    const words = recoveryPhrase.split(' ')

    return (
      <ScrollView
        style={[styles.scrollContainer, { paddingTop: insets.top }]}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Backup Recovery Phrase</Text>
        <Text style={styles.subtitle}>
          Write down these 12 words in order. This is the ONLY way to recover your identity.
        </Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Never share your recovery phrase with anyone. Anyone with these words can access your identity.
          </Text>
        </View>

        <View style={styles.phraseGrid}>
          {words.map((word, index) => (
            <View key={index} style={styles.wordBox}>
              <Text style={styles.wordNumber}>{index + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => setStep('confirm')}
        >
          <Text style={styles.primaryButtonText}>I've Saved These Words</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={handleSkipBackup}>
          <Text style={[styles.linkText, styles.dangerText]}>Skip for Now</Text>
        </Pressable>
      </ScrollView>
    )
  }

  // Step 3: Confirm backup
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Confirm Backup</Text>
        <Text style={styles.subtitle}>
          Enter word #{wordIndex} from your recovery phrase to confirm you've saved it.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Word #{wordIndex}</Text>
          <TextInput
            style={styles.input}
            value={confirmWord}
            onChangeText={setConfirmWord}
            placeholder={`Enter word #${wordIndex}`}
            placeholderTextColor="#a3a3a3"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirmBackup}
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={handleConfirmBackup}>
          <Text style={styles.primaryButtonText}>Confirm</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => setStep('backup')}>
          <Text style={styles.linkText}>Show Recovery Phrase Again</Text>
        </Pressable>
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
  scrollContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: spacing[6],
    alignItems: 'center',
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
    marginBottom: spacing[6],
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
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
  primaryButton: {
    width: '100%',
    maxWidth: 400,
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
  dangerText: {
    color: '#dc2626',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[6],
    width: '100%',
    maxWidth: 400,
  },
  warningText: {
    fontSize: fontSize.sm,
    color: '#92400e',
    textAlign: 'center',
  },
  phraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[8],
    width: '100%',
    maxWidth: 400,
  },
  wordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    minWidth: 100,
  },
  wordNumber: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginRight: spacing[2],
    width: 16,
  },
  wordText: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
})
