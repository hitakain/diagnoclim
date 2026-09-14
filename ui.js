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

  /* ---------- étapes -------------------------------------------------------- */
  const ETAPES = ['Client', 'Équipement', 'Intervention', 'Fluide', 'Signatures'];

  function etapeEquipement() {
    const apercu = el('div', { class: 'photo' },
      fiche.photo ? el('img', { src: fiche.photo, alt: 'Plaque signalétique' })
        : el('div', { class: 'ph' }, 'Photo de la plaque signalétique', el('br'), el('small', {}, 'conservée avec la fiche')));

    const prendre = async (ev) => {
      const file = ev.currentTarget.files && ev.currentTarget.files[0];
      ev.currentTarget.value = '';
      if (file) await importerPhoto(file);
    };

    const importerPhoto = async (file) => {
      analyse.enCours = false;
      annoncerAnalyse('Ouverture de la photo…', false);

      let image;
      try {
        image = await decoderImage(file);
      } catch (e) {
        const nom = (file.name || '').toLowerCase();
        annoncerAnalyse(
          /\.hei[cf]$/.test(nom) || /hei[cf]/.test(file.type || '')
            ? "Photo au format HEIC, que ce navigateur ne sait pas ouvrir. Sur l'iPhone : Réglages > Appareil photo > Formats > Le plus compatible, puis reprends la photo."
            : "Photo illisible (" + (file.type || 'format inconnu') + '). Essaie une autre photo ou reprends-la avec l\'appareil photo.',
          true);
        return;
      }

      try {
        fiche.photo = versJpeg(image, 1100, 0.62);
        photoAnalyse = versJpeg(image, 1400, 0.9);
      } catch (e) {
        annoncerAnalyse('Photo trop grande pour cet appareil : reprends-la en résolution plus basse.', true);
        return;
      }
      if (image.close) { try { image.close(); } catch (e) { /* rien */ } }

      if (!sauverBrouillon()) {
        annoncerAnalyse("Mémoire du navigateur pleine : la photo n'est pas conservée. Exporte ta sauvegarde depuis Fiches.", true);
      }
      apercu.textContent = '';
      apercu.appendChild(el('img', { src: fiche.photo, alt: 'Plaque signalétique' }));

      const sample = await capaciteAnalyse();
      construire();
      if (sample) {
        void lirePlaque(false);
      } else {
        annoncerAnalyse(
          "Photo enregistrée. La lecture automatique n'est disponible que sur la version publiée en ligne : "
          + 'ici, colle le texte de la plaque ci-dessous.',
          false);
      }
    };

    const texte = el('textarea', { rows: 3, placeholder: "Coller ici le texte de la plaque (iPhone : appareil photo → sélectionner le texte → copier)" });
    const analyser = async () => {
      const contenu = texte.value.trim();
      if (!contenu) { annoncerAnalyse('Colle d\'abord le texte de la plaque.', true); return; }

      await capaciteAnalyse();

      // Quand la lecture est disponible, c'est Claude qui structure le texte :
      // il encaisse le désordre, les tableaux et les découpages approximatifs.
      if (analyse.texte) {
        analyse.enCours = true;
        annoncerAnalyse('', false);
        try {
          const lu = await analyse.texte.json(inviteTexte(contenu), { modelTier: 'default' });
          analyse.enCours = false;
          const repris = appliquerLecture(lu);
          if (!repris.length) {
            annoncerAnalyse((lu && lu.lisible === false)
              ? "Ce texte ne ressemble pas à une plaque signalétique."
              : "Rien d'exploitable dans ce texte.", true);
            return;
          }
          analyse.message = 'Repris du texte : ' + repris.join(', ') + '. Vérifie chaque valeur.';
          analyse.erreur = false;
          construire();
          return;
        } catch (erreur) {
          analyse.enCours = false;
          const code = erreur && erreur.code;
          if (code !== 'cancelled') {
            annoncerAnalyse((MESSAGES_IA[code] || 'Lecture impossible pour le moment.')
              + ' Analyse simple appliquée.', true);
          }
        }
      }

      // Repli sans IA : reconnaissance par motifs.
      const res = analyserPlaque(contenu);
      const touches = [];
      for (const [cle, brut] of Object.entries(res)) {
        if (!brut) continue;
        fiche[cle] = cle === 'charge' ? String(brut).replace('.', ',') : brut;
        touches.push(cle);
      }
      if (!touches.length) { annoncerAnalyse('Rien de reconnu dans ce texte.', true); return; }
      sauverBrouillon();
      analyse.message = 'Repris du texte : ' + touches.join(', ') + '. Vérifie chaque valeur.';
      analyse.erreur = false;
      construire();
    };

    // La disponibilité de la lecture est vérifiée dès l'ouverture de l'étape,
    // pas seulement au moment de la photo : l'utilisateur sait à quoi s'attendre.
    if (analyse.capacite === undefined) {
      capaciteAnalyse().then(() => construire()).catch(() => majEtatAnalyse());
    }
    apercu.__importer = (file) => importerPhoto(file);

    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Scanner la plaque'),
        el('p', {}, 'Photographie la plaque : les champs se remplissent juste en dessous.'),
        el('div', { class: 'photo-actions' },
          el('label', { class: 'filebtn' }, 'Prendre une photo',
            el('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: prendre })),
          el('label', { class: 'filebtn' }, 'Choisir une photo',
            el('input', { type: 'file', accept: 'image/*', onchange: prendre }))),
        el('div', { style: 'margin-top:10px' }, apercu),
        el('div', { id: 'etat-analyse', style: 'margin-top:10px' }),
        fiche.photo && analyse.capacite
          ? el('button', {
              type: 'button', class: 'btn block', style: 'margin-top:8px',
              disabled: analyse.enCours,
              onclick: () => { void lirePlaque(true); },
            }, analyse.enCours ? 'Lecture en cours…' : 'Relire la photo')
          : null,
        el('button', {
          type: 'button', class: 'btn block', style: 'margin-top:8px',
          onclick: async () => {
            try {
              if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('indisponible');
              const elements = await navigator.clipboard.read();
              for (const item of elements) {
                const type = item.types.find((t) => t.startsWith('image/'));
                if (type) { await importerPhoto(new File([await item.getType(type)], 'plaque', { type })); return; }
              }
              annoncerAnalyse("Aucune image dans le presse-papiers : copie d'abord la photo, puis reviens ici.", true);
            } catch (e) {
              annoncerAnalyse("Ce navigateur ne permet pas de coller une image. Utilise les deux boutons ci-dessus.", true);
            }
          },
        }, 'Coller une image copiée'),
        el('div', { class: 'legend' }, 'Ou coller le texte de la plaque'),
        el('button', {
          type: 'button', class: 'btn dark block',
          onclick: async () => {
            try {
              if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('indisponible');
              const contenu = await navigator.clipboard.readText();
              if (!contenu || !contenu.trim()) {
                annoncerAnalyse('Le presse-papiers est vide : lance d\'abord le raccourci qui lit la plaque.', true);
                return;
              }
              texte.value = contenu;
              await analyser();
            } catch (e) {
              annoncerAnalyse("Ce navigateur ne permet pas de lire le presse-papiers. Colle le texte à la main dans le cadre ci-dessous.", true);
            }
          },
        }, 'Coller le texte copié et analyser'),
        el('p', { class: 'tiny', style: 'margin:8px 0 10px' },
          'Après le raccourci iPhone qui lit la plaque : un appui ici et les champs se remplissent.'),
        texte,
        el('button', { type: 'button', class: 'btn block', style: 'margin-top:8px',
          onclick: () => { void analyser(); } }, 'Analyser le texte ci-dessus')),

      el('div', { class: 'card' },
        el('h2', {}, 'Équipement'),
        el('p', {}, 'Vérifie chaque valeur avant de continuer.'),

        el('div', { class: 'legend' }, 'Modèle'),
        el('div', { class: 'grid two' },
          champ('Marque', 'marque', { placeholder: 'Ex. Fujitsu' }),
          champ('Modèle', 'modele', { placeholder: 'Ex. WOYA060KLT' })),

        el('div', { class: 'legend' }, 'Numéro de série'),
        champ('N° de série', 'serie', { placeholder: 'Ex. T194348' }),

        el('div', { class: 'legend' }, 'Gaz'),
        el('div', { class: 'grid two' },
          champ('Fluide frigorigène', 'fluide', {
            type: 'select',
            options: KezLogic.FLUIDES.map((f) => ({ value: f.code, label: f.nom + '  (PRG ' + f.prg + ')' })),
          }),
          champ('Charge totale (kg)', 'charge', { type: 'text', inputMode: 'decimal',
            hint: 'après intervention', placeholder: 'Ex. 0,970' })),

        el('div', { class: 'legend' }, 'Emplacement'),
        champ('Localisation', 'localisation', { hint: 'facultatif', placeholder: 'Ex. Local technique, toiture bâtiment A' })),

      el('div', { class: 'card' },
        el('h2', {}, 'Lecture réglementaire'),
        el('div', { id: 'reglementaire' })));
  }

  function etapeClient() {
    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Mon entreprise'),
        el('p', {}, "Cadre [1] du CERFA. Repris de tes réglages, à vérifier d'un coup d'œil."),
        el('div', { class: 'grid two' },
          champ('N° de fiche', 'ficheNo', { placeholder: '2026-001' }),
          champ("Date de l'intervention", 'dateIntervention', { type: 'date' }),
          champ('Raison sociale', 'operateurNom', { full: true, placeholder: 'KEZ Énergie' }),
          champ('Adresse', 'operateurAdresse', { type: 'textarea', rows: 2, full: true }),
          champ('SIRET', 'operateurSiret', { placeholder: '000 000 000 00000' }),
          champ("N° d'attestation de capacité", 'attestationNo', { placeholder: 'Ex. AC-31-2027-0001' })),
        el('p', { class: 'tiny', style: 'margin:10px 0 0' },
          'Ces valeurs se règlent une fois pour toutes dans Réglages.')),

      el('div', { class: 'card' },
        el('h2', {}, 'Client'),
        el('p', {}, 'Le détenteur de l\'équipement — cadre [2] du CERFA.'),
        el('div', { class: 'grid two' },
          champ('Nom ou raison sociale', 'detenteurNom', { full: true, placeholder: 'Nom, prénom ou société' }),
          champ('Adresse', 'detenteurAdresse', { type: 'textarea', rows: 2, full: true,
            placeholder: "Adresse complète du lieu de l'équipement" }),
          champ('SIRET', 'detenteurSiret', { hint: 'si professionnel', placeholder: '000 000 000 00000' }))));
  }

  function etapeIntervention() {
    const casesNature = KezLogic.NATURES.map((nature) => {
      const input = el('input', { type: 'checkbox', checked: fiche.natures.includes(nature.id) });
      const wrap = el('label', { class: 'choice' + (input.checked ? ' on' : '') }, input, el('div', {}, nature.libelle));
      input.addEventListener('change', () => {
        if (input.checked) { if (!fiche.natures.includes(nature.id)) fiche.natures.push(nature.id); }
        else fiche.natures = fiche.natures.filter((n) => n !== nature.id);
        wrap.className = 'choice' + (input.checked ? ' on' : '');
        if (nature.id.startsWith('controle') && input.checked && !fiche.controleEtancheite) {
          fiche.controleEtancheite = true;
          fiche.controleDate = fiche.controleDate || fiche.dateIntervention;
          construire();
        }
        sauverBrouillon(); rafraichir();
      });
      return wrap;
    });

    const zoneControle = el('div', {});
    const remplirControle = () => {
      zoneControle.textContent = '';
      if (!fiche.controleEtancheite) return;
      zoneControle.appendChild(el('div', { class: 'grid two', style: 'margin-top:12px' },
        champ('Détecteur manuel de fuite [5]', 'detecteurId', { full: true, placeholder: 'Marque, modèle, n° de série, date d\'étalonnage' }),
        champ('Contrôlé le [5]', 'controleDate', { type: 'date' })));
      zoneControle.appendChild(el('div', { class: 'legend' }, 'Fuites constatées [10]'));
      zoneControle.appendChild(segment('Fuite constatée lors du contrôle', 'fuiteConstatee',
        [{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }], () => construire()));
      if (fiche.fuiteConstatee === 'oui') {
        for (let i = 0; i < 3; i++) {
          const fuite = fiche.fuites[i] || (fiche.fuites[i] = { loca: '', rep: '' });
          const loca = el('input', { type: 'text', value: fuite.loca, placeholder: 'Localisation de la fuite ' + (i + 1) });
          loca.addEventListener('input', () => { fuite.loca = loca.value; sauverBrouillon(); });
          const seg = ['', 'realisee', 'afaire'].map((valeur) => el('button', {
            type: 'button', class: fuite.rep === valeur ? 'on' : '',
            onclick(ev) {
              fuite.rep = valeur;
              for (const b of ev.currentTarget.parentNode.children) b.className = '';
              ev.currentTarget.className = 'on';
              sauverBrouillon();
            },
          }, valeur === '' ? '—' : valeur === 'realisee' ? 'Réparée' : 'À faire'));
          zoneControle.appendChild(el('div', { class: 'field', style: 'margin-top:10px' },
            loca, el('div', { class: 'segment', style: 'margin-top:6px' }, ...seg)));
        }
      }
    };
    remplirControle();

    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, "Nature de l'intervention"),
        el('p', {}, 'Une ou plusieurs cases, comme sur le formulaire papier.'),
        el('div', { class: 'choices' }, ...casesNature),
        fiche.natures.includes('autre')
          ? el('div', { style: 'margin-top:10px' }, champ('Préciser', 'autrePrecision', { placeholder: 'Nature de l\'intervention' }))
          : null),
      el('div', { class: 'card' },
        el('h2', {}, "Contrôle d'étanchéité"),
        el('p', {}, 'Détection permanente, détecteur utilisé et fuites relevées.'),
        segment('Système permanent de détection de fuites [6]', 'detecteurPermanent',
          [{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]),
        el('div', { style: 'margin-top:12px' },
          bascule("Un contrôle d'étanchéité a été réalisé", 'Renseigne les cadres [5] et [10] du CERFA', 'controleEtancheite', () => construire())),
        zoneControle),
      el('div', { class: 'card' }, el('h2', {}, 'Lecture réglementaire'), el('div', { id: 'reglementaire' })));
  }

  function etapeFluide() {
    const zone = el('div', {});
    if (fiche.manipulation) {
      zone.appendChild(el('div', { class: 'legend' }, 'Fluide chargé [11]'));
      zone.appendChild(el('div', { class: 'grid two' },
        champ('A — fluide vierge (kg)', 'qteVierge', { inputMode: 'decimal', placeholder: '0,000' }),
        champ('B — fluide recyclé (kg)', 'qteRecycle', { inputMode: 'decimal', placeholder: '0,000' }),
        champ('C — fluide régénéré (kg)', 'qteRegenere', { inputMode: 'decimal', placeholder: '0,000' }),
        champ('Dénomination si changement de fluide', 'denomChange', { placeholder: 'Ex. R32 en remplacement de R410A' })));
      zone.appendChild(el('div', { class: 'legend' }, 'Fluide récupéré [11]'));
      zone.appendChild(el('div', { class: 'grid two' },
        champ('D — destiné au traitement (kg)', 'qteTraitement', { inputMode: 'decimal', placeholder: '0,000' }),
        champ('E — conservé pour réintroduction (kg)', 'qteReutilisation', { inputMode: 'decimal', placeholder: '0,000' }),
        champ('Identification du ou des contenants', 'contenants', { placeholder: 'N° de bouteille de récupération' }),
        champ('N° de BSFF (Trackdéchets)', 'bsff', { hint: 'si connu', placeholder: 'FR-BSFF-…' })));
      zone.appendChild(el('div', { class: 'legend' }, 'Destination du fluide récupéré [13]'));
      zone.appendChild(champ("Installation prévue de destination", 'installDestination',
        { type: 'textarea', rows: 2, placeholder: 'Nom, SIRET et adresse du centre de traitement' }));
      zone.appendChild(el('div', { id: 'bilanFluide', style: 'margin-top:12px' }));
    }

    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Manipulation du fluide'),
        el('p', {}, 'Les quantités du cadre [11] et la dénomination ADR/RID du cadre [12].'),
        bascule("J'ai chargé ou récupéré du fluide", 'Appoint, recharge, tirage, récupération', 'manipulation', () => construire()),
        zone),
      el('div', { class: 'card' },
        el('h2', {}, 'Observations [14]'),
        champ("Détail de l'intervention", 'observations', { type: 'textarea', rows: 5, placeholder: 'Travaux réalisés, relevés de pressions et températures, essais, pièces remplacées, conseils au client…' })));
  }

  function etapeSignatures() {
    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Signatures'),
        el('p', {}, "Les deux signataires attestent que l'opération a été effectuée."),
        el('div', { class: 'grid two' },
          champ('Nom du signataire opérateur', 'signOpNom'),
          champ('Qualité', 'signOpQualite'),
          champ('Nom du signataire détenteur', 'signDetNom', { placeholder: fiche.detenteurNom || 'Nom du client' }),
          champ('Qualité', 'signDetQualite')),
        el('div', { style: 'margin-top:14px;display:grid;gap:12px' },
          padSignature('Signature opérateur', 'signOpImg'),
          padSignature('Signature détenteur', 'signDetImg'))),
      el('div', { class: 'card' },
        el('h2', {}, 'Vérification'),
        el('div', { id: 'etat-sortie', style: 'margin-bottom:10px' }),
        el('div', { id: 'verification' }),
        el('button', { type: 'button', class: 'btn primary block', style: 'margin-top:14px', onclick: genererEtPartager },
          'Générer le CERFA PDF'),
        el('p', { class: 'tiny', style: 'margin:10px 0 0' },
          'Le PDF est produit sur l\'appareil, sans connexion. La fiche est enregistrée dans l\'historique.')));
  }

  /* ---------- panneaux dérivés ---------------------------------------------- */
  function rafraichir() {
    const zone = $('#reglementaire');
    if (zone) {
      const fluide = KezLogic.fluidOf(fiche.fluide);
      const teq = KezLogic.teqCO2(fiche);
      const s = KezLogic.seuils(fiche);
      const prochain = KezLogic.prochainControle(fiche);
      zone.textContent = '';
      zone.appendChild(el('div', { class: 'readout' },
        el('div', {}, el('span', {}, 'Tonnage éq. CO2'),
          el('strong', {}, teq.toFixed(3).replace('.', ',') + ' t'),
          el('small', {}, fluide ? 'PRG ' + fluide.prg + ' · ' + fluide.famille : '—')),
        el('div', {}, el('span', {}, 'Contrôle périodique'),
          el('strong', {}, s.controleObligatoire ? 'tous les ' + s.periode + ' mois' : 'non requis'),
          el('small', {}, s.controleObligatoire
            ? (fiche.detecteurPermanent === 'oui' && fluide && fluide.famille !== 'HCFC' ? 'avec détection permanente' : 'sans détection permanente')
            : 'sous le seuil réglementaire')),
        el('div', {}, el('span', {}, 'Prochaine échéance'),
          el('strong', {}, prochain || '—'),
          el('small', {}, prochain ? 'à compter de cette intervention' : 'renseigne la date'))));
      if (fluide && fluide.famille === 'AUTRE') {
        zone.appendChild(el('div', { class: 'panel', style: 'margin-top:10px' },
          el('p', { class: 'muted', style: 'margin:0' },
            fluide.nom + " n'est pas un gaz fluoré : ni seuil de contrôle d'étanchéité, ni cadre [7] à cocher. La fiche reste utile comme trace d'intervention.")));
      }
      if (s.controleObligatoire && fluide) {
        const bornes = s.base === 'teq'
          ? ['5 t ≤ teqCO2 < 50 t', '50 t ≤ teqCO2 < 500 t', 'teqCO2 ≥ 500 t']
          : fluide.famille === 'HCFC'
            ? ['2 kg ≤ Q < 30 kg', '30 kg ≤ Q < 300 kg', 'Q ≥ 300 kg']
            : ['1 kg ≤ Q < 10 kg', '10 kg ≤ Q < 100 kg', 'Q ≥ 100 kg'];
        zone.appendChild(el('div', { class: 'panel accent', style: 'margin-top:10px' },
          el('p', { class: 'muted', style: 'margin:0;color:inherit' },
            'Cadre [7] : ' + fluide.famille + ' — ' + bornes[s.niveau - 1] + '. Cadre [' +
            (fiche.detecteurPermanent === 'oui' && fluide.famille !== 'HCFC' ? '9' : '8') + '] : ' + s.periode + ' mois.')));
      }
    }

    const bilan = $('#bilanFluide');
    if (bilan) {
      const t = KezLogic.totaux(fiche);
      bilan.textContent = '';
      bilan.appendChild(el('div', { class: 'readout' },
        el('div', {}, el('span', {}, 'Chargé total (A+B+C)'), el('strong', {}, KezLogic.kg(t.chargee) + ' kg')),
        el('div', {}, el('span', {}, 'Récupéré total (D+E)'), el('strong', {}, KezLogic.kg(t.recuperee) + ' kg'))));
      const fluide = KezLogic.fluidOf(fiche.fluide);
      if (KezLogic.num(fiche.qteTraitement) > 0 && fluide) {
        bilan.appendChild(el('div', { class: 'panel accent', style: 'margin-top:10px' },
          el('p', { class: 'muted', style: 'margin:0;color:inherit' },
            'Cadre [12] coché automatiquement : ' + (fluide.inflammable
              ? 'UN 3161 — rubrique 16 05 04* (fluide inflammable)'
              : 'UN 1078 — rubrique 14 06 01* (fluide non inflammable)') + '.')));
      }
    }

    const verif = $('#verification');
    if (verif) {
      const { erreurs, avertissements } = KezLogic.validation(fiche);
      verif.textContent = '';
      if (erreurs.length) {
        verif.appendChild(el('div', { class: 'panel danger' },
          el('h3', {}, 'À compléter avant de générer'),
          el('ul', {}, ...erreurs.map((e) => el('li', {}, e)))));
      }
      if (avertissements.length) {
        verif.appendChild(el('div', { class: 'panel warn', style: erreurs.length ? 'margin-top:10px' : '' },
          el('h3', {}, 'À vérifier'),
          el('ul', {}, ...avertissements.map((a) => el('li', {}, a)))));
      }
      if (!erreurs.length && !avertissements.length) {
        verif.appendChild(el('div', { class: 'panel' },
          el('p', { class: 'muted', style: 'margin:0' }, 'Fiche complète. Tu peux générer le PDF.')));
      }
    }

    majEtatAnalyse();
    majEtatSortie();

    const etapes = document.querySelectorAll('#steps button');
    etapes.forEach((bouton, i) => {
      bouton.className = i === etape ? 'active' : i < etape ? 'done' : '';
    });
  }

  /* ---------- génération ---------------------------------------------------- */
  async function genererEtPartager() {
    const { erreurs } = KezLogic.validation(fiche);
    if (erreurs.length) { toast(erreurs[0], 'err'); return; }
    try {
      const signatures = {
        operateur: { bytes: dataUrlVersOctets(fiche.signOpImg) },
        detenteur: { bytes: dataUrlVersOctets(fiche.signDetImg) },
      };
      const octets = KezLogic.genererPdf(fiche, signatures);
      const nom = KezLogic.nomFichier(fiche);
      const blob = new Blob([octets], { type: 'application/pdf' });
      enregistrerFiche();
      await livrer(blob, nom);
    } catch (erreur) {
      console.error(erreur);
      toast('Génération impossible : ' + erreur.message, 'err');
    }
  }

  const estIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* Page publiée sur claude.ai : l'enregistrement passe par la plateforme.
     En fichier local, window.claude n'existe pas et on garde les voies
     habituelles (partage iOS, téléchargement). */
  /* Dans une page publiée, le PDF ne peut sortir que par la plateforme : le
     cadre d'affichage bloque les téléchargements ordinaires. On vérifie donc
     tôt, pour le dire avant que la fiche soit remplie pour rien. */
  const sortie = { capacite: undefined, dansClaude: false };
  let sondeSortie = null;

  function capaciteEnregistrement() {
    if (sondeSortie) return sondeSortie;
    sondeSortie = (async () => {
      if (typeof window.claude === 'undefined' || typeof window.claude.use !== 'function') return null;
      sortie.dansClaude = true;
      try { return await window.claude.use('downloads'); } catch (e) { return null; }
    })().then((v) => { sortie.capacite = v; return v; })
      .catch(() => { sortie.capacite = null; return null; });
    return sondeSortie;
  }

  async function livrer(blob, nom) {
    const plateforme = await capaciteEnregistrement();
    if (plateforme) {
      try {
        await plateforme.save({ filename: nom, data: blob });
        toast('Enregistré : ' + nom);
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') toast('Enregistrement annulé.');
        else if (code === 'rate_limited') toast('Une demande est déjà en cours, réessaie dans un instant.', 'err');
        else toast('Enregistrement impossible : ' + ((e && e.message) || 'erreur inconnue'), 'err');
      }
      return;
    }

    const file = new File([blob], nom, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nom });
        toast('CERFA généré.');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    if (estIOS()) {
      // iOS ignore l'attribut download : on ouvre le document, le partage se
      // fait ensuite depuis la visionneuse (Enregistrer dans Fichiers, Mail…).
      window.open(url, '_blank');
      toast('Document ouvert : utilise le bouton Partager pour l\'enregistrer.');
    } else {
      const lien = el('a', { href: url, download: nom });
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      toast('Fichier généré : ' + nom);
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  function enregistrerFiche() {
    const copie = JSON.parse(JSON.stringify(fiche));
    if (!reglages.garderPhotos) copie.photo = '';
    copie.modifie = new Date().toISOString();
    const index = fiches.findIndex((f) => f.id === copie.id);
    if (index >= 0) fiches[index] = copie; else fiches.unshift(copie);
    if (!sauverFiches() && copie.photo) {
      copie.photo = '';
      sauverFiches();
    }
    const numero = parseInt(String(fiche.ficheNo).replace(reglages.prefixe, ''), 10);
    if (Number.isFinite(numero) && numero >= reglages.compteur) {
      reglages.compteur = numero + 1;
      sauverReglages();
    }
  }

  /* ---------- historique ----------------------------------------------------- */
  function vueHistorique() {
    const liste = el('div', {});
    if (!fiches.length) {
      liste.appendChild(el('p', { class: 'empty' }, 'Aucune fiche enregistrée pour le moment.'));
    }
    for (const item of fiches) {
      liste.appendChild(el('div', { class: 'fiche' },
        el('span', { class: 'num' }, item.ficheNo || '—'),
        el('div', { class: 'meta' },
          el('b', {}, item.detenteurNom || 'Sans nom'),
          el('span', {}, [KezLogic.dateFr(item.dateIntervention),
            [item.marque, item.modele].filter(Boolean).join(' '),
            item.fluide].filter(Boolean).join(' · '))),
        el('button', { type: 'button', onclick: () => rouvrir(item) }, 'Ouvrir'),
        el('button', { type: 'button', onclick: () => regenerer(item) }, 'PDF')));
    }

    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Historique des fiches'),
        el('p', {}, fiches.length + ' fiche' + (fiches.length > 1 ? 's' : '') +
          ' sur cet appareil. Le PDF signé reste la pièce à conserver 5 ans.'),
        liste),
      el('div', { class: 'card' },
        el('h2', {}, 'Sauvegarde'),
        el('p', {}, 'Les fiches vivent dans ce navigateur : exporte régulièrement.'),
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'btn', onclick: exporter }, 'Exporter (.json)'),
          el('label', { class: 'filebtn', style: 'flex:1' }, 'Importer une sauvegarde',
            el('input', { type: 'file', accept: 'application/json,.json', onchange: importer })))));
  }

  function rouvrir(item) {
    fiche = JSON.parse(JSON.stringify(item));
    sauverBrouillon();
    vue = 'saisie'; etape = 0;
    construire();
    toast('Fiche ' + (item.ficheNo || '') + ' rouverte.');
  }

  async function regenerer(item) {
    try {
      const signatures = {
        operateur: { bytes: dataUrlVersOctets(item.signOpImg) },
        detenteur: { bytes: dataUrlVersOctets(item.signDetImg) },
      };
      const octets = KezLogic.genererPdf(item, signatures);
      await livrer(new Blob([octets], { type: 'application/pdf' }), KezLogic.nomFichier(item));
    } catch (e) { toast('Génération impossible : ' + e.message, 'err'); }
  }

  function exporter() {
    const donnees = { format: 'kez-cerfa', version: 1, exporte: new Date().toISOString(), reglages, fiches };
    const blob = new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' });
    livrer(blob, 'kez-cerfa-sauvegarde-' + aujourdhui() + '.json');
  }

  async function importer(ev) {
    const file = ev.currentTarget.files && ev.currentTarget.files[0];
    ev.currentTarget.value = '';
    if (!file) return;
    try {
      const donnees = JSON.parse(await file.text());
      if (!donnees || !Array.isArray(donnees.fiches)) throw new Error('fichier non reconnu');
      const connus = new Set(fiches.map((f) => f.id));
      let ajoutees = 0;
      for (const item of donnees.fiches) {
        if (item && item.id && !connus.has(item.id)) { fiches.push(item); ajoutees++; }
      }
      fiches.sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || '')));
      sauverFiches();
      construire();
      toast(ajoutees + ' fiche(s) importée(s).');
    } catch (e) { toast('Import impossible : ' + e.message, 'err'); }
  }

  /* ---------- réglages ------------------------------------------------------- */
  function vueReglages() {
    const champReglage = (libelle, cle, opts) => {
      const o = opts || {};
      const input = o.type === 'textarea'
        ? el('textarea', { rows: o.rows || 2 })
        : el('input', { type: o.type || 'text', placeholder: o.placeholder || '', inputMode: o.inputMode || null });
      input.value = reglages[cle] == null ? '' : reglages[cle];
      input.addEventListener('input', () => { reglages[cle] = input.value; sauverReglages(); });
      return el('label', { class: 'field' + (o.full ? ' full' : '') }, el('span', {}, libelle), input);
    };

    const photos = el('input', { type: 'checkbox', checked: !!reglages.garderPhotos });
    photos.addEventListener('change', () => { reglages.garderPhotos = photos.checked; sauverReglages(); });

    return el('div', {},
      el('div', { class: 'card' },
        el('h2', {}, 'Opérateur'),
        el('p', {}, 'Repris automatiquement sur chaque nouvelle fiche.'),
        el('div', { class: 'grid two' },
          champReglage('Raison sociale', 'operateurNom', { full: true }),
          champReglage('Adresse', 'operateurAdresse', { type: 'textarea', full: true }),
          champReglage('SIRET', 'operateurSiret', { placeholder: '000 000 000 00000' }),
          champReglage("N° d'attestation de capacité", 'attestationNo'),
          champReglage('Nom du technicien', 'signOpNom'),
          champReglage('Qualité', 'signOpQualite'))),
      el('div', { class: 'card' },
        el('h2', {}, 'Valeurs récurrentes'),
        el('div', { class: 'grid two' },
          champReglage('Détecteur manuel de fuite', 'detecteurId', { full: true, placeholder: 'Marque, modèle, n° de série, étalonnage' }),
          champReglage('Destination du fluide récupéré', 'installDestination', { type: 'textarea', full: true, placeholder: 'Nom, SIRET et adresse du centre de traitement' }))),
      el('div', { class: 'card' },
        el('h2', {}, 'Numérotation'),
        el('div', { class: 'grid two' },
          champReglage('Préfixe', 'prefixe', { placeholder: '2026-' }),
          champReglage('Prochain numéro', 'compteur', { type: 'number', inputMode: 'numeric' })),
        el('p', { class: 'tiny', style: 'margin:10px 0 0' }, 'Prochaine fiche : ' + numeroSuivant()),
        el('hr', { class: 'sep' }),
        el('label', { class: 'choice' + (reglages.garderPhotos ? ' on' : '') }, photos,
          el('div', {}, el('b', {}, "Conserver les photos de plaque dans l'historique"),
            el('small', {}, "À décocher si la mémoire du navigateur sature")))),
      el('div', { class: 'card' },
        el('h2', {}, 'À propos'),
        el('p', { class: 'muted' },
          "Fiche d'intervention CERFA 15497*04 (articles R. 543-79 et R. 543-82 du code de l'environnement). " +
          "Le PDF produit est aplati : le formulaire n'est plus modifiable après signature. " +
          "Les signatures sont des tracés manuscrits ajoutés au document, pas des signatures électroniques qualifiées."),
        el('p', { class: 'muted' },
          "Les PRG et les seuils sont ceux du règlement européen sur les gaz fluorés. " +
          "À revérifier après chaque révision réglementaire avant usage en production."),
        el('button', {
          type: 'button', class: 'btn danger block', style: 'margin-top:8px',
          onclick() {
            if (!confirmer('Effacer toutes les fiches enregistrées sur cet appareil ?', false)) return;
            fiches = []; sauverFiches(); construire(); toast('Historique vidé.');
          },
        }, "Vider l'historique")));
  }

  /* ---------- rendu général --------------------------------------------------- */
  const RENDUS = [etapeClient, etapeEquipement, etapeIntervention, etapeFluide, etapeSignatures];

  function construire() {
    const racine = $('#app');
    racine.textContent = '';

    const barreEtapes = $('#steps');
    barreEtapes.classList.toggle('hidden', vue !== 'saisie');
    if (vue === 'saisie' && !barreEtapes.children.length) {
      ETAPES.forEach((nom, i) => {
        barreEtapes.appendChild(el('button', {
          type: 'button',
          onclick: () => { etape = i; construire(); },
        }, el('span', { class: 'n' }, String(i + 1)), el('b', {}, nom)));
      });
    }

    if (vue === 'saisie') racine.appendChild(RENDUS[etape]());
    else if (vue === 'historique') racine.appendChild(vueHistorique());
    else racine.appendChild(vueReglages());

    const actions = $('#actions');
    actions.textContent = '';
    const inner = el('div', { class: 'inner' });
    if (vue === 'saisie') {
      inner.appendChild(el('button', {
        type: 'button', class: 'btn', disabled: etape === 0,
        onclick: () => { etape = Math.max(0, etape - 1); construire(); window.scrollTo(0, 0); },
      }, 'Retour'));
      if (etape < ETAPES.length - 1) {
        inner.appendChild(el('button', {
          type: 'button', class: 'btn dark',
          onclick: () => { etape = Math.min(ETAPES.length - 1, etape + 1); construire(); window.scrollTo(0, 0); },
        }, 'Continuer'));
      } else {
        inner.appendChild(el('button', { type: 'button', class: 'btn primary', onclick: genererEtPartager }, 'Générer le PDF'));
      }
    } else {
      inner.appendChild(el('button', {
        type: 'button', class: 'btn dark block',
        onclick: () => { vue = 'saisie'; construire(); },
      }, 'Retour à la fiche'));
    }
    actions.appendChild(inner);

    rafraichir();
  }

  /* ---------- barre supérieure ------------------------------------------------ */
  function initTopbar() {
    $('#btn-nouvelle').addEventListener('click', () => {
      if (!confirmer('Commencer une nouvelle fiche ? La saisie en cours sera remplacée.', true)) return;
      fiche = ficheVierge();
      sauverBrouillon();
      vue = 'saisie'; etape = 0;
      construire();
      window.scrollTo(0, 0);
    });
    const onglet = (id, cible) => $(id).addEventListener('click', () => {
      vue = vue === cible ? 'saisie' : cible;
      construire();
      window.scrollTo(0, 0);
      for (const [bouton, nom] of [[$('#btn-historique'), 'historique'], [$('#btn-reglages'), 'reglages']]) {
        bouton.setAttribute('aria-current', vue === nom ? 'true' : 'false');
      }
    });
    onglet('#btn-historique', 'historique');
    onglet('#btn-reglages', 'reglages');
  }

  document.addEventListener('paste', (event) => {
    if (vue !== 'saisie' || etape !== 1) return;
    const file = imageDuPressePapiers(event);
    if (!file) return;
    event.preventDefault();
    const zone = document.querySelector('.photo');
    if (zone && zone.__importer) void zone.__importer(file);
  });

  initTopbar();
  construire();
  capaciteEnregistrement().then(() => majEtatSortie());
})();
