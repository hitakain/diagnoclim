# Agent eBay autonome — Photo → Vente

Agent local-first : tu prends des photos d'un objet, l'agent identifie le produit,
recherche le marche sur eBay, calcule un prix, redige l'annonce et la publie
automatiquement (si la confiance est suffisante), puis surveille et ajuste le prix
jusqu'a la vente.

**Zero abonnement supplementaire** : OCR local, lecture de code-barres locale,
base de donnees SQLite locale, planification locale. Seules les API eBay
officielles (gratuites) sont utilisees pour tout ce qui touche a eBay lui-meme.

## Demarrage rapide

```bash
cd ebay_agent
npm install
cp .env.example .env      # renseigne EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (compte developer.ebay.com gratuit)
npm run build
node dist/cli/index.js init     # autorisation eBay, une seule fois
node dist/cli/index.js watch    # dossier boite de reception : depose un sous-dossier de photos = un objet
```

Dans un autre terminal (ou service systeme), laisse tourner la surveillance des prix :

```bash
node dist/cli/index.js monitor
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — pipeline complet et modules
- [docs/SETUP.md](docs/SETUP.md) — configuration eBay pas a pas
- [docs/LIMITES_ET_ALTERNATIVES.md](docs/LIMITES_ET_ALTERNATIVES.md) — ce qui est 100% gratuit, ce qui a des limites, et pourquoi

## Commandes CLI

| Commande | Role |
|---|---|
| `init` | Autorise l'agent sur ton compte eBay (une fois) |
| `sell <dossier>` | Traite un dossier de photos et publie si la confiance est suffisante |
| `watch [dossier]` | Surveille en continu une boite de reception (`~/.ebay-agent/inbox` par defaut) |
| `monitor` | Demarre la surveillance/repricing automatique des annonces actives |
| `review list` / `review resolve <id>` | Objets bloques en attente de ta validation |
| `config show` / `config set <chemin> <valeur>` | Reglages (seuils, prix minimum, categories bloquees, etc.) |

## Tests

```bash
npm test
```
