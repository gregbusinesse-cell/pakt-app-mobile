const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Créer le dossier assets s'il n'existe pas
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('✓ Dossier assets créé');
}

// PNG minimal 1x1 transparent en base64
// C'est un PNG transparent de 1x1 pixel qui fonctionne partout
const minimalPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Créer les 3 images requises
try {
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), minimalPng);
  console.log('✓ icon.png créé');

  fs.writeFileSync(path.join(assetsDir, 'splash.png'), minimalPng);
  console.log('✓ splash.png créé');

  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), minimalPng);
  console.log('✓ adaptive-icon.png créé');

  console.log('\n✨ Tous les assets ont été générés avec succès!');
} catch (error) {
  console.error('❌ Erreur lors de la création des assets:', error.message);
  process.exit(1);
}
