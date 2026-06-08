# Troubleshooting Guide: iOS Build fmt Error

## Quick Diagnosis

Before applying fixes, let's identify what you're dealing with.

### 1. Confirm the Error

Run:
```bash
cd pakt-app-mobile
npm run ios
# or
eas build --platform ios
```

Look for this exact error:
```
call to consteval function 'fmt::basic_format_string<char, ...>::basic_format_string<FMT_COMPILE_STRING, 0>' 
is not a constant expression
```

**If you see this**: You have the right issue. Follow the solutions below.

**If you see something different**: The error might be unrelated. Note the exact message.

---

## Step-by-Step Troubleshooting

### STEP 1: Check Current Versions

```bash
npm list react-native react expo
```

Expected output:
```
├── expo@52.0.0
├── react@18.3.1
├── react-native@0.76.3  <-- THIS IS YOUR PROBLEM
```

**If you see react-native >= 0.76.4**: The version should be fixed, but check Step 2.

### STEP 2: Check Xcode Version

```bash
xcode-select --print-path
# Should show: /Applications/Xcode.app/Contents/Developer

clang --version
# Should show: Apple clang version 16.x.x (or Apple LLVM version 15.x.x)
```

**Xcode 16.x** + **RN 0.76.3** = Confirmed problematic combination

### STEP 3: Check Node/npm Versions

```bash
node --version   # Should be >= 18.0.0
npm --version    # Should be >= 8.0.0
```

If outdated, update:
```bash
# macOS with Homebrew
brew upgrade node
```

---

## Solution Path Decision Tree

### Decision 1: Time Availability?

```
├─ I have 5-10 minutes
│  └─ Follow SOLUTION #1 (Upgrade React Native)
│
└─ I need a fix in < 1 minute
   └─ Follow SOLUTION #3 (Disable Hermes)
      └─ Then apply SOLUTION #1 later
```

### Decision 2: Accept Performance Loss?

```
├─ No, performance is important
│  └─ Don't use Solution #3 (JSC is slower)
│  └─ Use Solution #1 (Upgrade RN)
│
└─ Temporary workaround is fine
   └─ Solution #3 is acceptable short-term
```

### Decision 3: Stay on Expo 52?

```
├─ Yes, need Expo 52 features
│  └─ Must use Solution #1 (RN upgrade)
│
└─ Can downgrade to Expo 51
   └─ Solution #2 is viable
```

---

## SOLUTION #1: Upgrade React Native (RECOMMENDED)

### Prerequisites
- 5-10 minutes
- npm or yarn installed
- Terminal/command line access

### Step-by-Step

#### 1. Backup your current state
```bash
cd pakt-app-mobile
git status
# Make sure nothing important is uncommitted
# Or create a backup of package-lock.json
```

#### 2. Upgrade React Native
```bash
npm install react-native@0.76.5
```

#### 3. Verify installation
```bash
npm list react-native
# Should show: react-native@0.76.5
```

#### 4. Clear CocoaPods cache
```bash
cd ios
rm -rf Pods
rm Podfile.lock
cd ..
```

#### 5. Reinstall dependencies
```bash
npm install
# or
npm ci  # For reproducible installs
```

#### 6. Rebuild iOS project
```bash
# Option A: Using EAS Build
eas build --platform ios --clean

# Option B: Local build (if you have Xcode setup)
npm run ios

# Option C: Using Expo CLI
expo prebuild --clean
npm run ios
```

#### 7. Verify success
After build completes:
- ✓ Build should succeed (no fmt errors)
- ✓ App should launch
- ✓ All features should work
- ✓ No performance issues

### Troubleshooting Step 1

**If build still fails**:

1. Check that Pods directory is actually removed:
   ```bash
   ls -la ios/Pods
   # Should NOT exist
   ```

2. Clear derived data:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```

3. Try again with clean cache:
   ```bash
   eas build --platform ios --no-cache --clean
   ```

### Troubleshooting Step 1B

**If npm list still shows 0.76.3**:

1. Delete package-lock.json:
   ```bash
   rm package-lock.json
   ```

2. Delete node_modules:
   ```bash
   rm -rf node_modules
   ```

3. Reinstall from scratch:
   ```bash
   npm install
   npm list react-native
   # Should now show 0.76.5 or higher
   ```

### Rollback (if needed)

If something breaks after upgrade:
```bash
npm install react-native@0.76.3
npm install
cd ios && rm -rf Pods Podfile.lock && cd ..
npm run ios
```

---

## SOLUTION #2: Downgrade to Expo 51

### When to use
- If Solution #1 doesn't work for some reason
- If you can afford losing Expo 52 features
- If you need maximum stability

### Steps

#### 1. Update package.json
```bash
npm install expo@51.0.14 react-native@0.75.1
```

#### 2. Update app.json
Check if there are Expo 52-specific settings:
```json
{
  "expo": {
    "sdkVersion": "51.0.0"
    // Remove any Expo 52-only settings if present
  }
}
```

#### 3. Clear iOS build artifacts
```bash
cd ios
rm -rf Pods
rm Podfile.lock
rm -rf build
cd ..
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

#### 4. Reinstall dependencies
```bash
npm install
npm run ios
```

#### 5. Verify
- Build should succeed
- App should work
- Functionality should be preserved

### Rollback
```bash
npm install expo@52.0.0 react-native@0.76.5
```

---

## SOLUTION #3: Disable Hermes (Temporary)

### When to use
- Need a quick fix immediately
- Don't care about 15-25% performance loss
- Only a temporary measure

### Steps

#### 1. Edit app.json
Add the jsEngine setting:

```json
{
  "expo": {
    "ios": {
      "jsEngine": "jsc"  // Add this line
    }
  }
}
```

#### 2. Clear and rebuild
```bash
cd ios
rm -rf Pods Podfile.lock
cd ..
eas build --platform ios --clean
```

#### 3. Verify
Build should succeed, but app runs slower.

### IMPORTANT: Still apply Solution #1

After confirming the workaround works:
1. Upgrade React Native (Solution #1)
2. Remove the jsEngine line
3. Rebuild to restore Hermes + performance

---

## SOLUTION #4: Clean Cache Only

### When to use
- Only if you've already upgraded RN
- Build still fails for some reason
- Pods cache might be corrupted

### Steps

```bash
# Complete cache clean
cd ios
rm -rf Pods
rm Podfile.lock
rm -rf build
cd ..

# Xcode cache
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# npm cache
npm cache clean --force

# Reinstall everything
npm ci  # Better than npm install
cd ios
pod install  # If you have CocoaPods
cd ..

# Rebuild
eas build --platform ios --clean --no-cache
```

---

## Comprehensive Diagnostic Checklist

Run this to gather info for debugging:

```bash
#!/bin/bash
echo "=== ENVIRONMENT INFO ==="
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "Xcode: $(xcode-select --print-path)"
echo "Clang: $(clang --version)"

echo -e "\n=== PROJECT INFO ==="
cd pakt-app-mobile
echo "React Native: $(npm list react-native | grep react-native | head -1)"
echo "Expo: $(npm list expo | grep expo | head -1)"

echo -e "\n=== DIRECTORY STATUS ==="
echo "Pods dir exists: $([ -d ios/Pods ] && echo 'YES - DELETE IT' || echo 'NO - OK')"
echo "Podfile.lock exists: $([ -f ios/Podfile.lock ] && echo 'YES - DELETE IT' || echo 'NO - OK')"
echo "node_modules: $([ -d node_modules ] && echo 'EXISTS' || echo 'MISSING')"

echo -e "\n=== PACKAGE.JSON INFO ==="
grep -A 3 '"react-native"\|"expo"' package.json
```

Run and save output for reference.

---

## Expected Timeline

### Solution #1 (Recommended)
- Version bump: 2 minutes
- Pod cleanup: 1 minute
- npm install: 2-3 minutes
- EAS build: 10-30 minutes (varies)
- **Total: 15-40 minutes**

### Solution #2 (Downgrade)
- Version bump: 2 minutes
- Pod cleanup: 1 minute
- npm install: 3-4 minutes
- EAS build: 10-30 minutes
- **Total: 20-45 minutes**

### Solution #3 (Workaround)
- Edit app.json: 30 seconds
- Pod cleanup: 1 minute
- EAS build: 10-30 minutes
- **Total: 11-32 minutes**

---

## Common Issues and Fixes

### Issue: "npm ERR! code ERESOLVE"

**Cause**: npm can't resolve dependencies

**Fix**:
```bash
npm install --legacy-peer-deps
# or
npm install --force
```

### Issue: "Pod install fails"

**Cause**: Corrupted CocoaPods cache

**Fix**:
```bash
cd ios
pod repo update
pod install --repo-update
cd ..
```

### Issue: "Xcode build fails with different error"

**Cause**: Unrelated iOS build issue

**Fix**:
```bash
# Check the exact error
# Make sure you're looking for fmt/consteval error
# If different, it's a separate issue
```

### Issue: "Still getting consteval error after upgrade"

**Cause**: Version change didn't take effect

**Fix**:
```bash
# Verify actual version:
npm list react-native

# If still 0.76.3:
rm -rf node_modules package-lock.json
npm install react-native@0.76.5
npm install

# Verify again:
npm list react-native  # Must show >= 0.76.4

# Then clean and rebuild:
cd ios && rm -rf Pods Podfile.lock && cd ..
eas build --platform ios --clean
```

### Issue: "Build succeeds but app crashes on launch"

**Cause**: Unrelated runtime error

**Check**:
1. Is this a clean build from scratch?
2. Are all pods properly installed?
3. Are there other compilation warnings?

**Fix**:
```bash
# Check for runtime errors
npm run ios
# Watch the console output

# If there are runtime errors, they're separate from the fmt issue
# Fix those in your code
```

---

## Verification Checklist

After applying any solution:

- [ ] npm list shows react-native >= 0.76.4 (or 0.75.x if downgraded)
- [ ] ios/Pods directory was deleted and not in git
- [ ] ios/Podfile.lock was deleted
- [ ] iOS build completed without errors
- [ ] No fmt or consteval errors in build log
- [ ] App launched on simulator/device
- [ ] App is responsive (not slow due to JSC)
- [ ] All features work (auth, location, etc.)
- [ ] No console errors

---

## When to Ask for Help

If none of these solutions work, gather:

1. **Exact error message** (copy from Xcode/EAS logs)
2. **Versions**:
   - `npm list react-native expo react`
   - `xcode-select --print-path`
   - `clang --version`
3. **What you've tried**:
   - Solution #1? #2? #3? #4?
   - What happened?
4. **Full build log**:
   - From EAS or local build
   - Especially the error section

---

## Prevention for Future Builds

To avoid this happening again:

### Recommended package.json strategy:

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",  // Pin to specific version
    // ... other deps
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### Regular maintenance:

1. **Monthly**: Check for new patch releases
   ```bash
   npm outdated
   ```

2. **After major updates**: Test on latest Xcode
   ```bash
   xcode-select --install  # or update via App Store
   ```

3. **Before production release**: Test build completely
   ```bash
   eas build --platform ios --clean
   expo publish  # or your release process
   ```

---

## Summary

| Situation | Solution | Time | Risk |
|-----------|----------|------|------|
| Normal build | #1: Upgrade RN | 20-40 min | None |
| Quick fix needed | #3: Disable Hermes | 15-30 min | Medium |
| Want stability | #2: Downgrade | 20-45 min | Low |
| Already upgraded? | #4: Clean cache | 5-20 min | None |

**Recommended**: Start with Solution #1. If it doesn't work, try #4. If still stuck, use #3 temporarily and refer to Deep Dive documentation.
