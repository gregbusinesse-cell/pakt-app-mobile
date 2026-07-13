# Fastlane Match Setup (Gestión automática de certificats)

Fastlane match stocke tes certificats Apple dans un repo GitHub privé et les récupère automatiquement pour les builds.

## ✅ Étapes de configuration

### 1. Crée un repo GitHub PRIVÉ pour les certificats

```bash
# Via GitHub web interface :
1. Va sur https://github.com/new
2. Crée un repo : "pakt-certificates" (PRIVÉ !)
3. Laisse-le vide (pas de README)
```

### 2. Génère un Personal Access Token GitHub

1. Va sur : https://github.com/settings/tokens/new
2. Crée un token avec ces permissions :
   - `repo` (accès complet au repo)
   - `write:packages` (optional)
3. Copie le token (tu le verras qu'une fois !)

### 3. Ajoute le token aux secrets GitHub

1. Va sur : https://github.com/gregbusinesse-cell/pakt-app-mobile/settings/secrets/actions
2. Crée un secret : `GITHUB_TOKEN` = (le token que tu viens de générer)

### 4. Initialise Fastlane match (UNE FOIS, sur ton Mac)

```bash
cd pakt-app-mobile/ios

# Match va créer les certificats et les stocker dans ton repo privé
fastlane match appstore

# Rentre tes credentials Apple quand demandé
# ✅ Tes certificats sont maintenant dans le repo pakt-certificates
```

### 5. Ajoute les autres secrets GitHub

- `APPLE_ID` = ton email Apple Developer
- `APPLE_PASSWORD` = app-specific password (https://appleid.apple.com)
- `APPLE_TEAM_ID` = ton Team ID (App Store Connect)
- `MATCH_PASSWORD` = mot de passe pour match (tu l'as créé à l'étape 4)

### 6. Lancer le workflow

```bash
git push origin main
# GitHub Actions lance le workflow automatiquement
# Fastlane match récupère les certificats depuis pakt-certificates
# Xcode build et upload à TestFlight
```

## 🔑 Secrets GitHub à configurer

| Secret | Valeur |
|--------|--------|
| `APPLE_ID` | ton@email.com |
| `APPLE_PASSWORD` | app-specific password |
| `APPLE_TEAM_ID` | 4T25YVUJ86 (exemple) |
| `MATCH_PASSWORD` | mot de passe match |
| `GITHUB_TOKEN` | personal access token |
| `EXPO_TOKEN` | ton token Expo |

## ⚠️ Important

- Le repo `pakt-certificates` doit être **PRIVÉ**
- Garde le `GITHUB_TOKEN` sécurisé (ne le partage pas)
- Les certificats dans ce repo ne coûtent rien
- Seul toi (et tes actions GitHub) peuvent les accéder

## 🆘 Troubleshooting

**Erreur: "Git repo not found"**
- Vérifie que le repo est créé
- Vérifie que le GITHUB_TOKEN a accès

**Erreur: "invalid credentials"**
- Vérifie APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID

**Erreur: "Match password incorrect"**
- Réinitialise avec `fastlane match nuke appstore`
- Lance `fastlane match appstore` à nouveau

## ✅ Résultat

Une fois configuré :
- ✅ Zéro coûts EAS
- ✅ Certificats gérés automatiquement
- ✅ Build sur GitHub Actions gratuit
- ✅ Upload automatique à TestFlight
