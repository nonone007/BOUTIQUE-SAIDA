# Déploiement : GitHub + Firebase

Ce guide explique comment **publier ton projet sur GitHub** et **sauvegarder tes données directement sur Firebase** (Firestore + Storage + hébergement optionnel).

---

## 1. GitHub (code et versioning)

### Pourquoi GitHub ?
- Sauvegarde et historique de tout ton code
- Possibilité d’utiliser **GitHub Pages** pour héberger le site en lecture seule (gratuit)
- Travail à plusieurs ou sur plusieurs machines

### Étapes

1. **Créer un dépôt sur GitHub**
   - Va sur [github.com](https://github.com) → New repository
   - Nom du repo (ex. `product-display`)
   - Ne coche pas "Initialize with README" si tu ajoutes un projet existant

2. **Initialiser Git et pousser le code** (dans le dossier du projet, PowerShell) :

   ```powershell
   cd "c:\Users\MSI\Desktop\home"
   git init
   git add .
   git commit -m "Initial commit: product display site"
   git branch -M main
   git remote add origin https://github.com/TON_USERNAME/TON_REPO.git
   git push -u origin main
   ```

3. **Optionnel – GitHub Pages**
   - Dans le repo : **Settings** → **Pages**
   - Source : **Deploy from a branch**
   - Branch : `main` → dossier `/ (root)` → Save
   - Ton site sera en ligne à : `https://TON_USERNAME.github.io/TON_REPO/`

**Important :** avec GitHub Pages, le site est **statique**. Les données seront soit dans `catalog.json` / `phraseGen.json` (fichiers dans le repo), soit chargées depuis **Firebase** si tu configures Firebase (voir ci‑dessous). Ne mets **jamais** tes clés Firebase dans un fichier committé (utilise les placeholders comme dans `app.js` ou une config côté build).

---

## 2. Firebase (données et stockage)

Tu as déjà **Firestore** et **Storage** intégrés dans `app.js`. Il suffit de créer un projet et de brancher la config.

### Pourquoi Firebase ?
- **Firestore** : catalogue et paramètres sauvegardés en base (plus besoin de tout mettre dans `catalog.json` en local)
- **Storage** : images et vidéos hébergées (plus de dépendance au `server.js` local pour les uploads)
- **Hosting** (optionnel) : héberger le site sur un sous‑domaine Firebase (`*.web.app`)

### Étapes

1. **Créer un projet Firebase**
   - [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet** (ou en rejoindre un)
   - Donne un nom au projet et suis les étapes

2. **Activer les services**
   - **Firestore Database** : Créer une base → mode test pour commencer (puis règles de sécurité en prod)
   - **Storage** : Démarrer → mode test pour commencer
   - **Hosting** (optionnel) : pas besoin de l’activer à l’avance, la première fois que tu feras `firebase deploy` ça sera proposé

3. **Récupérer la config Web**
   - **Paramètres du projet** (icône engrenage) → **Général** → **Vos applications**
   - Cliquer sur **</>** (Web) → enregistrer l’app (ex. "Product Display")
   - Copier l’objet `firebaseConfig`

4. **Configurer `app.js`**
   - Dans `app.js`, remplace les valeurs dans `firebaseConfig` (vers la ligne 56) par les tiennes :
     - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`
   - **Ne commite pas** de clés réelles si le repo est public. Soit tu gardes les placeholders et tu configures uniquement en local / sur un outil de déploiement, soit tu utilises des variables d’environnement au build si tu en as un.

5. **Règles Firestore (recommandé après les tests)**
   - Dans la console Firebase : **Firestore** → **Règles**
   - En production, restreins lecture/écriture aux utilisateurs authentifiés ou à des conditions précises (par ex. par domaine). En mode test, tout le monde peut lire/écrire pendant un temps limité.

6. **Hébergement sur Firebase (optionnel)**
   - Installer Firebase CLI : `npm install -g firebase-tools`
   - Se connecter : `firebase login`
   - Lier le projet : `firebase use --add` → choisir ton projet
   - Pour déployer la **version sécurisée** (code minifié + obfusqué), voir la section 4 ci‑dessous.
   - L’URL du site sera du type : `https://TON_PROJECT_ID.web.app`

---

## 3. Résumé des rôles

| Besoin              | Outil          | Rôle principal                          |
|---------------------|----------------|-----------------------------------------|
| Code / versioning   | **GitHub**     | Repo, historique, éventuellement Pages |
| Données (catalogue) | **Firebase Firestore** | Sauvegarde directe, synchro multi‑appareils |
| Fichiers (images/vidéos) | **Firebase Storage** | Stockage des médias                      |
| Hébergement du site | **GitHub Pages** ou **Firebase Hosting** | Servir `index.html`, `app.js`, etc.     |

Conseil : **GitHub** pour le code, **Firebase** pour les données et les médias. Une fois la config Firebase branchée dans `app.js`, les ajouts/éditions depuis ton interface seront enregistrés directement dans Firestore et Storage.

---

## 4. Sécuriser le code (obfuscation) — Firebase ne bloque pas

Pour rendre ton code **plus difficile à lire** (sans le cacher à 100 %, ce qui est impossible pour du HTML/JS exécuté dans le navigateur) et **déployer sur Firebase sans blocage** :

1. **Installation** (une fois) :
   ```powershell
   cd "c:\Users\MSI\Desktop\home"
   npm install
   ```

2. **Build** : minification du HTML + obfuscation de `app.js` → sortie dans `dist/` :
   ```powershell
   npm run build
   ```

3. **Déploiement Firebase** : Firebase est configuré pour servir le dossier **`dist/`** (pas le code source). Donc :
   ```powershell
   npm run deploy
   ```
   ou bien : `npm run build` puis `firebase deploy`.

Résultat : ce qui est en ligne sur Firebase, ce sont les fichiers **minifiés et obfusqués** (HTML illisible, JS en variables hex, etc.). Le site fonctionne normalement ; Firebase ne bloque rien.

**À savoir :** le code envoyé au navigateur reste visible par quelqu’un de déterminé (DevTools, sources). La vraie sécurité vient des **règles Firestore/Storage** et du fait de ne pas mettre de secrets (mots de passe, clés secrètes) dans le frontend. La config Firebase (`apiKey`, etc.) dans le frontend est faite pour être publique ; ce sont les règles qui protègent tes données.
