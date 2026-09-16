# Architecture

## Principe : local-first

L'agent tourne comme un processus Node.js sur une machine que tu controles
(PC, mini-serveur, Raspberry Pi). Il n'y a pas de backend cloud a payer : tout
l'etat (photos en attente, annonces, historique de prix, preferences apprises)
vit dans un fichier SQLite local (`~/.ebay-agent/data.sqlite`, via le module
natif `node:sqlite` de Node 22 — zero dependance externe). Les seuls appels
reseau sont vers les API officielles eBay.

## Pipeline (une execution = un objet)

```
photos/                                  src/pipeline/orchestrator.ts
  |
  v
1. Lecture des photos            -> src/vision/ocr.ts, src/vision/barcode.ts
2. Identification locale         -> src/vision/identify.ts (marque, modele, GTIN, confiance)
  |
  v
3. Recherche categorie eBay      -> src/ebay/taxonomy.ts (Taxonomy API, gratuite)
4. Recherche comparables actifs  -> src/ebay/browse.ts (Browse API, gratuite)
5. Calcul confiance combinee     -> src/pipeline/research.ts
  |
  v
6. Calcul du prix                -> src/pricing/strategy.ts (mediane/moyenne + regles utilisateur)
7. Titre + description           -> src/content/title.ts, src/content/description.ts
8. Caracteristiques obligatoires -> src/pipeline/buildListing.ts (+ preferences apprises)
  |
  v
9. Decision publier / valider    -> src/decision/autoPublish.ts (seuils configures)
  |                                          |
  |-- publier automatiquement                |-- mettre en file de revue
  v                                          v
10. Upload photos (EPS)          src/db/repositories/reviewQueue.ts
    src/ebay/pictures.ts         + question ciblee (ex: "photo plus nette de l'etiquette")
11. Creation item + offre
    src/ebay/inventory.ts
12. Publication
    -> enregistrement SQLite (items, listings, price_history)
```

## Surveillance continue (processus separe, `ebay-agent monitor`)

```
node-cron (local, toutes les N heures)
  -> pour chaque annonce active (SQLite)
       -> src/ebay/fulfillment.ts : vendue ? -> stop, statut "sold"
       -> src/ebay/browse.ts      : comparables actuels
       -> src/pricing/strategy.ts : computeReprice (baisse max, prix plancher)
       -> src/ebay/inventory.ts   : mise a jour du prix de l'offre
```

## Apprentissage des habitudes

Chaque fois qu'un choix recurrent est fait (etat par defaut, categorie), il est
compte dans la table `preferences` (`src/db/repositories/preferences.ts`).
L'agent reutilise le choix le plus frequent au fil des utilisations, ce qui
reduit progressivement le nombre de questions posees.

## Pourquoi ces choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Etat persistant | `node:sqlite` (Node 22+) | Natif, 0 dependance, 0€, aucun serveur a gerer |
| OCR | `tesseract.js` (WASM) | Local, gratuit, hors-ligne apres cache des langues |
| Code-barres | `@zxing/library` + `jimp` | Purement local, aucun appel a un service de scan payant |
| Prix marche | eBay Browse API | Officielle et gratuite, mais limitee aux annonces actives (voir LIMITES) |
| Photos hebergees | eBay Picture Services (Trading API) | Incluse gratuitement avec les cles developpeur eBay |
| Planification | `node-cron` | Local, pas de service de cron cloud a payer |
