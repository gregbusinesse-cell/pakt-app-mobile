# Android Build Fixes for PAKT App

## Summary
Fixed multiple Android Gradle configuration issues preventing local and EAS builds. The app is now configured with proper SDK versions and build settings.

## Fixed Issues

### 1. Missing SDK Path (local.properties)
**Problem**: Android SDK location not configured
**Fix**: Created `android/local.properties` with:
```
sdk.dir=C:\Users\gregd\AppData\Local\Android\Sdk
```

### 2. MinSdkVersion Conflicts
**Problem**: Different modules had conflicting minSdkVersion requirements
**Fix**: Set explicit minSdkVersion in:
- Root `build.gradle`: ext.minSdkVersion = 22
- App `build.gradle`: minSdkVersion 22 and minSdk 22

### 3. Kotlin Compose Plugin Missing
**Problem**: Gradle error: "Could not find org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:1.9.25"
**Fix**: Removed expo-dev-client package which was causing this issue

### 4. React Native Architecture
**Problem**: New Architecture (Fabric) CMake configuration issues
**Fix**: Disabled newArchEnabled in gradle.properties:
```properties
newArchEnabled=false
```

### 5. AndroidX Configuration
**Fix**: Added to gradle.properties:
```properties
android.useAndroidX=true
android.enableJetifier=true
```

## Current Configuration Files

### android/build.gradle
- Sets rootProject.ext with SDK versions
- minSdkVersion: 22
- compileSdkVersion: 35
- targetSdkVersion: 34
- ndkVersion: 26.1.10909125

### android/app/build.gradle
- App minSdkVersion: 22
- Uses rootProject.ext for compilation settings
- Proper default config setup

### android/gradle.properties
- Hermes JS engine: true (was false, reverted)
- AndroidX support enabled
- Jetifier enabled
- New architecture disabled
- Edge-to-edge display enabled

### eas.json
- Development profile: APK builds for internal distribution
- Preview profile: APK builds for internal distribution  
- Production profile: App bundle builds

## Remaining Known Issues

### Prefab/CMake MinSdkVersion Validation
**Status**: Partially resolved
**Details**: CMake validation during react-native-screens and expo-modules-core build was expecting minSdkVersion >= 24 for hermestooling library, even though all configuration was set to 22.
**Workaround**: Disabled newArchEnabled to avoid Fabric/CMake builds that trigger this validation.

## Build Commands

### Local Gradle Build
```bash
cd android
./gradlew assembleDebug  # or assembleRelease
```

### EAS Build
```bash
eas build --platform android --profile preview
```

## Testing Status
- Local gradle builds: Issue with CMake Prefab validation (minSdkVersion 22 vs 24 mismatch)
- EAS Builds: Multiple builds attempted, "Gradle build failed with unknown error"
- Next step: Check EAS build logs for detailed error information

## Dependencies
- React Native: 0.76.3
- Expo SDK: 54.0.0
- Gradle: 8.14.3
- Android Gradle Plugin: 8.6.0
- Kotlin: 1.9.25
- Android NDK: 26.1.10909125
