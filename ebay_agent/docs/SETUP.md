# Mise en route

## 1. Prerequis

- Node.js >= 22.5 (pour `node:sqlite` natif)
- Un compte eBay vendeur (particulier ou pro)
- Un compte gratuit sur [developer.ebay.com](https://developer.ebay.com)

## 2. Cles API eBay (gratuites)

1. Cree une application sur developer.ebay.com (type "Production").
2. Recupere `Client ID` et `Client Secret`.
3. Cree un "RuName" (redirect URL name) dans les parametres de l'application —
   c'est l'identifiant de redirection OAuth, pas une vraie URL a heberger.
4. Copie `.env.example` vers `.env` et renseigne `EBAY_CLIENT_ID`,
   `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_MARKETPLACE_ID` (`EBAY_FR` par defaut).

## 3. Politiques de vente (a creer une fois dans Seller Hub eBay)

L'API Inventory exige que tu aies deja defini, une seule fois, dans les
reglages vendeur eBay (gratuit) :
- une politique de paiement,
- une politique de retour,
- une politique d'expedition (fulfillment policy),
- un emplacement marchand (`merchant location key`).

Renseigne leurs identifiants dans `.env`
(`EBAY_MERCHANT_LOCATION_KEY`) et dans les reglages locaux :

```bash
ebay-agent config set seller.paymentPolicyId "XXXX"
ebay-agent config set seller.returnPolicyId "XXXX"
ebay-agent config set seller.shippingPolicyId "XXXX"
ebay-agent config set seller.merchantLocationKey "XXXX"
```

## 4. Autorisation initiale (une seule fois)

```bash
node dist/cli/index.js init
```

Ouvre l'URL affichee, connecte-toi a ton compte eBay, accepte l'acces, puis
colle le `code` present dans l'URL de redirection. Le `refresh_token` obtenu
est enregistre automatiquement dans `.env` : l'agent peut ensuite publier des
annonces sans reconnexion, indefiniment (le refresh token eBay est valide 18
mois et se renouvelle a chaque usage).

## 5. Reglages de securite (publication automatique)

```bash
ebay-agent config set autoPublish.enabled true
ebay-agent config set autoPublish.minIdentificationConfidence 90
ebay-agent config set autoPublish.minPrice 5
ebay-agent config set pricing.maxPriceDropPercentPerAdjustment 10
ebay-agent config set pricing.maxTotalPriceDropPercent 30
ebay-agent config set autoPublish.blockedCategoryIds '["1249"]'
```

Tant que `autoPublish.enabled` est `false`, chaque objet passe par la file de
revue (`ebay-agent review list`) — utile pour valider le comportement avant de
tout automatiser.

## 6. Utilisation quotidienne

```bash
node dist/cli/index.js watch
```

Depose un sous-dossier de photos (une photo ou plus) par objet dans
`~/.ebay-agent/inbox/`. Des que le dossier est stable (~4 secondes sans
nouvelle photo), le pipeline complet se declenche automatiquement.

## 7. Surveillance et repricing (a laisser tourner en continu)

```bash
node dist/cli/index.js monitor
```

A faire tourner en arriere-plan sur une machine allumee en permanence
(mini-PC, Raspberry Pi...), via `pm2`, `systemd` (Linux), `launchd` (macOS) ou
le Planificateur de taches (Windows) — tous gratuits et locaux. C'est la seule
vraie contrainte materielle du projet : sans machine allumee en continu, le
repricing automatique ne peut pas s'executer (voir
[LIMITES_ET_ALTERNATIVES.md](LIMITES_ET_ALTERNATIVES.md)).
