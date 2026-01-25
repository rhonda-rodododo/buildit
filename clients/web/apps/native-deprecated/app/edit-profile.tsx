/**
 * Edit Profile Screen
 *
 * Allows users to update their display name and other profile settings.
 */

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../src/utils/platform'

export default function EditProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity, updateProfile } = useAuthStore()

  const [displayName, setDisplayName] = useState(identity?.displayName || '')
  const [about, setAbout] = useState(identity?.about || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      await haptics.error()
      Alert.alert('Error', 'Display name is required')
      return
    }

    setIsSaving(true)
    await haptics.light()

    try {
      await updateProfile({
        displayName: displayName.trim(),
        about: about.trim() || undefined,
      })

      await haptics.success()
      router.back()
    } catch (error) {
      await haptics.error()
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }, [displayName, about, updateProfile, router])

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Not logged in</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerBackTitle: 'Settings',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Avatar Preview */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName[0]?.toUpperCase() || identity.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.avatarHint}>
            Avatar is generated from your display name
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your display name"
              placeholderTextColor="#a3a3a3"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Text style={styles.charCount}>{displayName.length}/50</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>About</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell others about yourself"
              placeholderTextColor="#a3a3a3"
              value={about}
              onChangeText={setAbout}
              maxLength={200}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{about.length}/200</Text>
          </View>

          {/* Public Key (read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Public Key</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText} numberOfLines={1}>
                {identity.publicKey}
              </Text>
            </View>
            <Text style={styles.hint}>
              Your public key is your unique identifier on the Nostr network
            </Text>
          </View>
        </View>
      </View>
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  cancelButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  cancelButtonText: {
    fontSize: fontSize.base,
    color: '#737373',
  },
  saveButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  saveButtonText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatarText: {
    fontSize: 40,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#ffffff',
  },
  avatarHint: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
  },
  form: {
    gap: spacing[5],
  },
  inputGroup: {
    gap: spacing[2],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing[3],
  },
  charCount: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    textAlign: 'right',
  },
  readOnlyInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  readOnlyText: {
    fontSize: fontSize.sm,
    color: '#737373',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
  },
  errorText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
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
