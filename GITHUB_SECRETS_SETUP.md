# GitHub Secrets pour TestFlight Build

Pour que le workflow GitHub Actions build l'app iOS et l'envoie à TestFlight, configure ces secrets dans GitHub :

## Accès GitHub Secrets

1. Va sur : `https://github.com/gregbusinesse-cell/pakt-app-mobile/settings/secrets/actions`
2. Clique "New repository secret"
3. Ajoute les secrets suivants :

## Secrets à configurer

### 1. **EXPO_TOKEN**
- Où le trouver : https://expo.dev/settings/tokens
- Crée un Personal Access Token
- Copie le token complet

### 2. **APPLE_ID**
- Ton adresse email Apple Developer
- Ex: `gregoire@example.com`

### 3. **APPLE_PASSWORD** 
- **Pas** ton mot de passe Apple normal
- Crée un "App-Specific Password" :
  - Va sur https://appleid.apple.com/account/home
  - Security → App-specific passwords
  - Crée un pour "App Store Connect"
  - Copie le mot de passe (format: `xxxx-xxxx-xxxx-xxxx`)

### 4. **APPLE_APP_SPECIFIC_PASSWORD**
- Même chose que APPLE_PASSWORD (redondant mais parfois nécessaire)

### 5. **APPLE_TEAM_ID**
- Où le trouver : App Store Connect → Account → Membership
- Format: `XXXXXXXXXX` (10 caractères)

### 6. **MATCH_PASSWORD**
- Mot de passe pour Fastlane Match (pour les signing certificates)
- Crée un mot de passe complexe
- Note-le quelque part de sûr

### 7. **GITHUB_TOKEN**
- Génère automatiquement dans GitHub
- Va sur : Settings → Developer settings → Personal access tokens
- Crée un token avec `repo` + `read:org` scopes

## Vérification

Une fois configurés, GitHub Actions devrait :
1. ✅ Build l'app iOS
2. ✅ Sign avec les certificates Apple
3. ✅ Upload automatiquement à TestFlight
4. ✅ ~50-60 min → Build disponible sur TestFlight

## Si problèmes

- Vérifie les logs GitHub : Actions tab → workflow → build job
- Si erreur de signing : configure les certificates dans Xcode d'abord
- Si erreur TestFlight : vérifie que le bundleIdentifier (`com.pakt.app`) existe dans App Store Connect
