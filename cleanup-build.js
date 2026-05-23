#!/usr/bin/env node
// Remove enableBundleCompression from build.gradle after expo prebuild generates it

const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');

try {
  if (fs.existsSync(buildGradlePath)) {
    let content = fs.readFileSync(buildGradlePath, 'utf8');

    // Remove enableBundleCompression line
    const originalLength = content.length;
    content = content.replace(/\s*enableBundleCompression\s*=\s*\(findProperty\('android\.enableBundleCompression'\)\s*\?:\s*false\)\.toBoolean\(\)\s*/g, '');

    if (content.length !== originalLength) {
      fs.writeFileSync(buildGradlePath, content, 'utf8');
      console.log('✅ Removed enableBundleCompression from build.gradle');
    } else {
      console.log('✅ No enableBundleCompression found to remove');
    }
  } else {
    console.log('⚠️ build.gradle not found');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
