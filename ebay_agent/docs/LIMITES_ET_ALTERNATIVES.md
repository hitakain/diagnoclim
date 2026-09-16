# Limites et alternatives gratuites

Conformement a la contrainte "0€ d'abonnement supplementaire", voici chaque
fonctionnalite ou une solution payante existe, l'alternative gratuite retenue
par defaut, et les limites reelles que cela implique.

## 1. Lecture du texte sur les photos (OCR)

- **Solution retenue (gratuite)** : `tesseract.js`, moteur OCR open source
  execute localement (WebAssembly), sans envoi de photo a un service tiers.
- **Alternative payante existante** : Google Cloud Vision, AWS Textract,
  Azure OCR — plus precis, notamment sur texte petit, flou ou avec reflets.
- **Limite de l'alternative gratuite** : taux d'erreur plus eleve sur des
  etiquettes abimees ou mal eclairees. En pratique : prendre la photo de
  l'etiquette bien a plat, avec un bon eclairage, ameliore nettement le
  resultat.

## 2. Reconnaissance visuelle "intelligente" du produit

- **Solution retenue (gratuite)** : combinaison code-barres (EAN/UPC, local,
  fiable) + texte OCR + correspondance avec le catalogue eBay (recherche par
  GTIN via l'API Browse, gratuite).
- **Alternative payante existante** : un modele de vision multimodal cloud
  (type GPT-4 Vision, Google Gemini Vision) capable de reconnaitre un objet
  meme sans texte ni code-barres visible.
- **Limite de l'alternative gratuite** : si l'objet n'a ni etiquette lisible
  ni code-barres (ex: objet artisanal, piece detachee sans marquage), l'agent
  ne peut pas deviner seul de quoi il s'agit et demandera une precision
  ("Je n'arrive pas a identifier cet objet, peux-tu preciser son nom ?").
- **Option d'amelioration gratuite** : brancher un modele de vision local via
  [Ollama](https://ollama.com) (ex: `llava`), qui tourne entierement sur la
  machine de l'utilisateur, sans abonnement — au prix d'un materiel plus
  puissant (CPU/GPU) et d'un temps d'analyse plus long. Le point d'integration
  est prevu (`OLLAMA_BASE_URL` dans `.env`) mais desactive par defaut.

## 3. Historique des ventes reellement conclues

- **Solution retenue (gratuite)** : API Browse eBay, qui liste les annonces
  **actives** (en cours), utilisees comme comparables pour estimer un prix.
- **Alternative payante/restreinte existante** : eBay Marketplace Insights /
  Terapeak donnent le prix des ventes **effectivement conclues**, mais cet
  acces est reserve aux comptes partenaires eBay (candidature necessaire,
  gratuite mais non garantie).
- **Limite de l'alternative gratuite** : le prix suggere reflete la
  concurrence actuelle (ce qui est en vente), pas ce qui se vend vraiment.
  C'est une approximation raisonnable mais peut legerement sur- ou
  sous-estimer le prix reel du marche.

## 4. Redaction du titre et de la description

- **Solution retenue (gratuite)** : generation par templates deterministes
  (marque, modele, categorie, etat, mots-cles detectes).
- **Alternative payante existante** : un LLM cloud (API Claude, GPT...) pour
  un texte plus naturel et persuasif.
- **Limite de l'alternative gratuite** : texte plus "mecanique", moins
  variable d'une annonce a l'autre.
- **Option d'amelioration gratuite** : brancher un LLM local via Ollama
  (`OLLAMA_BASE_URL`/`OLLAMA_MODEL` dans `.env`) pour reformuler le texte
  localement, sans cout, si la machine de l'utilisateur le permet.

## 5. Hebergement des photos de l'annonce

- **Solution retenue (gratuite)** : eBay Picture Services (EPS), via l'API
  Trading historique, incluse gratuitement avec toute cle developpeur eBay.
- **Pas d'alternative payante necessaire ici** : c'est deja la solution
  standard et gratuite utilisee par tous les vendeurs eBay.

## 6. Stockage des donnees de l'agent

- **Solution retenue (gratuite)** : SQLite local via `node:sqlite` (natif
  Node.js 22+), aucun serveur de base de donnees a payer ou heberger.
- **Limite** : les donnees restent sur la machine locale (ce qui est
  l'objectif "local-first") — pas de synchronisation multi-appareils sans
  mise en place manuelle (sauvegarde du fichier `.ebay-agent/data.sqlite`).

## 7. Fonctionnement continu (surveillance des prix, publication en watch)

- **Solution retenue (gratuite)** : processus Node.js local + `node-cron`,
  a laisser tourner sur une machine que l'utilisateur possede deja (PC,
  Raspberry Pi, mini-serveur).
- **Vraie contrainte (ni payante ni gratuite, materielle)** : ce processus
  doit rester allume pour surveiller/repricer en continu. Aucune solution
  cloud "toujours gratuite" ne garantit l'execution 24/7 d'un processus
  persistant sans un minimum de configuration (VM gratuite a duree limitee,
  Raspberry Pi personnel, etc.). C'est explicitement documente ici plutot que
  masque par un abonnement cache.

## 8. Detection de vente

- **Solution retenue (gratuite)** : API Sell Fulfillment (gratuite), qui
  liste les commandes recues et permet de savoir qu'un SKU a ete vendu.
