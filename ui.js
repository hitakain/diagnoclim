/* ============================================================================
   ui.js — interface de saisie, historique et réglages.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- utilitaires DOM --------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list' && k !== 'type') node[k] = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return node;
  }

  let toastTimer;
  function toast(message, kind) {
    const node = $('#toast');
    node.textContent = message;
    node.className = 'toast show' + (kind === 'err' ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.className = 'toast'; }, kind === 'err' ? 5200 : 3200);
  }

  /* ---------- stockage ----------------------------------------------------- */
  const memoire = {};
  let stockageOk = true;
  const store = {
    lire(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return memoire[key] !== undefined ? memoire[key] : fallback; }
    },
    ecrire(key, value) {
      memoire[key] = value;
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) {
        if (stockageOk) {
          stockageOk = false;
          toast("Mémoire du navigateur pleine ou indisponible : pense à exporter ta sauvegarde.", 'err');
        }
        return false;
      }
    },
  };

  const CLE_REGLAGES = 'kez.cerfa.reglages';
  const CLE_FICHES = 'kez.cerfa.fiches';
  const CLE_BROUILLON = 'kez.cerfa.brouillon';

  /* ---------- état --------------------------------------------------------- */
  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  const REGLAGES_DEFAUT = {
    operateurNom: 'KEZ Énergie',
    operateurAdresse: '3 impasse Louis de Gayrard, 31600 Eaunes',
    operateurSiret: '',
    attestationNo: '',
    signOpNom: 'Mohamed Kezai',
    signOpQualite: 'Technicien frigoriste',
    detecteurId: '',
    installDestination: '',
    prefixe: String(new Date().getFullYear()) + '-',
    compteur: 1,
    garderPhotos: true,
  };

  let reglages = Object.assign({}, REGLAGES_DEFAUT, store.lire(CLE_REGLAGES, {}));
  let fiches = store.lire(CLE_FICHES, []);
  let vue = 'saisie';
  let etape = 0;
  let fiche = null;

  const numeroSuivant = () => reglages.prefixe + String(reglages.compteur).padStart(3, '0');

  function ficheVierge() {
    return {
      id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ficheNo: numeroSuivant(),
      dateIntervention: aujourdhui(),
      operateurNom: reglages.operateurNom,
      operateurAdresse: reglages.operateurAdresse,
      operateurSiret: reglages.operateurSiret,
      attestationNo: reglages.attestationNo,
      detenteurNom: '', detenteurAdresse: '', detenteurSiret: '',
      marque: '', modele: '', serie: '', localisation: '',
      fluide: 'R32', charge: '',
      natures: [], autrePrecision: '',
      detecteurId: reglages.detecteurId, controleDate: '',
      detecteurPermanent: 'non',
      controleEtancheite: false, fuiteConstatee: 'non',
      fuites: [{ loca: '', rep: '' }, { loca: '', rep: '' }, { loca: '', rep: '' }],
      manipulation: false,
      qteVierge: '', qteRecycle: '', qteRegenere: '', denomChange: '',
      qteTraitement: '', qteReutilisation: '', contenants: '', bsff: '',
      installDestination: reglages.installDestination,
      observations: '',
      signOpNom: reglages.signOpNom, signOpQualite: reglages.signOpQualite,
      signDetNom: '', signDetQualite: 'Client',
      signOpImg: '', signDetImg: '',
      photo: '',
      cree: new Date().toISOString(),
    };
  }

  fiche = store.lire(CLE_BROUILLON, null) || ficheVierge();

  const sauverBrouillon = () => store.ecrire(CLE_BROUILLON, fiche);
  const sauverReglages = () => store.ecrire(CLE_REGLAGES, reglages);
  const sauverFiches = () => store.ecrire(CLE_FICHES, fiches);

  /* Certains cadres d'affichage bloquent les fenêtres de confirmation :
     on n'empêche pas une action anodine, on renonce à une action destructrice. */
  function confirmer(question, defautSiBloque) {
    try {
      const reponse = window.confirm(question);
      return typeof reponse === 'boolean' ? reponse : defautSiBloque;
    } catch (e) { return defautSiBloque; }
  }

  /* ---------- composants de formulaire ------------------------------------- */
  function lier(input, cle, apres) {
    input.value = fiche[cle] == null ? '' : fiche[cle];
    input.addEventListener('input', () => {
      fiche[cle] = input.value;
      sauverBrouillon();
      rafraichir();
      if (apres) apres(input.value);
    });
    return input;
  }

  function champ(libelle, cle, opts) {
    const o = opts || {};
    let input;
    if (o.type === 'textarea') input = el('textarea', { rows: o.rows || 3, placeholder: o.placeholder || '' });
    else if (o.type === 'select') {
      input = el('select', {}, ...o.options.map((opt) => el('option', { value: opt.value }, opt.label)));
    } else input = el('input', { type: o.type || 'text', placeholder: o.placeholder || '', inputMode: o.inputMode || null, autocomplete: 'off' });
    lier(input, cle, o.apres);
    return el('label', { class: 'field' + (o.full ? ' full' : '') },
      el('span', {}, libelle, o.hint ? el('span', { class: 'hint' }, ' — ' + o.hint) : null),
      input);
  }

  function segment(libelle, cle, options, apres) {
    const boutons = options.map((opt) => el('button', {
      type: 'button',
      class: fiche[cle] === opt.value ? 'on' : '',
      onclick() {
        fiche[cle] = opt.value;
        for (const b of boutons) b.className = '';
        this.className = 'on';
        sauverBrouillon();
        if (apres) apres(opt.value); else rafraichir();
      },
    }, opt.label));
    return el('label', { class: 'field' }, el('span', {}, libelle), el('div', { class: 'segment' }, ...boutons));
  }

  function bascule(titre, sousTitre, cle, apres) {
    const input = el('input', { type: 'checkbox', checked: !!fiche[cle] });
    const wrap = el('label', { class: 'choice' + (fiche[cle] ? ' on' : '') }, input,
      el('div', {}, el('b', {}, titre), sousTitre ? el('small', {}, sousTitre) : null));
    input.addEventListener('change', () => {
      fiche[cle] = input.checked;
      wrap.className = 'choice' + (input.checked ? ' on' : '');
      sauverBrouillon();
      if (apres) apres(input.checked); else rafraichir();
    });
    return wrap;
  }

  /* ---------- lecture de la plaque par l'IA --------------------------------
     Disponible quand la page est ouverte depuis claude.ai : la photo est
     envoyée à Claude qui renvoie les champs. Demande une connexion, et le
     premier usage demande l'accord de l'utilisateur. */
  const analyse = { capacite: undefined, enCours: false, message: '', erreur: false,
    plateforme: false, lecture: false, images: false, texte: null, raison: '' };
  let photoAnalyse = '';   // copie plus fine, uniquement pour la lecture

  /* La sonde est partagée : tant qu'elle n'a pas répondu, tout appelant attend
     la même promesse. Renvoyer null pendant l'attente ferait croire à tort que
     la lecture est indisponible. */
  let sondeCapacite = null;

  function capaciteAnalyse() {
    if (sondeCapacite) return sondeCapacite;
    sondeCapacite = (async () => {
      if (typeof window.claude === 'undefined' || typeof window.claude.use !== 'function') {
        analyse.raison = 'page ouverte hors de Claude';
        return null;
      }
      analyse.plateforme = true;
      let sample = null;
      try {
        sample = await window.claude.use('sample');
      } catch (e) {
        analyse.raison = 'lecture refusée par la plateforme';
        return null;
      }
      if (!sample) {
        analyse.raison = 'lecture non servie dans cette vue';
        return null;
      }
      analyse.lecture = true;
      let limites = null;
      try {
        limites = await sample.limits();
      } catch (e) {
        analyse.raison = 'limites indisponibles';
        return null;
      }
      if (!limites || !limites.images) {
        // La lecture de texte reste possible : c'est la voie de repli.
        analyse.texte = sample;
        analyse.raison = 'cette vue ne peut pas envoyer de photo';
        return null;
      }
      analyse.images = true;
      analyse.texte = sample;
      return sample;
    })().then((valeur) => {
      analyse.capacite = valeur;
      return valeur;
    }).catch(() => {
      analyse.capacite = null;
      analyse.raison = analyse.raison || 'erreur inattendue';
      return null;
    });
    return sondeCapacite;
  }

  function invitePlaque() {
    const codes = KezLogic.FLUIDES.map((f) => f.code).join(', ');
    return [
      "Tu lis la plaque signalétique d'un équipement de climatisation ou de pompe à chaleur",
      "sur la photo jointe.",
      '',
      "Réponds uniquement par un objet JSON, sans texte autour, avec exactement ces clés :",
      '{"marque": string|null, "modele": string|null, "serie": string|null, "fluide": string|null, "chargeKg": string|null, "lisible": true|false}',
      '',
      "- marque : le fabricant (Daikin, Hitachi, Mitsubishi Electric, Toshiba, Fujitsu, Atlantic, Airwell…).",
      "- modele : la référence commerciale exacte telle qu'imprimée (MODEL, MODÈLE, TYPE).",
      "- serie : le numéro de série (SERIAL NO, S/N, N° DE SÉRIE).",
      "- fluide : le code du fluide frigorigène, obligatoirement l'un de ceux-ci : " + codes + ".",
      "  Si le code lu n'est pas dans cette liste, ou si aucun code n'apparaît, renvoie null.",
      "- chargeKg : la charge en kilogrammes, nombre décimal avec un point (exemple \"2.45\").",
      "  Convertis si la plaque indique des grammes. Renvoie null si la charge n'apparaît pas.",
      "- lisible : false si la photo est floue, coupée, ou ne montre pas une plaque signalétique.",
      '',
      "N'invente aucune valeur : mets null pour tout ce que tu ne lis pas clairement sur l'image.",
    ].join('\n');
  }

  const MESSAGES_IA = {
    not_granted: "Lecture automatique refusée. Tu peux saisir les valeurs ou coller le texte de la plaque.",
    sampling_disabled: "Lecture automatique indisponible sur ce compte.",
    not_declared: "Lecture automatique indisponible ici.",
    capability_disabled: "Lecture automatique indisponible ici.",
    capability_removed: "Lecture automatique indisponible ici.",
    images_unavailable: "Cette version ne peut pas envoyer de photo à analyser.",
    image_rejected: "Photo refusée : format non reconnu ou fichier trop lourd.",
    rate_limited: "Trop de demandes d'affilée. Réessaie dans un instant.",
    session_expired: "Session expirée : reconnecte-toi puis réessaie.",
    refused: "Lecture impossible sur cette photo.",
    empty_completion: "Rien n'a pu être lu sur cette photo.",
    invalid_json: "Réponse illisible. Réessaie, ou colle le texte de la plaque.",
    prompt_too_large: "Photo trop volumineuse à analyser.",
    upstream_error: "Connexion perdue pendant la lecture. Réessaie.",
  };

  function dataUrlVersBlob(dataUrl) {
    const morceaux = String(dataUrl || '').split(',');
    if (morceaux.length < 2) return null;
    const type = (morceaux[0].match(/:(.*?);/) || [null, 'image/jpeg'])[1];
    return new Blob([KezPdf.b64ToBytes(morceaux[1])], { type });
  }

  function annoncerAnalyse(message, erreur) {
    analyse.message = message;
    analyse.erreur = !!erreur;
    majEtatAnalyse();
  }

  function majEtatSortie() {
    const zone = document.getElementById('etat-sortie');
    if (!zone) return;
    zone.textContent = '';
    if (!sortie.dansClaude || sortie.capacite === undefined) return;
    if (sortie.capacite) {
      zone.appendChild(el('div', { class: 'panel accent' },
        el('p', { class: 'muted', style: 'margin:0;color:inherit' },
          "Le PDF sera proposé à l'enregistrement : Fichiers, Mail, ou la messagerie de ton choix.")));
    } else {
      zone.appendChild(el('div', { class: 'panel warn' },
        el('p', { class: 'muted', style: 'margin:0' },
          "Cette vue ne peut pas enregistrer de fichier : le PDF ne pourra pas sortir d'ici. "
          + "Ouvre la page dans l'app Claude, ou utilise la version installée sur ton domaine.")));
    }
  }

  function majEtatAnalyse() {
    const zone = document.getElementById('etat-analyse');
    if (!zone) return;
    zone.textContent = '';

    // Ligne permanente : l'utilisateur sait avant même de photographier.
    let etat, ton;
    if (analyse.capacite === undefined) { etat = 'Lecture automatique : vérification…'; ton = ''; }
    else if (analyse.capacite) { etat = 'Lecture automatique disponible : la photo sera lue toute seule.'; ton = ' accent'; }
    else if (analyse.texte) {
      etat = "Cette vue ne peut pas envoyer la photo à analyser. En revanche, colle le texte "
        + "de la plaque plus bas (iPhone : appareil photo, sélectionner le texte, copier) : "
        + "il sera analysé automatiquement, lui.";
      ton = ' accent';
    } else {
      etat = 'Lecture automatique indisponible : ' + (analyse.raison || 'raison inconnue')
        + '. Colle le texte de la plaque plus bas.';
      ton = ' warn';
    }
    const bloc = el('div', { class: 'panel' + ton },
      el('p', { class: 'muted', style: 'margin:0;color:inherit' }, etat));
    if (analyse.capacite === null) {
      bloc.appendChild(el('p', { class: 'tiny', style: 'margin:6px 0 0' },
        'Diagnostic — plateforme : ' + (analyse.plateforme ? 'oui' : 'non')
        + ' · lecture : ' + (analyse.lecture ? 'oui' : 'non')
        + ' · photos : ' + (analyse.images ? 'oui' : 'non')));
    }
    zone.appendChild(bloc);

    if (analyse.enCours) {
      zone.appendChild(el('div', { class: 'panel accent', style: 'margin-top:8px' },
        el('p', { class: 'muted', style: 'margin:0;color:inherit' }, 'Lecture de la plaque en cours…')));
    } else if (analyse.message) {
      zone.appendChild(el('div', { class: 'panel' + (analyse.erreur ? ' warn' : ''), style: 'margin-top:8px' },
        el('p', { class: 'muted', style: 'margin:0' }, analyse.message)));
    }
  }

  /** Envoie la photo à Claude et reprend les champs reconnus. */
  async function lirePlaque(forcer) {
    const sample = await capaciteAnalyse();
    if (!sample) {
      annoncerAnalyse("Lecture automatique indisponible sur cette version : colle le texte de la plaque ci-dessous.", true);
      return;
    }
    const image = dataUrlVersBlob(photoAnalyse || fiche.photo);
    if (!image) return;

    analyse.enCours = true;
    analyse.message = '';
    analyse.erreur = false;
    majEtatAnalyse();

    try {
      const lu = await sample.json(invitePlaque(), {
        images: image,
        modelTier: 'default',
        cache: forcer ? false : true,
      });
      const repris = appliquerLecture(lu);
      analyse.enCours = false;
      if (!repris.length) {
        analyse.message = (lu && lu.lisible === false)
          ? "Photo trop floue ou pas une plaque signalétique. Reprends la photo bien à plat."
          : "Rien n'a pu être lu sur cette photo. Saisis les valeurs à la main.";
        analyse.erreur = true;
        majEtatAnalyse();
        return;
      }
      analyse.message = 'Repris de la photo : ' + repris.join(', ') + '. Vérifie chaque valeur.';
      analyse.erreur = false;
      construire();
    } catch (erreur) {
      analyse.enCours = false;
      const code = erreur && erreur.code;
      if (code === 'cancelled') { majEtatAnalyse(); return; }
      analyse.message = MESSAGES_IA[code] || "Lecture impossible pour le moment. Réessaie ou colle le texte de la plaque.";
      analyse.erreur = true;
      majEtatAnalyse();
    }
  }

  /* Seconde voie d'import : coller une image copiée. Utile si le sélecteur de
     fichiers est bloqué par l'application qui affiche la page. */
  function imageDuPressePapiers(event) {
    const items = (event.clipboardData && event.clipboardData.items) || [];
    for (const item of items) {
      if (item.kind === 'file' && String(item.type).startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    return null;
  }

  function inviteTexte(texte) {
    const codes = KezLogic.FLUIDES.map((f) => f.code).join(', ');
    return [
      "Voici le texte relevé sur la plaque signalétique d'un équipement de climatisation",
      "ou de pompe à chaleur. Il peut être en désordre, mal découpé, ou présenté en tableau.",
      '',
      '--- début du texte ---',
      String(texte).slice(0, 4000),
      '--- fin du texte ---',
      '',
      "Réponds uniquement par un objet JSON, sans texte autour, avec exactement ces clés :",
      '{"marque": string|null, "modele": string|null, "serie": string|null, "fluide": string|null, "chargeKg": string|null, "lisible": true|false}',
      '',
      '- marque : le fabricant.',
      "- modele : la référence commerciale exacte (MODEL, MODÈLE, TYPE).",
      '- serie : le numéro de série (SERIAL NO, S/N, N° DE SÉRIE).',
      '- fluide : le code du fluide, obligatoirement parmi : ' + codes + ". Sinon null.",
      '- chargeKg : la charge en kilogrammes, nombre décimal avec un point. Convertis les grammes.',
      "- lisible : false si ce texte ne ressemble pas à une plaque signalétique.",
      '',
      "N'invente rien : null pour tout ce qui n'apparaît pas dans le texte.",
    ].join('\n');
  }

  /** Reprend les champs d'un objet renvoyé par l'IA. Renvoie les noms repris. */
  function appliquerLecture(lu) {
    const valeur = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
    const repris = [];
    const modifications = {};
    if (valeur(lu && lu.marque)) { modifications.marque = valeur(lu.marque); repris.push('marque'); }
    if (valeur(lu && lu.modele)) { modifications.modele = valeur(lu.modele); repris.push('modèle'); }
    if (valeur(lu && lu.serie)) { modifications.serie = valeur(lu.serie); repris.push('n° de série'); }
    const fluide = KezLogic.fluidOf(valeur(lu && lu.fluide));
    if (fluide) { modifications.fluide = fluide.code; repris.push('fluide'); }
    const charge = valeur(lu && lu.chargeKg).replace(',', '.');
    if (charge && Number.isFinite(parseFloat(charge))) {
      modifications.charge = charge.replace('.', ',');
      repris.push('charge');
    }
    if (repris.length) { Object.assign(fiche, modifications); sauverBrouillon(); }
    return repris;
  }

  /* ---------- lecture de plaque à partir d'un texte ------------------------- */
  const MARQUES = ['MITSUBISHI ELECTRIC', 'MITSUBISHI HEAVY', 'MITSUBISHI', 'DAIKIN', 'HITACHI', 'TOSHIBA',
    'FUJITSU', 'GENERAL', 'PANASONIC', 'SAMSUNG', 'ATLANTIC', 'CARRIER', 'AIRWELL', 'AIRTON', 'CIAT',
    'CLIVET', 'AERMEC', 'LENNOX', 'TRANE', 'HAIER', 'MIDEA', 'GREE', 'HISENSE', 'SAUNIER DUVAL',
    'DE DIETRICH', 'VIESSMANN', 'VAILLANT', 'BOSCH', 'NIBE', 'STIEBEL ELTRON', 'THERMOR', 'ARISTON', 'LG'];

  function analyserPlaque(texte) {
    const brut = String(texte || '').toUpperCase();
    const compact = brut.replace(/\s+/g, ' ');
    const lignes = brut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const marque = MARQUES.find((m) => compact.includes(m)) || '';

    const fluideMatch = compact.match(/R\s*-?\s*(1234\s*YF|1234\s*ZE|410\s*A|407\s*[CF]|404\s*A|448\s*A|449\s*A|452\s*B|454\s*[BC]|513\s*A|427\s*A|422\s*D|134\s*A|744|290|32|22)\b/);
    let fluide = '';
    if (fluideMatch) {
      const code = 'R' + fluideMatch[1].replace(/\s+/g, '');
      const trouve = KezLogic.fluidOf(code);
      fluide = trouve ? trouve.code : '';
    }

    let charge = '';
    const etiquette = compact.match(/(?:CHARGE|REFRIGERANT|REFRIG|FLUIDE|GAS|GWP|AMOUNT)[^0-9]{0,32}([0-9]+(?:[.,][0-9]+)?)\s*(KG|G)\b/);
    const brutKg = compact.match(/([0-9]+[.,][0-9]+)\s*KG\b/);
    const brutG = compact.match(/([0-9]{2,5})\s*G\b/);
    if (etiquette) {
      const valeur = parseFloat(etiquette[1].replace(',', '.'));
      charge = etiquette[2] === 'G' ? (valeur / 1000).toFixed(3) : String(valeur);
    } else if (brutKg) charge = brutKg[1].replace(',', '.');
    else if (brutG) charge = (parseInt(brutG[1], 10) / 1000).toFixed(3);

    const parLigne = (regex) => {
      for (const ligne of lignes) {
        const m = ligne.match(regex);
        if (m && m[1]) return m[1].replace(/^[.:#\s-]+/, '').trim();
      }
      return '';
    };
    const modele = parLigne(/(?:MODEL(?:E|\.|\sNO\.?|\sNAME)?|MODÈLE|TYPE|MOD\.)[^A-Z0-9]{0,10}([A-Z0-9][A-Z0-9/._-]{3,})/);
    const serie = parLigne(/(?:SERIAL(?:\sNO\.?|\sNUMBER)?|S\/?N|SÉRIE|SERIE|PRODUCT\sNO\.?)[^A-Z0-9]{0,10}([A-Z0-9][A-Z0-9/._-]{3,})/);

    return { marque, modele, serie, fluide, charge };
  }

  /* ---------- images -------------------------------------------------------- */
  function chargerImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image illisible'));
      img.src = src;
    });
  }

  function lireFichier(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('lecture impossible'));
      reader.readAsDataURL(file);
    });
  }

  /* Décodage tolérant : createImageBitmap gère l'orientation et davantage de
     formats ; l'URL d'objet évite de charger un énorme base64 en mémoire. */
  async function decoderImage(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap && bitmap.width) return bitmap;
      } catch (e) { /* on tente la voie classique */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await chargerImage(url);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  }

  function versJpeg(source, maxCote, qualite) {
    const largeur = source.width, hauteur = source.height;
    if (!largeur || !hauteur) throw new Error('image de taille nulle');
    const ratio = Math.min(1, maxCote / Math.max(largeur, hauteur));
    const canvas = el('canvas', {
      width: Math.max(1, Math.round(largeur * ratio)),
      height: Math.max(1, Math.round(hauteur * ratio)),
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponible');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const sortie = canvas.toDataURL('image/jpeg', qualite);
    if (!sortie || sortie.length < 200) throw new Error('conversion impossible');
    return sortie;
  }

  async function reduireImage(dataUrl, maxCote, qualite) {
    return versJpeg(await chargerImage(dataUrl), maxCote, qualite);
  }

  function dataUrlVersOctets(dataUrl) {
    const base64 = String(dataUrl || '').split(',')[1];
    return base64 ? KezPdf.b64ToBytes(base64) : new Uint8Array(0);
  }

  /* ---------- pad de signature --------------------------------------------- */
  function padSignature(libelle, cle) {
    const canvas = el('canvas', { width: 960, height: 300 });
    const ctx = canvas.getContext('2d');
    let dessine = false, vide = true;

    const fond = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
    fond();

    if (fiche[cle]) {
      chargerImage(fiche[cle]).then((img) => {
        const ratio = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.92;
        const w = img.width * ratio, h = img.height * ratio;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        vide = false;
      }).catch(() => {});
    }

    const point = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - rect.left) * (canvas.width / rect.width),
        y: (ev.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    canvas.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      dessine = true; vide = false;
      const p = point(ev);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1a2a';
      ctx.stroke();
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!dessine) return;
      ev.preventDefault();
      const p = point(ev);
      ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1a2a';
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    const fin = () => {
      if (!dessine) return;
      dessine = false;
      fiche[cle] = vide ? '' : rogner(canvas);
      sauverBrouillon();
    };
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('pointerleave', fin);

    const effacer = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fond(); vide = true; fiche[cle] = ''; sauverBrouillon();
    };

    return el('div', { class: 'sign' },
      el('header', {}, el('b', {}, libelle), el('button', { type: 'button', onclick: effacer }, 'Effacer')),
      canvas,
      el('p', {}, 'Signer avec le doigt ou un stylet'));
  }

  /** Recadre la signature sur son tracé puis exporte en JPEG. */
  function rogner(canvas) {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return '';
    const marge = 10;
    minX = Math.max(0, minX - marge); minY = Math.max(0, minY - marge);
    maxX = Math.min(canvas.width - 1, maxX + marge); maxY = Math.min(canvas.height - 1, maxY + marge);
    const out = el('canvas', { width: maxX - minX + 1, height: maxY - minY + 1 });
    const octx = out.getContext('2d');
    octx.fillStyle = '#ffffff'; octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.92);
  }
