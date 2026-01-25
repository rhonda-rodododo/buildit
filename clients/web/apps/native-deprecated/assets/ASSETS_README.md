# BuildIt Network App Assets

This directory contains the app icons and splash screens for iOS and Android.

## Required Assets

Before building for production, replace these placeholder files with your actual assets:

### icon.png
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Used as the main app icon

### adaptive-icon.png (Android)
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Should be sized to fit within the safe zone (circle mask will be applied)

### splash.png
- Size: 1284x2778 pixels (iPhone 13 Pro Max)
- Format: PNG
- Center your logo, background will extend to edges

### favicon.png (Web)
- Size: 196x196 pixels
- Format: PNG with transparency

## Generating Assets

You can use Expo's asset generator:
```bash
npx expo-optimize
```

Or tools like:
- Figma with export plugins
- ImageMagick for resizing
- https://appicon.co for generating all sizes

## Current Placeholders

The current files are simple placeholders. Replace them before submitting to app stores.
