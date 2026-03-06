# GitHub : quoi poster (et quoi ne pas poster)

**Tu ne supprimes rien sur ton PC.** Tu postes sur GitHub seulement ce qui est utile pour le code. Le reste reste sur ton PC mais n’est **pas envoyé** grâce au `.gitignore`.

---

## À POSTER sur GitHub (tout envoyer avec `git add .`)

Ces fichiers **doivent** être sur le dépôt :

| Fichier / Dossier | Rôle |
|-------------------|------|
| `index.html` | Page principale (lecture seule) |
| `exemple_dynamic.html` | Page admin / édition |
| `404.html` | Page d’erreur 404 |
| `app.js` | Logique, Firebase, catalogue |
| `build.js` | Script de build (minification + obfuscation) |
| `server.js` | Serveur local (optionnel) |
| `catalog.json` | Données catalogue (sauvegarde / fallback) |
| `phraseGen.json` | Phrases du bandeau |
| `package.json` | Dépendances et scripts npm |
| `firebase.json` | Config Firebase Hosting |
| `.gitignore` | Liste de ce qu’on ne poste pas |
| `STEPS.md` | Guide étapes GitHub + Firebase |
| `DEPLOY.md` | Guide déploiement détaillé |
| `.vscode/settings.json` | Paramètres éditeur (optionnel) |
| `TSESTT HTML.html` | Si tu l’utilises, tu peux le poster aussi |

En pratique : dans le dossier du projet tu fais `git add .` → tout ce qui est **non ignoré** (donc tout sauf la liste ci‑dessous) est ajouté. Tu ne supprimes aucun fichier.

---

## À NE PAS poster (rester sur ton PC uniquement)

Grâce au **`.gitignore`**, ces éléments **ne sont pas envoyés** sur GitHub. Tu **ne les supprimes pas** : ils restent sur ton disque, on les ignore juste pour Git.

| Élément | Pourquoi ne pas poster |
|--------|-------------------------|
| `dist/` | Généré par `npm run build`. On le recrée à chaque déploiement. |
| `node_modules/` | Dépendances npm. Chacun les recrée avec `npm install`. |
| `.env` / `.env.local` | Clés secrètes (ex. Firebase). Ne doivent pas être sur un repo public. |
| `.firebase/` | Cache et infos Firebase CLI. Spécifique à ta machine. |
| `*.log` | Fichiers de log. Inutiles pour le dépôt. |

Résumé : **tu ne supprimes rien.** Tu gardes tous tes fichiers sur le PC. Avec `git add .`, Git envoie tout **sauf** ce qui est dans `.gitignore`.

---

## Commandes à utiliser

```powershell
cd "c:\Users\MSI\Desktop\home"
git add .
git status
```

`git status` montre ce qui sera commité. Tu dois voir tes `.html`, `app.js`, `package.json`, etc. Tu ne dois **pas** voir `node_modules/` ni `dist/` dans la liste des fichiers à commiter.

Puis :

```powershell
git commit -m "Initial commit"
git push -u origin main
```

C’est tout : tu postes ce qu’il faut, et les fichiers inutiles ou sensibles ne partent pas. Aucune suppression nécessaire.
