// BuildIt i18n Codegen
// Generates iOS and Android localization files from web i18n sources

import * as path from 'path';
import { loadAllTranslations, validateTranslations } from './merger';
import { generateAndroidStrings } from './generators/android';
import { generateIOSStrings } from './generators/ios';
import { writeSwiftAccessors } from './generators/swift';

// Paths relative to repo root
const REPO_ROOT = path.resolve(import.meta.dir, '../../..');
const WEB_ROOT = path.join(REPO_ROOT, 'clients/web');
const ANDROID_RES = path.join(REPO_ROOT, 'clients/android/app/src/main/res');
const IOS_RESOURCES = path.join(REPO_ROOT, 'clients/ios/BuildIt/Resources');
const IOS_L10N_PATH = path.join(REPO_ROOT, 'clients/ios/BuildIt/Sources/Core/Localization/L10n.swift');

interface CliOptions {
  validate: boolean;
  verbose: boolean;
  android: boolean;
  ios: boolean;
  swift: boolean;
  watch: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  return {
    validate: args.includes('--validate'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    android: !args.includes('--no-android'),
    ios: !args.includes('--no-ios'),
    swift: !args.includes('--no-swift'),
    watch: args.includes('--watch'),
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     BuildIt i18n Codegen v1.0.0       ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // Load all translations
  console.log('📚 Loading translations...');
  console.log('');

  const allTranslations = await loadAllTranslations({
    webRoot: WEB_ROOT,
    verbose: options.verbose,
  });

  console.log('');

  // Summary
  let totalKeys = 0;
  for (const [locale, translations] of allTranslations) {
    const count = translations.size;
    if (count > 0) {
      totalKeys = Math.max(totalKeys, count);
      if (options.verbose) {
        console.log(`  ${locale}: ${count} keys`);
      }
    }
  }
  console.log(`📊 Total: ${totalKeys} unique keys across ${allTranslations.size} locales`);
  console.log('');

  // Validate
  console.log('🔍 Validating translations...');
  const validation = validateTranslations(allTranslations, 'en');

  if (validation.errors.length > 0) {
    console.log('');
    console.log('❌ Errors:');
    for (const error of validation.errors.slice(0, 10)) {
      console.log(`   ${error.key} [${error.locale}]: ${error.message}`);
    }
    if (validation.errors.length > 10) {
      console.log(`   ... and ${validation.errors.length - 10} more errors`);
    }
  }

  if (validation.warnings.length > 0 && options.verbose) {
    console.log('');
    console.log('⚠️  Warnings:');
    const warningsByLocale = new Map<string, number>();
    for (const warning of validation.warnings) {
      const count = warningsByLocale.get(warning.locale) || 0;
      warningsByLocale.set(warning.locale, count + 1);
    }
    for (const [locale, count] of warningsByLocale) {
      console.log(`   ${locale}: ${count} missing translations`);
    }
  }

  console.log('');

  if (options.validate) {
    // Validate-only mode
    if (!validation.valid) {
      console.log('❌ Validation failed');
      process.exit(1);
    }
    console.log('✅ Validation passed');
    return;
  }

  // Generate outputs
  console.log('🔧 Generating platform files...');
  console.log('');

  // Android
  if (options.android) {
    console.log('📱 Android:');
    await generateAndroidStrings(allTranslations, {
      outputDir: ANDROID_RES,
      generatePlurals: true,
    });
    console.log('');
  }

  // iOS
  if (options.ios) {
    console.log('🍎 iOS:');
    await generateIOSStrings(allTranslations, {
      outputDir: IOS_RESOURCES,
      generatePlurals: true,
    });
    console.log('');
  }

  // Swift accessors
  if (options.swift) {
    console.log('🦅 Swift:');
    const enTranslations = allTranslations.get('en');
    if (enTranslations) {
      await writeSwiftAccessors(enTranslations, {
        outputPath: IOS_L10N_PATH,
        enumName: 'L10n',
      });
    }
    console.log('');
  }

  console.log('✅ Done!');
  console.log('');
}

// Run
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
