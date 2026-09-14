#!/usr/bin/env node
/* ============================================================================
   build.js — assemble index.template.html + styles.css + kez-assets.js +
   pdfgen.js + logic.js + ui.js en un seul index.html autonome.
   Sans dépendance : Node uniquement (fs). Usage : node build.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const racine = __dirname;
const lire = (nom) => fs.readFileSync(path.join(racine, nom), 'utf8');

const gabarit = lire('index.template.html');
const remplacements = {
  '/*__CSS__*/': lire('styles.css'),
  '/*__ASSETS__*/': lire('kez-assets.js'),
  '/*__PDFGEN__*/': lire('pdfgen.js'),
  '/*__LOGIC__*/': lire('logic.js'),
  '/*__UI__*/': lire('ui.js'),
};

let sortie = gabarit;
for (const [motif, contenu] of Object.entries(remplacements)) {
  if (!sortie.includes(motif)) throw new Error('gabarit : ' + motif + ' introuvable dans index.template.html');
  sortie = sortie.replace(motif, () => contenu);
}

fs.writeFileSync(path.join(racine, 'index.html'), sortie);
console.log('index.html généré (' + (sortie.length / 1024).toFixed(1) + ' Ko).');
