/**
 * Create Group Screen
 *
 * Allows users to create a new group with name, description, and privacy settings.
 */

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGroupsStore, useAuthStore } from '../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../src/utils/platform'

type PrivacyLevel = 'public' | 'private' | 'secret'

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; description: string }[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can find and join this group',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Visible in search, but requires approval to join',
  },
  {
    value: 'secret',
    label: 'Secret',
    description: 'Only members can see this group exists',
  },
]

export default function CreateGroupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const { createGroup } = useGroupsStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<PrivacyLevel>('private')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      await haptics.error()
      Alert.alert('Error', 'Group name is required')
      return
    }

    if (name.trim().length < 3) {
      await haptics.error()
      Alert.alert('Error', 'Group name must be at least 3 characters')
      return
    }

    setIsCreating(true)
    await haptics.light()

    try {
      if (!identity?.privateKey) {
        throw new Error('No private key available')
      }

      await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy,
        privateKey: identity.privateKey,
      })

      await haptics.success()
      Alert.alert('Success', 'Group created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      await haptics.error()
      Alert.alert('Error', 'Failed to create group. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }, [name, description, privacy, createGroup, router])

  const handlePrivacySelect = async (value: PrivacyLevel) => {
    await haptics.selection()
    setPrivacy(value)
  }

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
          title: 'Create Group',
          headerBackTitle: 'Cancel',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create Group</Text>
        <Pressable
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group Icon Preview */}
        <View style={styles.iconSection}>
          <View style={styles.groupIcon}>
            <Text style={styles.groupIconText}>
              {name[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.iconHint}>
            Icon is generated from group name
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Group Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name"
              placeholderTextColor="#a3a3a3"
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Text style={styles.charCount}>{name.length}/50</Text>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What is this group about?"
              placeholderTextColor="#a3a3a3"
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {/* Privacy */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyOptions}>
              {PRIVACY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.privacyOption,
                    privacy === option.value && styles.privacyOptionSelected,
                  ]}
                  onPress={() => handlePrivacySelect(option.value)}
                >
                  <View style={styles.privacyOptionHeader}>
                    <View
                      style={[
                        styles.privacyRadio,
                        privacy === option.value && styles.privacyRadioSelected,
                      ]}
                    >
                      {privacy === option.value && <View style={styles.privacyRadioDot} />}
                    </View>
                    <Text
                      style={[
                        styles.privacyLabel,
                        privacy === option.value && styles.privacyLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <Text style={styles.privacyDescription}>{option.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>About Groups</Text>
          <Text style={styles.infoText}>
            Groups use end-to-end encryption to protect your conversations. Only members
            can read messages. As the creator, you'll be the group admin.
          </Text>
        </View>
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
  createButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  createButtonText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  iconSection: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  groupIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  groupIconText: {
    fontSize: 36,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#ffffff',
  },
  iconHint: {
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
  privacyOptions: {
    gap: spacing[2],
  },
  privacyOption: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  privacyOptionSelected: {
    borderColor: '#0a0a0a',
    backgroundColor: '#fafafa',
  },
  privacyOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  privacyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d4d4d4',
    marginRight: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyRadioSelected: {
    borderColor: '#0a0a0a',
  },
  privacyRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0a0a0a',
  },
  privacyLabel: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  privacyLabelSelected: {
    fontWeight: String(fontWeight.semibold) as '600',
  },
  privacyDescription: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginLeft: 32,
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: spacing[4],
    marginTop: spacing[6],
  },
  infoTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0369a1',
    marginBottom: spacing[2],
  },
  infoText: {
    fontSize: fontSize.sm,
    color: '#0c4a6e',
    lineHeight: 20,
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
