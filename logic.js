/* ============================================================================
   logic.js — fluides, calculs réglementaires et report sur le CERFA 15497*04.
   Aucune dépendance : tout est calculé à partir de la saisie.
   ========================================================================== */

/* Familles utilisées par le §7 du CERFA :
     HCFC  -> ligne en kg (2 / 30 / 300)
     HFC   -> ligne en tonnes équivalent CO2 (5 / 50 / 500)   [mélanges HFC+HFO inclus]
     HFO   -> ligne en kg (1 / 10 / 100)                      [HFO purs]
     AUTRE -> hors règlement F-Gas (hydrocarbures, CO2, ammoniac) : aucune case

   PRG (GWP) : valeurs usuelles des annexes du règlement européen F-Gas.
   À revérifier à chaque révision du règlement avant usage réglementaire. */
const FLUIDES = [
  { code: 'R32',     nom: 'R32',        famille: 'HFC',   prg: 675,  inflammable: true  },
  { code: 'R410A',   nom: 'R410A',      famille: 'HFC',   prg: 2088, inflammable: false },
  { code: 'R454B',   nom: 'R454B',      famille: 'HFC',   prg: 466,  inflammable: true  },
  { code: 'R452B',   nom: 'R452B',      famille: 'HFC',   prg: 698,  inflammable: true  },
  { code: 'R454C',   nom: 'R454C',      famille: 'HFC',   prg: 148,  inflammable: true  },
  { code: 'R134A',   nom: 'R134a',      famille: 'HFC',   prg: 1430, inflammable: false },
  { code: 'R513A',   nom: 'R513A',      famille: 'HFC',   prg: 631,  inflammable: false },
  { code: 'R404A',   nom: 'R404A',      famille: 'HFC',   prg: 3922, inflammable: false },
  { code: 'R407C',   nom: 'R407C',      famille: 'HFC',   prg: 1774, inflammable: false },
  { code: 'R407F',   nom: 'R407F',      famille: 'HFC',   prg: 1825, inflammable: false },
  { code: 'R448A',   nom: 'R448A',      famille: 'HFC',   prg: 1387, inflammable: false },
  { code: 'R449A',   nom: 'R449A',      famille: 'HFC',   prg: 1397, inflammable: false },
  { code: 'R427A',   nom: 'R427A',      famille: 'HFC',   prg: 2138, inflammable: false },
  { code: 'R422D',   nom: 'R422D',      famille: 'HFC',   prg: 2729, inflammable: false },
  { code: 'R1234YF', nom: 'R1234yf',    famille: 'HFO',   prg: 4,    inflammable: true  },
  { code: 'R1234ZE', nom: 'R1234ze(E)', famille: 'HFO',   prg: 7,    inflammable: true  },
  { code: 'R22',     nom: 'R22',        famille: 'HCFC',  prg: 1810, inflammable: false },
  { code: 'R290',    nom: 'R290',       famille: 'AUTRE', prg: 3,    inflammable: true  },
  { code: 'R744',    nom: 'R744 (CO2)', famille: 'AUTRE', prg: 1,    inflammable: false },
  { code: 'R717',    nom: 'R717 (NH3)', famille: 'AUTRE', prg: 0,    inflammable: true  },
];

const NATURES = [
  { id: 'assemblage',             libelle: "Assemblage de l'équipement",      case: 'Case_Assemblage' },
  { id: 'mise-service',           libelle: "Mise en service de l'équipement", case: 'Case_MiseService' },
  { id: 'modification',           libelle: "Modification de l'équipement",    case: 'Case_Modif' },
  { id: 'maintenance',            libelle: "Maintenance de l'équipement",     case: 'Case_Maintenance' },
  { id: 'controle-periodique',    libelle: "Contrôle d'étanchéité périodique", case: 'Case_CtrlPerio' },
  { id: 'controle-non-periodique',libelle: "Contrôle d'étanchéité non périodique", case: 'Case_CtrlNonPerio' },
  { id: 'demantelement',          libelle: 'Démantèlement',                   case: 'Case_Demantel' },
  { id: 'autre',                  libelle: 'Autre (préciser)',                case: 'Case_Autre' },
];

const KezLogic = (() => {
  const fluidOf = (code) =>
    FLUIDES.find((f) => f.code === String(code || '').toUpperCase().replace(/[\s-]/g, '')) || null;

  const num = (value) => {
    const parsed = parseFloat(String(value == null ? '' : value).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const kg = (value) => num(value).toFixed(3).replace('.', ',');
  const teqStr = (value) => value.toFixed(3).replace('.', ',');

  function teqCO2(form) {
    const fluide = fluidOf(form.fluide);
    return fluide ? (num(form.charge) * fluide.prg) / 1000 : 0;
  }

  /** Cases §7, §8 et §9 déduites du fluide et de la charge. */
  function seuils(form) {
    const fluide = fluidOf(form.fluide);
    const result = { quantite: null, frequence: null, niveau: 0, base: '', valeur: 0, controleObligatoire: false };
    if (!fluide) return result;
    const charge = num(form.charge);
    const teq = teqCO2(form);

    if (fluide.famille === 'HCFC') {
      result.base = 'kg'; result.valeur = charge;
      if (charge >= 300) { result.niveau = 3; result.quantite = 'Case_HCFC_300'; }
      else if (charge >= 30) { result.niveau = 2; result.quantite = 'Case_HCFC_30'; }
      else if (charge >= 2) { result.niveau = 1; result.quantite = 'Case_HCFC_2'; }
    } else if (fluide.famille === 'HFC') {
      result.base = 'teq'; result.valeur = teq;
      if (teq >= 500) { result.niveau = 3; result.quantite = 'Case_HFC_500'; }
      else if (teq >= 50) { result.niveau = 2; result.quantite = 'Case_HFC_50'; }
      else if (teq >= 5) { result.niveau = 1; result.quantite = 'Case_HFC_5'; }
    } else if (fluide.famille === 'HFO') {
      result.base = 'kg'; result.valeur = charge;
      if (charge >= 100) { result.niveau = 3; result.quantite = 'Case_HFO_100'; }
      else if (charge >= 10) { result.niveau = 2; result.quantite = 'Case_HFO_10'; }
      else if (charge >= 1) { result.niveau = 1; result.quantite = 'Case_HFO_1'; }
    }

    if (result.niveau) {
      result.controleObligatoire = true;
      // §9 ne concerne que les HFC et HFO ; les HCFC restent toujours en §8.
      const avecDetection = form.detecteurPermanent === 'oui' && fluide.famille !== 'HCFC';
      const sans = ['Case_Sans_12m', 'Case_Sans_6m', 'Case_Sans_3m'];
      const avec = ['Case_Avec_24m', 'Case_Avec_12m', 'Case_Avec_6m'];
      result.frequence = (avecDetection ? avec : sans)[result.niveau - 1];
      result.periode = (avecDetection ? [24, 12, 6] : [12, 6, 3])[result.niveau - 1];
    }
    return result;
  }

  /** Prochaine échéance de contrôle d'étanchéité, à titre informatif. */
  function prochainControle(form) {
    const s = seuils(form);
    if (!s.periode || !form.dateIntervention) return '';
    const d = new Date(form.dateIntervention + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + s.periode);
    return d.toLocaleDateString('fr-FR');
  }

  const dateFr = (iso) => {
    if (!iso) return '';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  };

  function totaux(form) {
    const chargee = num(form.qteVierge) + num(form.qteRecycle) + num(form.qteRegenere);
    const recuperee = num(form.qteTraitement) + num(form.qteReutilisation);
    return { chargee, recuperee };
  }

  /** Contrôles bloquants / avertissements avant génération. */
  function validation(form) {
    const erreurs = [], avertissements = [];
    if (!form.detenteurNom) erreurs.push('Nom du détenteur (client) manquant.');
    if (!(form.natures || []).length) erreurs.push('Nature de l\'intervention non cochée.');
    if (!form.fluide) erreurs.push('Fluide frigorigène non renseigné.');
    if (!num(form.charge)) erreurs.push('Charge totale de l\'équipement manquante.');
    if (!form.dateIntervention) erreurs.push('Date d\'intervention manquante.');
    if (!form.signOpNom) erreurs.push('Nom du signataire opérateur manquant.');

    if (!form.attestationNo) avertissements.push("N° d'attestation de capacité non renseigné (obligatoire sur la fiche).");
    if (!form.equipementId && !form.modele) avertissements.push("Identification de l'équipement peu précise (marque, modèle, n° de série).");
    const s = seuils(form);
    if (s.controleObligatoire && !form.detecteurId &&
        (form.natures || []).some((n) => n.startsWith('controle'))) {
      avertissements.push('§5 : identification du détecteur manuel de fuite non renseignée.');
    }
    if (s.controleObligatoire && !form.controleDate &&
        (form.natures || []).some((n) => n.startsWith('controle'))) {
      avertissements.push("§5 : date du contrôle d'étanchéité non renseignée.");
    }
    if (form.manipulation) {
      const t = totaux(form);
      if (t.recuperee > 0 && !form.contenants) avertissements.push('§11 : identification du contenant de récupération non renseignée.');
      if (num(form.qteTraitement) > 0 && !form.installDestination) {
        avertissements.push("§13 : installation de destination du fluide récupéré non renseignée.");
      }
    }
    if (!form.signDetNom) avertissements.push('Signature du détenteur : nom non renseigné.');
    return { erreurs, avertissements };
  }

  /** Construit le calque à imprimer par-dessus le CERFA. */
  function dessiner(form, signatures) {
    const ops = new KezPdf.Ops();
    const fluide = fluidOf(form.fluide);
    const teq = teqCO2(form);
    const t = totaux(form);

    /* --- [1] opérateur, [2] détenteur, n° de fiche ------------------------- */
    ops.field('Fiche_no', form.ficheNo, { align: 'center', size: 9, bold: true });
    ops.field('Operateur', [form.operateurNom, form.operateurAdresse,
      form.operateurSiret ? 'SIRET : ' + form.operateurSiret : ''].filter(Boolean).join('\n'), { size: 8 });
    ops.field('Attestation_no', form.attestationNo, { size: 8 });
    ops.field('Detenteur', [form.detenteurNom, form.detenteurAdresse,
      form.detenteurSiret ? 'SIRET : ' + form.detenteurSiret : ''].filter(Boolean).join('\n'), { size: 8 });

    /* --- [3] équipement ---------------------------------------------------- */
    const identification = form.equipementId || [
      form.marque, form.modele,
      form.serie ? 'N° série ' + form.serie : '',
      form.localisation,
    ].filter(Boolean).join(' — ');
    ops.field('Equipement_ID', identification, { size: 8 });
    ops.field('Equipement_Fluide', fluide ? fluide.nom.replace(/^R-?/i, '') : '', { size: 8, bold: true });
    ops.field('Equipement_Charge', kg(form.charge), { align: 'right', size: 8 });
    ops.field('Equipement_teqCO2', teqStr(teq), { align: 'right', size: 8 });

    /* --- [4] nature de l'intervention -------------------------------------- */
    for (const nature of NATURES) {
      if ((form.natures || []).includes(nature.id)) ops.check(nature.case);
    }
    if ((form.natures || []).includes('autre')) ops.field('Autre', form.autrePrecision, { size: 7.5 });

    /* --- [5] détecteur manuel + date du contrôle --------------------------- */
    ops.field('Detecteur_ID', form.detecteurId, { size: 7.5 });
    if (form.controleDate) {
      const [annee, mois, jour] = form.controleDate.split('-');
      ops.field('Controle_Jour', jour, { align: 'center', size: 8 });
      ops.field('Controle_Mois', mois, { align: 'center', size: 8 });
      ops.field('Controle_Annee', annee, { align: 'center', size: 8 });
    }

    /* --- [6] détection permanente ------------------------------------------ */
    if (form.detecteurPermanent === 'oui') ops.dot('Bouton_Oui#1');
    else if (form.detecteurPermanent === 'non') ops.dot('Bouton_Oui#2');

    /* --- [7] [8] [9] seuils et fréquence ----------------------------------- */
    const s = seuils(form);
    if (s.quantite) ops.check(s.quantite);
    if (s.frequence) ops.check(s.frequence);

    /* --- [10] fuites constatées -------------------------------------------- */
    if (form.controleEtancheite) {
      if (form.fuiteConstatee === 'oui') ops.check('Case_Fuite_Oui');
      else if (form.fuiteConstatee === 'non') ops.check('Case_Fuite_Non');
      (form.fuites || []).slice(0, 3).forEach((fuite, i) => {
        if (!fuite || (!fuite.loca && !fuite.rep)) return;
        ops.field('Fuite_Loca_' + (i + 1), fuite.loca, { size: 7.5 });
        if (fuite.rep === 'realisee') ops.check('Case_Rep_Fuite' + (i + 1) + '_realisee');
        else if (fuite.rep === 'afaire') ops.check('Case_Rep_Fuite' + (i + 1) + '_AFaire');
      });
    }

    /* --- [11] manipulation du fluide --------------------------------------- */
    if (form.manipulation) {
      if (t.chargee > 0) {
        ops.field('11_Quantite', kg(t.chargee), { align: 'right', size: 8 });
        ops.field('11_QA', kg(form.qteVierge), { align: 'right', size: 8 });
        if (num(form.qteRecycle)) ops.field('11_QB', kg(form.qteRecycle), { align: 'right', size: 8 });
        if (num(form.qteRegenere)) ops.field('11_QC', kg(form.qteRegenere), { align: 'right', size: 8 });
        ops.field('11_Denom', form.denomChange, { size: 7.5 });
      }
      if (t.recuperee > 0) {
        ops.field('11_QDE', kg(t.recuperee), { align: 'right', size: 8 });
        if (num(form.qteTraitement)) ops.field('11_QD', kg(form.qteTraitement), { align: 'right', size: 8 });
        if (num(form.qteReutilisation)) ops.field('11_QE', kg(form.qteReutilisation), { align: 'right', size: 8 });
        ops.field('11_BSFF', form.bsff, { size: 7 });
        ops.field('11_Contenant_ID', form.contenants, { size: 7 });
      }

      /* --- [12] dénomination ADR/RID, uniquement si récupération ----------- */
      if (num(form.qteTraitement) > 0 && fluide) {
        if (fluide.inflammable) ops.check('Case_12_UN3161');
        else ops.check('Case_12_UN1078');
      }

      /* --- [13] destination du fluide récupéré ----------------------------- */
      ops.field('13_Instal', form.installDestination, { size: 7.5 });
    }

    /* --- [14] observations -------------------------------------------------- */
    ops.field('14_Observations', form.observations, { size: 8 });

    /* --- signatures --------------------------------------------------------- */
    ops.field('Sign_Operateur_Nom', form.signOpNom, { size: 8 });
    ops.field('Sign_Operateur_Qualite', form.signOpQualite, { size: 8 });
    ops.field('Sign_Detenteur_Nom', form.signDetNom || form.detenteurNom, { size: 8 });
    ops.field('Sign_Detenteur_Qualite', form.signDetQualite, { size: 8 });

    const dateTexte = dateFr(form.dateIntervention);
    const images = [];
    const poser = (champ, nomImage, signature) => {
      const rect = KezPdf.FIELDS[champ];
      ops.line(dateTexte, rect[0] + 3, rect[1] + (rect[3] - rect[1]) / 2 - 2.5, 7, false);
      if (!signature || !signature.bytes || !signature.bytes.length) return;
      const dim = KezPdf.jpegSize(signature.bytes);
      if (!dim.w || !dim.h) return;
      // La signature peut déborder au-dessus du champ : la cellule « Date et
      // signature » du CERFA est plus haute que la zone de saisie d'origine.
      const zoneX = rect[0] + 52, zoneW = rect[2] - 2 - zoneX;
      const zoneY = rect[1] + 1.5, zoneH = 71.5 - zoneY;
      const ratio = Math.min(zoneW / dim.w, zoneH / dim.h);
      const w = dim.w * ratio, h = dim.h * ratio;
      images.push({ name: nomImage, bytes: signature.bytes });
      ops.image(nomImage, zoneX + (zoneW - w) / 2, zoneY + (zoneH - h) / 2, w, h);
    };
    poser('Sign_Operateur_Date', 'KEZSIG1', signatures && signatures.operateur);
    poser('Sign_Detenteur_Date', 'KEZSIG2', signatures && signatures.detenteur);

    return { ops, images };
  }

  function genererPdf(form, signatures) {
    const { ops, images } = dessiner(form, signatures);
    return KezPdf.assemble(ops, images);
  }

  function nomFichier(form) {
    const client = (form.detenteurNom || 'intervention').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const base = ['CERFA-15497', form.ficheNo, client, form.dateIntervention]
      .filter(Boolean).join('-');
    return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-') + '.pdf';
  }

  return { FLUIDES, NATURES, fluidOf, num, kg, teqCO2, seuils, prochainControle, dateFr, totaux, validation, dessiner, genererPdf, nomFichier };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { KezLogic, FLUIDES, NATURES };

