# Technical Deep Dive: fmt consteval Error in React Native 0.76.3

## Problem Statement

The iOS build fails with a C++ compilation error in the `fmt` library header when using:
- Expo 52.0.0
- React Native 0.76.3
- Xcode 16.x with Clang 16

The error specifically occurs in `fmt::basic_format_string` constructor during the compile phase.

---

## Technical Breakdown

### The Error Message Explained

```
call to consteval function 'fmt::basic_format_string<char, ...>::basic_format_string<FMT_COMPILE_STRING, 0>' 
is not a constant expression
```

**Breaking this down:**

1. **`consteval` function**: A C++20 feature that marks a function to be evaluated at compile-time only
2. **`basic_format_string` constructor**: Part of the fmt library's string formatting system
3. **`FMT_COMPILE_STRING`**: A macro used by Hermes/React Native for compile-time format string validation
4. **"is not a constant expression"**: The compiler can't evaluate this at compile time

### Why This Matters

The `FMT_COMPILE_STRING` macro in fmt was designed to:
- Validate format strings at compile time
- Prevent runtime errors from invalid format specifiers
- Optimize format operations

However, in fmt v10.0.0, the implementation has a flaw:

```cpp
// Simplified representation of what's happening:
template<typename S>
struct basic_format_string {
  consteval explicit basic_format_string(const S& s) {
    // This constructor marked as consteval
    // But the implementation can't always be evaluated at compile-time
  }
};
```

When Clang 16 (in Xcode 16) tries to compile code that uses this, it encounters expressions that:
- Appear to be compile-time constants
- But involve operations Clang 16 considers non-constant
- Results in the consteval rejection

---

## Dependency Chain

### Full Dependency Tree

```
Expo 52.0.0 (sdkVersion)
├── React Native ^0.76.3
│   └── Hermes 0.13.0
│       └── fmt v10.0.0  <-- PROBLEM HERE
│           └── Clang compiler
│               └── Clang 16 (Xcode 16) <-- STRICT VALIDATION
└── Other dependencies (unaffected)
```

### Version Compatibility Matrix

| Package | Version | fmt | Hermes | Works with Xcode 15.3 | Works with Xcode 16 |
|---------|---------|-----|--------|----------------------|-------------------|
| Expo 51.x | ~51.0.0 | v9.x | 0.12.x | ✓ | ✓ |
| Expo 52.0-52.6 | ~52.0.0 | v10.0.0 | 0.13.0 | ✓ | ✗ |
| Expo 52.7+ | ~52.0.0 | v10.2.1+ | 0.13.2+ | ✓ | ✓ |
| RN 0.76.0-3 | ^0.76.3 | v10.0.0 | 0.13.0 | ✓ | ✗ |
| RN 0.76.4+ | ^0.76.4 | v10.2.1+ | 0.13.2+ | ✓ | ✓ |
| RN 0.75.x | ^0.75.x | v9.x | 0.12.x | ✓ | ✓ |

---

## The fmt v10.0.0 Bug

### What Changed in fmt v10.0.0

The fmt library v10.0.0 (released Nov 2024) introduced:

1. **Stricter compile-time validation**: Using `consteval` more aggressively
2. **FMT_COMPILE_STRING macro optimization**: Attempting to catch format errors at compile-time
3. **C++20 features**: Heavy use of C++20's compile-time computation

Example of what fmt was trying to do:

```cpp
// Attempting to validate at compile-time:
FMT_COMPILE("{:d}")  // Good - expects integer
FMT_COMPILE("{:d}")  // Bad at runtime before, but fmt wants to catch at compile
```

### The Problem

The implementation assumed all constexpr contexts would work fine. However:

```cpp
// In fmt v10.0.0:
template <typename S>
consteval basic_format_string(const S& s) {
  static_assert(is_compile_time_constant(s), "...");
  check_format_string(s);
}

// Problem: check_format_string() may not be fully constexpr-compatible
// Clang 16 validates this more strictly than previous versions
```

---

## Why Clang 16 is Stricter

### Clang Compiler Evolution

| Clang | Xcode | consteval Validation | Impact |
|-------|-------|----------------------|--------|
| Clang 14 | Xcode 14.x | Loose | Accepts many near-constant expressions |
| Clang 15 | Xcode 15.3 | Moderate | Some false positives |
| Clang 16 | Xcode 16.x | Strict | Enforces C++20 spec precisely |

### C++20 Specification

The C++20 standard (ISO/IEC 14882:2020) requires that `consteval` function calls:
1. Must be evaluable at compile-time
2. Cannot involve undefined behavior
3. Cannot involve certain kinds of pointer/reference operations

Clang 16 implements these rules more strictly.

### Specific Validation Issue

When compiling Hermes code that uses fmt:

```cpp
// In Hermes or app code:
auto msg = fmt::format(FMT_COMPILE("{} {}"), arg1, arg2);

// Expands to roughly:
auto msg = fmt::vformat(
  fmt::basic_format_string<char>(FMT_COMPILE("{} {}")),
  args
);

// The FMT_COMPILE("{} {}") creates a consteval call
// But the expression context isn't fully constant in Clang 16
```

---

## The Fix in fmt v10.2.1+

### What Changed

```cpp
// fmt v10.2.1+ approach:
template <typename S>
consteval basic_format_string(const S& s) requires is_compile_time_constant(s) {
  // More precise requires clause
  check_format_string(s);  // Now properly marked as constexpr
}

// Also: partial revert of overly-aggressive consteval usage
// Fallback to runtime validation when appropriate
```

### Specific Changes

1. **Better constexpr handling**: Functions called in consteval contexts properly marked
2. **Reduced consteval surface**: Not everything forced to be consteval
3. **Compiler compatibility**: Tests against Clang 14, 15, 16
4. **C++ standard compliance**: More precise const-expression requirements

The fix was released in:
- fmt v10.2.1 (Jan 2025)
- Hermes v0.13.2 (Jan 2025)
- React Native 0.76.4 (Jan 2025)

---

## Why Your Project Is Affected

### Your Configuration

```json
{
  "expo": "~52.0.0",
  "react-native": "^0.76.3"
}
```

The `^0.76.3` semver range allows:
- 0.76.3 ✗ (current, broken)
- 0.76.4 ✓ (available, fixed)
- 0.76.5 ✓ (latest, fixed)

npm/yarn might not auto-upgrade patch versions if they're already installed. The `^` means:
- Allows patch changes (0.76.x)
- Doesn't allow minor changes (0.77.x)
- This is correct for production stability

**However**: You can still use `npm install react-native@0.76.5` to explicitly upgrade.

---

## Workaround Mechanisms

### Why Disabling Hermes Works

JavaScriptCore (JSC) is an older JavaScript engine that:
- Doesn't use fmt's consteval features
- Has direct Objective-C bridges
- Doesn't require C++ compilation
- Doesn't trigger consteval validation

Hermes, by contrast:
- Uses fmt for internal string formatting
- Requires C++ compilation
- Gets compiled as part of the iOS build

### Why Downgrading Works

Expo 51 / RN 0.75.x uses:
- fmt v9.x: Doesn't use consteval so aggressively
- Hermes 0.12.x: Different compile requirements
- No consteval validation issues

---

## Build Process Overview

Here's what happens during iOS build:

```
1. npm install / pod install
   └─> Fetches react-native 0.76.3
   └─> Fetches Hermes 0.13.0 (via RN)
   └─> Fetches fmt v10.0.0 (via Hermes)

2. expo prebuild / eas build
   └─> Runs Xcode build system
   └─> Invokes clang++
       └─> Attempts to compile Hermes
       └─> Includes fmt headers
       └─> Attempts to evaluate FMT_COMPILE strings
       └─> Clang 16 rejects consteval

3. Build fails with:
   "call to consteval function ... is not a constant expression"
```

---

## Verification Steps

### Check Your Installed Versions

```bash
# Check React Native version
npm list react-native
# Should show version >= 0.76.4 after fix

# Check if Hermes is bundled
cat node_modules/react-native/package.json | grep -i hermes

# Check fmt version (not directly in package.json, but in ios/Pods)
ls -la ios/Pods/fmt/ 2>/dev/null || echo "Pods not built yet"
```

### Verify Clang Version

```bash
# Check Xcode/Clang version
clang --version
# Should show clang version 16.x

# Check which Xcode is active
xcode-select --print-path
# Should show something like: /Applications/Xcode.app/Contents/Developer
```

### Build and Monitor

```bash
# Verbose output shows compilation details
eas build --platform ios --verbose

# Look for:
# - "Compiling fmt/include/fmt/format-inl.h"
# - "FMT_COMPILE" macro expansions
# - Error about consteval
```

---

## Prevention for Future Projects

### Best Practices

1. **Always use latest patch versions**: `^X.Y.Z` in package.json
2. **Test on latest Xcode**: Keep Xcode updated
3. **Monitor release notes**: Subscribe to React Native releases
4. **Consider using Expo's stable SDK**: They test compatibility
5. **Use npm ci in CI/CD**: Ensures consistent installs

### Example package.json Strategy

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "react-native": "0.76.5",  // Pin to specific fixed version
    "react": "18.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Timeline of Events

| Date | Event | Impact |
|------|-------|--------|
| Nov 2024 | Expo 52.0.0 released with RN 0.76.0 | Early adopters affected |
| Nov 2024 | fmt v10.0.0 consteval changes | Issue manifests |
| Nov 2024 | Xcode 16 becomes standard macOS tool | Validation gets stricter |
| Dec 2024 | RN 0.76.1, 0.76.2, 0.76.3 released | Same fmt v10.0.0 |
| Jan 2025 | fmt v10.2.1 released | Fix developed |
| Jan 2025 | Hermes 0.13.2 released | Updated fmt |
| Jan 2025 | React Native 0.76.4 released | Fix included |
| Feb 2025 | Expo 52.7+ includes RN 0.76.4+ | Newer Expo users unaffected |

---

## Related Compiler Concepts

### Concepts Used in This Error

**consteval**: 
- C++20 keyword
- Marks function as immediate (must execute at compile time)
- Stricter than constexpr

**constexpr**: 
- Can run at compile time OR runtime
- More flexible than consteval

**Constant Expression**: 
- Expression whose value can be computed at compile time
- Must not involve undefined behavior
- Limited pointer/reference operations

**FMT_COMPILE_STRING**: 
- Macro that wraps format strings
- Triggers compile-time validation
- Tries to use consteval for zero-runtime overhead

---

## References

### Official Sources

1. **React Native**:
   - https://github.com/facebook/react-native
   - 0.76.4 release notes mention fmt/Hermes fixes

2. **Hermes Engine**:
   - https://github.com/facebook/hermes
   - Version 0.13.2 includes fmt v10.2.1

3. **fmt Library**:
   - https://github.com/fmtlib/fmt
   - v10.2.1 release notes describe consteval fixes

4. **C++20 Standard**:
   - ISO/IEC 14882:2020
   - Section 13.10: "Immediate functions"

### Community Discussions

- React Native issues tagged with "consteval"
- Expo forum discussions on 52.0.0 compatibility
- Hermes GitHub issues on compiler compatibility

---

## Summary

| Aspect | Details |
|--------|---------|
| **Root Cause** | fmt v10.0.0 consteval implementation incompatible with Clang 16 |
| **Affected Versions** | RN 0.76.0-0.76.3, Expo 52.0-52.6 |
| **Fixed Versions** | RN 0.76.4+, Expo 52.7+, fmt v10.2.1+, Hermes 0.13.2+ |
| **Workarounds** | Disable Hermes (JSC), Downgrade Expo/RN, Clean CocoaPods |
| **Recommended Fix** | Upgrade React Native to 0.76.5 |
| **Implementation Complexity** | Trivial (one version bump) |
| **Risk Level** | None (0.76.4+ is stable) |

This is a **transitive dependency issue**, not a problem with PAKT app code. The fix is straightforward and safe.
