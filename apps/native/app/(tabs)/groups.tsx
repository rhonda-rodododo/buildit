/**
 * Groups Tab - Organizations List
 *
 * Shows list of groups the user belongs to and allows creating new groups.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native'
import { useRouter } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

interface GroupItem {
  id: string
  name: string
  description?: string
  memberCount: number
  lastActivity: number
  unreadCount: number
  role: 'admin' | 'moderator' | 'member'
}

// Placeholder data - will be replaced with real data from group store
const PLACEHOLDER_GROUPS: GroupItem[] = []

function formatTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function getRoleBadge(role: GroupItem['role']) {
  switch (role) {
    case 'admin':
      return { label: 'Admin', color: '#7c3aed' }
    case 'moderator':
      return { label: 'Mod', color: '#2563eb' }
    default:
      return null
  }
}

export default function GroupsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredGroups = PLACEHOLDER_GROUPS.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderGroup = ({ item }: { item: GroupItem }) => {
    const roleBadge = getRoleBadge(item.role)

    return (
      <Pressable
        style={styles.groupItem}
        onPress={() => {
          // TODO: Navigate to group detail
          // router.push(`/group/${item.id}`)
        }}
      >
        <View style={styles.groupIcon}>
          <Text style={styles.groupIconText}>{item.name[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.groupContent}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
            </Text>
            {roleBadge && (
              <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
                <Text style={styles.roleBadgeText}>{roleBadge.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description || `${item.memberCount} members`}
          </Text>
          <View style={styles.groupFooter}>
            <Text style={styles.groupMeta}>
              {item.memberCount} members • {formatTime(item.lastActivity)}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    )
  }

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyTitle}>Not Logged In</Text>
        <Text style={styles.emptySubtitle}>
          Please create or import an identity to view groups.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <Pressable style={styles.newButton}>
          <Text style={styles.newButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor="#a3a3a3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Groups List */}
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group or join one to start organizing together
            </Text>
            <Pressable style={styles.createButton}>
              <Text style={styles.createButtonText}>Create Your First Group</Text>
            </Pressable>
          </View>
        }
      />
    </View>
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
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
  },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: fontSize.lg,
    color: '#ffffff',
  },
  searchContainer: {
    padding: spacing[4],
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  listContent: {
    paddingBottom: spacing[6],
    flexGrow: 1,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  groupIconText: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#737373',
  },
  groupContent: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  groupName: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing[2],
  },
  roleBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#ffffff',
  },
  groupDescription: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginBottom: spacing[1],
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupMeta: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
  },
  unreadBadge: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: fontSize.xs,
    color: '#ffffff',
    fontWeight: String(fontWeight.semibold) as '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[16],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  createButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
    marginTop: spacing[4],
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
})
