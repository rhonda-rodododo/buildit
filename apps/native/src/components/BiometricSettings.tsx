/**
 * Biometric Settings Component
 *
 * Allows users to enable/disable biometric authentication (Face ID, Touch ID, etc.)
 * Includes important legal warnings about biometric vs password protection.
 */

import { useState } from 'react'
import { View, Text, Switch, StyleSheet, Alert, Platform, Pressable, Linking } from 'react-native'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useAuthStore } from '../stores/authStore'

/**
 * Legal information about biometric compulsion by country/region
 */
const LEGAL_INFO = {
  fiveEyes: [
    { country: 'United States', canCompelBiometric: true, canCompelPassword: 'disputed' },
    { country: 'United Kingdom', canCompelBiometric: true, canCompelPassword: true },
    { country: 'Canada', canCompelBiometric: true, canCompelPassword: 'disputed' },
    { country: 'Australia', canCompelBiometric: true, canCompelPassword: true },
    { country: 'New Zealand', canCompelBiometric: true, canCompelPassword: true },
  ],
  resources: [
    {
      title: 'EFF: Digital Privacy at the U.S. Border',
      url: 'https://www.eff.org/wp/digital-privacy-us-border-2017',
    },
    {
      title: 'ACLU: Know Your Rights at the Border',
      url: 'https://www.aclu.org/know-your-rights/what-do-when-encountering-law-enforcement-airports-and-other-ports-entry-us',
    },
    {
      title: 'EFF: Device Searches at Borders',
      url: 'https://www.eff.org/issues/border-searches',
    },
    {
      title: 'UK GOV: Police Powers to Access Data',
      url: 'https://www.gov.uk/stopped-by-police-for-terrorism',
    },
    {
      title: 'Access Now: Digital Security for Travelers',
      url: 'https://www.accessnow.org/digital-security/',
    },
  ],
}

export function BiometricSettings() {
  const biometricStatus = useAuthStore((s) => s.biometricStatus)
  const enableBiometric = useAuthStore((s) => s.enableBiometric)
  const disableBiometric = useAuthStore((s) => s.disableBiometric)
  const getBiometricName = useAuthStore((s) => s.getBiometricTypeName)
  const [isToggling, setIsToggling] = useState(false)
  const [showLegalInfo, setShowLegalInfo] = useState(false)

  if (!biometricStatus?.isAvailable) {
    return null
  }

  const biometricName = getBiometricName()

  const handleToggle = async (newValue: boolean) => {
    if (isToggling) return
    setIsToggling(true)

    try {
      if (newValue) {
        const success = await enableBiometric()
        if (!success) {
          Alert.alert(
            'Unable to Enable',
            `Could not enable ${biometricName}. Please ensure you have ${biometricName} set up on your device.`
          )
        }
      } else {
        Alert.alert(
          `Disable ${biometricName}?`,
          `You will need to use your password to unlock the app.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await disableBiometric()
              },
            },
          ]
        )
      }
    } finally {
      setIsToggling(false)
    }
  }

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open URL:', err)
      Alert.alert('Error', 'Could not open the link')
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{biometricName}</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'ios'
              ? `Use ${biometricName} to quickly unlock the app`
              : 'Use biometric authentication to quickly unlock'}
          </Text>
        </View>
        <Switch
          value={biometricStatus.isEnabled}
          onValueChange={handleToggle}
          disabled={isToggling}
          trackColor={{ false: '#d4d4d4', true: '#22c55e' }}
          thumbColor={biometricStatus.isEnabled ? '#ffffff' : '#fafafa'}
          ios_backgroundColor="#d4d4d4"
        />
      </View>

      {biometricStatus.isEnabled && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {biometricName} is enabled. Your identity will be protected by your
            device's biometric security.
          </Text>
        </View>
      )}

      {biometricStatus.securityLevel === 'low' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Your device's biometric security level is low. For better security,
            consider using a passcode instead.
          </Text>
        </View>
      )}

      {/* Legal Warning Banner */}
      <Pressable
        style={styles.legalBanner}
        onPress={() => setShowLegalInfo(!showLegalInfo)}
      >
        <Text style={styles.legalBannerIcon}>⚠️</Text>
        <View style={styles.legalBannerText}>
          <Text style={styles.legalBannerTitle}>
            Important: Legal Considerations for Travelers
          </Text>
          <Text style={styles.legalBannerSubtitle}>
            Tap to {showLegalInfo ? 'hide' : 'learn about'} biometric vs password protection
          </Text>
        </View>
        <Text style={styles.legalBannerArrow}>{showLegalInfo ? '▼' : '▶'}</Text>
      </Pressable>

      {showLegalInfo && (
        <View style={styles.legalContent}>
          {/* Key Warning */}
          <View style={styles.criticalWarning}>
            <Text style={styles.criticalWarningTitle}>
              🚨 Critical Security Information
            </Text>
            <Text style={styles.criticalWarningText}>
              In many countries, authorities can legally compel you to unlock your device
              using biometrics (fingerprint, face), but passwords may have stronger legal
              protection. This varies by jurisdiction.
            </Text>
          </View>

          {/* Five Eyes Section */}
          <View style={styles.legalSection}>
            <Text style={styles.legalSectionTitle}>
              Five Eyes Countries (US, UK, CA, AU, NZ)
            </Text>

            <View style={styles.comparisonTable}>
              <View style={styles.comparisonHeader}>
                <Text style={[styles.comparisonCell, styles.comparisonHeaderText]}>Country</Text>
                <Text style={[styles.comparisonCell, styles.comparisonHeaderText]}>Biometric</Text>
                <Text style={[styles.comparisonCell, styles.comparisonHeaderText]}>Password</Text>
              </View>
              {LEGAL_INFO.fiveEyes.map((item) => (
                <View key={item.country} style={styles.comparisonRow}>
                  <Text style={styles.comparisonCell}>{item.country}</Text>
                  <Text style={[styles.comparisonCell, styles.canCompel]}>
                    {item.canCompelBiometric ? '⚠️ Can compel' : '✓ Protected'}
                  </Text>
                  <Text style={[
                    styles.comparisonCell,
                    item.canCompelPassword === true ? styles.canCompel :
                    item.canCompelPassword === 'disputed' ? styles.disputed : styles.protected
                  ]}>
                    {item.canCompelPassword === true ? '⚠️ Can compel' :
                     item.canCompelPassword === 'disputed' ? '⚖️ Disputed' : '✓ Protected'}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.legalNote}>
              <Text style={styles.bold}>United States:</Text> Courts have ruled that biometrics
              (fingerprints, Face ID) can be compelled as they are considered physical evidence,
              not "testimony." Password protection under the 5th Amendment is disputed but generally
              stronger. At borders, broader search powers apply.
            </Text>

            <Text style={styles.legalNote}>
              <Text style={styles.bold}>United Kingdom:</Text> Under RIPA (Regulation of Investigatory
              Powers Act 2000), refusing to provide encryption keys or passwords can result in up to
              5 years imprisonment. Both biometrics and passwords can be compelled.
            </Text>

            <Text style={styles.legalNote}>
              <Text style={styles.bold}>Australia:</Text> The Assistance and Access Act 2018 allows
              authorities to compel access to encrypted data. Penalties for non-compliance can include
              imprisonment.
            </Text>
          </View>

          {/* Travel Warnings */}
          <View style={styles.legalSection}>
            <Text style={styles.legalSectionTitle}>🛫 Travel Considerations</Text>

            <View style={styles.travelWarning}>
              <Text style={styles.travelWarningTitle}>Before Traveling:</Text>
              <Text style={styles.travelWarningItem}>
                • Consider disabling biometric unlock before crossing borders
              </Text>
              <Text style={styles.travelWarningItem}>
                • Use a strong password you can memorize but won't reveal
              </Text>
              <Text style={styles.travelWarningItem}>
                • Know your rights in both your departure and destination countries
              </Text>
              <Text style={styles.travelWarningItem}>
                • Consider traveling with a "clean" device and restoring from backup after arrival
              </Text>
              <Text style={styles.travelWarningItem}>
                • Back up your data before travel in case your device is seized
              </Text>
            </View>

            <View style={styles.travelWarning}>
              <Text style={styles.travelWarningTitle}>At Borders:</Text>
              <Text style={styles.travelWarningItem}>
                • Border agents in most countries have broader search powers than regular police
              </Text>
              <Text style={styles.travelWarningItem}>
                • Refusing to unlock may result in device seizure, detention, or denied entry
              </Text>
              <Text style={styles.travelWarningItem}>
                • Non-citizens generally have fewer protections than citizens
              </Text>
              <Text style={styles.travelWarningItem}>
                • Document any searches and contact a lawyer if detained
              </Text>
            </View>
          </View>

          {/* Recommendation */}
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationTitle}>💡 Recommendation</Text>
            <Text style={styles.recommendationText}>
              For maximum legal protection while traveling, especially through Five Eyes countries
              or authoritarian states, consider:
            </Text>
            <Text style={styles.recommendationItem}>
              1. Disable biometric unlock before travel
            </Text>
            <Text style={styles.recommendationItem}>
              2. Use a strong, memorized password
            </Text>
            <Text style={styles.recommendationItem}>
              3. Power off your device completely (not just lock it) when crossing borders,
              as this requires a password to unlock on most devices
            </Text>
          </View>

          {/* Resources */}
          <View style={styles.legalSection}>
            <Text style={styles.legalSectionTitle}>📚 Learn More</Text>
            <Text style={styles.resourcesIntro}>
              These resources provide detailed information about your digital rights:
            </Text>
            {LEGAL_INFO.resources.map((resource) => (
              <Pressable
                key={resource.url}
                style={styles.resourceLink}
                onPress={() => openLink(resource.url)}
              >
                <Text style={styles.resourceLinkText}>{resource.title}</Text>
                <Text style={styles.resourceLinkArrow}>→</Text>
              </Pressable>
            ))}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.bold}>Disclaimer:</Text> This information is for educational
              purposes only and should not be considered legal advice. Laws change frequently
              and vary by jurisdiction. Consult a qualified attorney for advice specific to
              your situation. Last updated: January 2026.
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing[4],
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  infoBox: {
    marginTop: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  infoText: {
    fontSize: fontSize.xs,
    color: '#166534',
    lineHeight: 18,
  },
  warningBox: {
    marginTop: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    fontSize: fontSize.xs,
    color: '#92400e',
    lineHeight: 18,
  },
  // Legal banner styles
  legalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[4],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  legalBannerIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  legalBannerText: {
    flex: 1,
  },
  legalBannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#92400e',
  },
  legalBannerSubtitle: {
    fontSize: fontSize.xs,
    color: '#b45309',
    marginTop: 2,
  },
  legalBannerArrow: {
    fontSize: fontSize.sm,
    color: '#92400e',
    marginLeft: spacing[2],
  },
  // Legal content styles
  legalContent: {
    marginTop: spacing[3],
    marginHorizontal: spacing[4],
  },
  criticalWarning: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: spacing[4],
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    marginBottom: spacing[4],
  },
  criticalWarningTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#991b1b',
    marginBottom: spacing[2],
  },
  criticalWarningText: {
    fontSize: fontSize.sm,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  legalSection: {
    marginBottom: spacing[4],
  },
  legalSectionTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[3],
  },
  // Comparison table
  comparisonTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  comparisonHeaderText: {
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#525252',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  comparisonCell: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    fontSize: fontSize.xs,
    color: '#0a0a0a',
  },
  canCompel: {
    color: '#dc2626',
  },
  disputed: {
    color: '#d97706',
  },
  protected: {
    color: '#16a34a',
  },
  legalNote: {
    fontSize: fontSize.xs,
    color: '#525252',
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  bold: {
    fontWeight: String(fontWeight.semibold) as '600',
  },
  // Travel warnings
  travelWarning: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  travelWarningTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  travelWarningItem: {
    fontSize: fontSize.xs,
    color: '#525252',
    lineHeight: 18,
    marginBottom: spacing[1],
  },
  // Recommendation box
  recommendationBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: spacing[4],
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    marginBottom: spacing[4],
  },
  recommendationTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#1e40af',
    marginBottom: spacing[2],
  },
  recommendationText: {
    fontSize: fontSize.xs,
    color: '#1e3a8a',
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  recommendationItem: {
    fontSize: fontSize.xs,
    color: '#1e3a8a',
    lineHeight: 18,
    marginLeft: spacing[2],
    marginBottom: spacing[1],
  },
  // Resources
  resourcesIntro: {
    fontSize: fontSize.xs,
    color: '#525252',
    marginBottom: spacing[2],
  },
  resourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  resourceLinkText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#2563eb',
  },
  resourceLinkArrow: {
    fontSize: fontSize.base,
    color: '#2563eb',
    marginLeft: spacing[2],
  },
  // Disclaimer
  disclaimer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  disclaimerText: {
    fontSize: fontSize.xs,
    color: '#737373',
    lineHeight: 16,
  },
})
