# Étapes : GitHub puis Firebase

À faire **dans l’ordre**. Remplace `TON_USERNAME` et `TON_REPO` par ton compte GitHub et le nom du dépôt.

---

## Partie 1 — GitHub (sauvegarder le code)

### 1. Créer le dépôt sur GitHub
1. Va sur **https://github.com** et connecte-toi.
2. Clique sur **+** → **New repository**.
3. **Repository name** : par ex. `product-display` (ou le nom que tu veux).
4. **Public**.
5. **Ne coche pas** "Add a README file".
6. Clique **Create repository**.

### 2. Pousser ton projet depuis ton PC
Ouvre **PowerShell** ou **Invite de commandes** dans le dossier du projet, puis exécute :

```powershell
cd "c:\Users\MSI\Desktop\home"
```

```powershell
git init
```

```powershell
git add .
```

```powershell
git status
```
(Vérifie que les bons fichiers sont listés ; `dist/` et `node_modules/` ne doivent pas apparaître grâce au .gitignore.)

```powershell
git commit -m "Initial commit: product display"
```

```powershell
git branch -M main
```

```powershell
git remote add origin https://github.com/TON_USERNAME/TON_REPO.git
```
(Remplace **TON_USERNAME** par ton pseudo GitHub et **TON_REPO** par le nom du dépôt, ex. `product-display`.)

```powershell
git push -u origin main
```
(Si on te demande de te connecter, utilise ton compte GitHub.)

✅ Ton code est sur GitHub.

---

## Partie 2 — Firebase (données + hébergement du site)

### 3. Créer le projet Firebase
1. Va sur **https://console.firebase.google.com**.
2. **Ajouter un projet** (ou **Créer un projet**).
3. Donne un **nom** (ex. `product-display`) → **Continuer**.
4. Désactive Google Analytics si tu veux → **Créer le projet** → **Continuer**.

### 4. Activer Firestore
1. Dans le menu de gauche : **Build** → **Firestore Database**.
2. **Créer une base de données**.
3. Choisis **Démarrer en mode test** (pour commencer) → **Suivant**.
4. Choisis une **région** (ex. `europe-west1`) → **Activer**.

### 5. Activer Storage
1. Dans le menu : **Build** → **Storage**.
2. **Commencer**.
3. Garde les règles en mode test → **Suivant** → même région que Firestore → **Terminer**.

### 6. Récupérer la config Web (pour app.js)
1. Clique sur l’**engrenage** à côté de "Vue d’ensemble du projet" → **Paramètres du projet**.
2. Onglet **Général** → descends à **Vos applications**.
3. Clique sur l’icône **</>** (Web).
4. **Surnom de l’application** : ex. `Product Display` → **Enregistrer l’application**.
5. Tu vois un bloc `firebaseConfig` avec `apiKey`, `authDomain`, `projectId`, etc. **Garde cette page ouverte** (tu en auras besoin à l’étape 8).

### 7. Installer Firebase CLI et te connecter (sur ton PC)
Dans **PowerShell** (toujours dans `c:\Users\MSI\Desktop\home`) :

```powershell
npm install -g firebase-tools
```
(Si `npm` n’est pas reconnu, installe **Node.js** depuis https://nodejs.org puis rouvre PowerShell.)

```powershell
firebase login
```
(Une page navigateur s’ouvre ; connecte-toi avec le même compte Google que Firebase.)

```powershell
firebase use --add
```
- Choisis ton **projet Firebase** dans la liste.
- Donne un **alias** (ex. `default`) → Entrée.

### 8. Mettre ta config Firebase dans app.js
1. Ouvre **app.js** dans ton éditeur.
2. Cherche **firebaseConfig** (vers la ligne 56).
3. Remplace les valeurs par celles de la console Firebase (étape 6) :

```javascript
const firebaseConfig = {
  apiKey: "ta-vraie-apiKey",
  authDomain: "ton-projet.firebaseapp.com",
  projectId: "ton-projet-id",
  storageBucket: "ton-projet.appspot.com",
  appId: "ta-appId",
};
```

4. Enregistre le fichier.

*(Si ton dépôt GitHub est public, ne commite pas ce fichier avec les vraies clés : fais le commit avant de remplir les clés, ou utilise un fichier non versionné.)*

### 9. Build puis déployer sur Firebase Hosting
Toujours dans le même dossier :

```powershell
npm install
```

```powershell
npm run build
```
(Ça crée le dossier **dist/** avec le code minifié/obfusqué.)

```powershell
firebase deploy
```

À la fin, tu verras une URL du type :
**https://ton-projet-id.web.app**

✅ Ton site est en ligne ; les données et les médias utilisent Firestore et Storage.

---

## Récap

| Étape | Où | Quoi |
|-------|----|------|
| 1–2 | GitHub | Créer le dépôt et pousser le code |
| 3–5 | Console Firebase | Créer le projet, Firestore, Storage |
| 6–8 | Console + app.js | Config Web et la coller dans app.js |
| 7–9 | PC (PowerShell) | firebase login, use, npm run build, firebase deploy |

Ensuite, à chaque fois que tu modifies le site :
- **Code** : `git add .` → `git commit -m "message"` → `git push`.
- **Mettre à jour le site en ligne** : `npm run build` puis `firebase deploy` (ou `npm run deploy`).
