import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  intercommunalite?: string;
  microRegion?: string;
  microRegionLabel?: string;
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 22;
  
  return {
    refectionRomane: { min: Math.round(rPrice * 0.90), max: Math.round(rPrice * 1.30) },
    refectionCanal: { min: Math.round(rPrice * 1.10), max: Math.round(rPrice * 1.45) },
    refectionZinc: { min: Math.round(rPrice * 1.20), max: Math.round(rPrice * 1.70) },
    demoussageHydro: { min: Math.round(dPrice * 0.85), max: Math.round(dPrice * 1.25) },
    reparationFuite: { min: 400, max: 2500 },
    faitageMl: { min: 45, max: 85 },
    zinguerieMl: { min: 55, max: 110 },
    isolationSarking: { min: 65, max: 120 },
    charpenteM2: { min: 65, max: 130 },
    surtoitureM2: { min: 140, max: 220 }
  };
}

class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(val);
  }
  return text;
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'demoussage' | 'artisan') {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 22;
  const minRPrice = Math.round(rPrice * 0.9);
  const maxRPrice = Math.round(rPrice * 1.3);
  const minDPrice = Math.round(dPrice * 0.85);
  const maxDPrice = Math.round(dPrice * 1.25);
  const rge = commune.marketData?.couvreursRGE || 3;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const pop = commune.population || 3000;
  const slug = commune.slug;

  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const proxC1 = nearby[0]?.nom || "Avignon";
  const proxC2 = nearby[1]?.nom || "Carpentras";
  const proxC3 = nearby[2]?.nom || "Orange";
  const proxC4 = nearby[3]?.nom || "Cavaillon";

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Vaucluse",
    DEPARTEMENT_CODE: "84",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: commune.intercommunalite || "Grand Avignon",
    PROX_C1: proxC1,
    PROX_C2: proxC2,
    PROX_C3: proxC3,
    PROX_C4: proxC4
  };

  // 1. Titles
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "{Travaux de Rénovation de Toiture|Réfection complète de Couverture} à {VILLE} ({ZIP}) — Artisan Qualifié RGE 84";
  } else if (pageType === 'demoussage') {
    titleTemplate = "{Nettoyage & Restauration de Toiture|Démoussage hydrofuge complet} à {VILLE} ({ZIP}) — Devis Gratuit";
  } else {
    titleTemplate = "{Artisan Couvreur professionnel|Trouver un Couvreur Qualifié} à {VILLE} ({ZIP}) — Devis Gratuits RGE";
  }

  // 2. Intros
  let introTemplate = "";
  if (pageType === 'refection') {
    introTemplate = "Votre toiture à {VILLE} ({ZIP}) nécessite des travaux de rénovation ou de réfection complète ? {Le climat provençal caractérisé par le souffle du Mistral en vallée du Rhône impose un encorbellement et une fixation mécanique de couverture irréprochable|La proximité de monuments historiques et de zones ABF dans le Luberon ou à {VILLE} demande une maîtrise parfaite des tuiles canal anciennes|L'isolation de votre maison est essentielle sous les 40°C d'été et nécessite la mise en œuvre de solutions performantes comme le sarking fibre de bois}. Nos couvreurs partenaires qualifiés du Vaucluse interviennent à {VILLE} pour la réfection de couverture en tuiles romanes ou canal avec des budgets moyens compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ TTC.";
  } else if (pageType === 'demoussage') {
    introTemplate = "À la recherche d'un professionnel qualifié pour un nettoyage ou un démoussage de votre toiture à {VILLE} ({ZIP}) ? {Les micro-organismes, lichens noirs calcicoles et mousses s'accumulent sur vos tuiles en terre cuite après les violents orages d'automne|Une tuile non étanchéifiée absorbe l'humidité et risque de se fendre au premier gel d'hiver provoqué par le froid du Mont Ventoux|La stagnation d'eau de pluie causée par la mousse nuit gravement à la durée de vie de votre charpente en bois}. Nos techniciens locaux interviennent pour le démoussage mécanique et le traitement hydrofuge perlant complet de votre toiture à {VILLE} pour un coût moyen de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².";
  } else {
    introTemplate = "Besoin d'un artisan couvreur certifié RGE et assuré en garantie décennale à {VILLE} ({ZIP}) ? {Qu'il s'agisse de réparer une fuite de toiture urgente causée par une tempête de Mistral, de remplacer des gouttières en zinc ou de restaurer des génoises provençales à 3 rangs|Pour chiffrer précisément votre projet de rénovation énergétique de couverture et solliciter les subventions de l'ANAH|Afin d'obtenir une expertise de toiture de qualité dans le cadre de la vente ou de l'acquisition de votre maison}, comparez gratuitement jusqu'à 3 offres d'entreprises locales du Vaucluse sous {DELAIS} jours sur {VILLE}, {PROX_C1} ou {PROX_C2}.";
  }

  // 3. Climate Context (DIFFERENTIATED)
  let climateTemplate = "";
  if (pageType === 'refection') {
    if (commune.microRegion === 'luberon') {
      climateTemplate = "Sur le massif du Luberon, les chantiers de réfection complète de couverture à {VILLE} doivent parer à des vents ascendants violents et des hivers froids. Les artisans privilégient l'installation d'un écran sous-toiture HPV robuste, fixé sous le contre-lattage conformément au DTU 40.21. Cela prévient les infiltrations d'eau en cas de déplacement accidentel de tuiles canal.";
    } else if (commune.microRegion === 'plaine-avignon' || commune.microRegion === 'rhone-nord') {
      climateTemplate = "Dans le couloir rhodanien à {VILLE}, le Mistral soufflant fréquemment à plus de 110 km/h crée un effet d'aspiration aérodynamique (effet Venturi) au-dessus des faîtages. Les couvreurs du 84 appliquent le clouage ou le crochetage systématique d'au moins 1 tuile mécanique sur 3 sur la partie courante, et de 100% des tuiles sur les rives et les lignes d'égout.";
    } else if (commune.microRegion === 'ventoux-comtat') {
      climateTemplate = "Au pied du Géant de Provence, les toits de {VILLE} subissent les orages de grêle estivaux et des hivers froids. Les professionnels RGE y posent des tuiles en terre cuite à haute résistance mécanique et conseillent la réfection des faîtages maçonnés fissurés par des systèmes de closoirs ventilés à sec en aluminium.";
    } else {
      climateTemplate = "À proximité des plaines humides de la Durance ou de la Sorgue à {VILLE}, la réfection complète de toiture intègre systématiquement la pose de gouttières rampantes nantaises sur-mesure en zinc ou en cuivre, dimensionnées pour évacuer les flux torrentiels des orages d'automne sans risquer de déborder sous la volige.";
    }
  } else if (pageType === 'demoussage') {
    if (commune.microRegion === 'luberon') {
      climateTemplate = "L'ensoleillement fort alterné de gelées hivernales dans le Luberon à {VILLE} fragilise la surface des tuiles en terre cuite poreuse. Les mousses et les lichens s'y développent, stockant l'humidité. Au premier gel, l'eau gonfle et fait éclater les ergots des tuiles. Un démoussage minutieux sans chlore suivi d'un traitement hydrofuge perlant est crucial.";
    } else if (commune.microRegion === 'plaine-avignon' || commune.microRegion === 'rhone-nord') {
      climateTemplate = "Le vent du Mistral accélère l'assèchement des mousses superficielles à {VILLE}, mais tasse les poussières et les spores de lichens noirs au fond des emboîtements des tuiles romanes. Cela obstrue les canaux d'évacuation de l'eau. Un brossage manuel suivi d'un traitement fongicide récurant permet de nettoyer en profondeur ces zones sensibles.";
    } else if (commune.microRegion === 'ventoux-comtat') {
      climateTemplate = "Les amplitudes thermiques du Ventoux favorisent la porosité des tuiles à {VILLE}. Les mousses s'y installent rapidement sur les versants nord. Les artisans vauclusiens recommandent l'application d'un hydrofuge de surface perlant imperméabilisant incolore pour garder la terre cuite sèche et stopper le développement fongique.";
    } else {
      climateTemplate = "L'humidité ambiante due aux cours d'eau de la Sorgue et de la Durance à {VILLE} accélère la formation de mousses épaisses. Nettoyer son toit tous les 5 à 7 ans est indispensable. Les professionnels appliquent des algicides à action lente qui respectent les supports en zinc des gouttières réceptrices.";
    }
  } else {
    // artisan
    climateTemplate = "À {VILLE} ({ZIP}), les artisans couvreurs locaux disposent d'un savoir-faire spécifique face aux contraintes du climat vauclusien. Ils maîtrisent parfaitement les techniques de fixation anti-vent conformes aux normes parasismiques et aux pressions du Mistral du couloir du Rhône, ainsi que le choix de tuiles résistantes au gel des hauteurs du Vaucluse.";
  }

  // 4. ABF / Urban rules (DIFFERENTIATED & LINKS ADDED)
  let abfTemplate = "";
  if (pageType === 'refection') {
    abfTemplate = "Lors d'une réfection complète de toit à {VILLE}, le respect du Plan Local d'Urbanisme (PLU) est obligatoire. Si votre habitation se situe en zone sauvegardée ou à proximité de {PROX_C1}, vous devez déposer une déclaration préalable en mairie de {VILLE}. L'utilisation de tuiles canal de récupération ocre nuancé est souvent prescrite par l'Architecte des Bâtiments de France (ABF) pour préserver le paysage. Vous pouvez consulter les réglementations officielles sur le site du <a href='https://www.geoportail-urbanisme.gouv.fr/' target='_blank' rel='noopener nofollow'>Géoportail de l'Urbanisme</a>.";
  } else if (pageType === 'demoussage') {
    abfTemplate = "Le nettoyage de toiture à {VILLE} ne doit pas altérer la patine naturelle des tuiles historiques. L'utilisation d'hydrofuges colorés trop brillants ou de teintes inadaptées peut être rejetée par les services d'urbanisme de {VILLE} en zone classée. Les professionnels privilégient donc des hydrofuges invisibles (incolores) qui protègent la terre cuite sans en modifier l'aspect visuel exigé par les règlements des sites patrimoniaux.";
  } else {
    abfTemplate = "Pour vos travaux de toiture à {VILLE}, assurez-vous de choisir un artisan habitué à collaborer avec les services de la mairie de {VILLE} et les ABF du Vaucluse. Une mauvaise pose ou le choix d'un coloris non homologué pour vos tuiles canal ou romanes peut bloquer l'obtention de la conformité de vos travaux. Pensez à remplir une déclaration de travaux via le portail officiel <a href='https://www.service-public.fr/particuliers/vosdroits/F17578' target='_blank' rel='noopener nofollow'>Service-Public.fr</a>.";
  }

  // 5. Housing typologies (DIFFERENTIATED)
  let housingTemplate = "";
  if (pageType === 'refection') {
    if (commune.population > 15000) {
      housingTemplate = "Le tissu urbain dense de {VILLE} et ses immeubles de centre-ville exigent une préparation logistique importante pour une réfection de toiture : installation d'un échafaudage sur voie publique avec autorisation de la mairie de {VILLE}, garde-corps de sécurité et parfois monte-matériaux. Les couvreurs examinent également l'état des solins en plomb raccordés aux bâtisses mitoyennes.";
    } else {
      housingTemplate = "À {VILLE}, l'habitat composé de mas provençaux et de villas isolées permet un accès plus aisé pour les engins. Toutefois, avant de poser la nouvelle couverture, le charpentier procède à un examen structurel des pannes en chêne ou des fermettes industrielles pour vérifier qu'aucune attaque d'insectes xylophages (capricornes) ne fragilise l'ensemble.";
    }
  } else if (pageType === 'demoussage') {
    if (commune.population > 15000) {
      housingTemplate = "Pour les maisons de ville et toits mitoyens à {VILLE}, le traitement de nettoyage exige des précautions pour éviter les projections sur les façades des voisins ou sur la voie publique. Les techniciens utilisent des pulvérisateurs équipés de cloches de protection et veillent à rincer immédiatement les zingueries communes pour éviter toute corrosion résiduelle.";
    } else {
      housingTemplate = "Dans les bastides et propriétés arborées de {VILLE}, la présence de pins d'Alep, de cyprès ou de chênes verts à proximité du toit favorise l'accumulation d'aiguilles et de feuilles dans les chéneaux. Lors du démoussage de la toiture, l'artisan réalise systématiquement le curage des gouttières et propose la pose de crapaudines pour éviter l'engorgement.";
    }
  } else {
    if (commune.population > 15000) {
      housingTemplate = "Trouver un couvreur disponible à {VILLE} intervenant sur des immeubles collectifs ou des accès étroits de centre historique nécessite un professionnel bien équipé (nacelle, échafaudage modulaire). Assurez-vous que l'entreprise sélectionnée possède le matériel adapté pour travailler en toute sécurité et conformément aux règles de sécurité du travail.";
    } else {
      housingTemplate = "Pour les mas en pierre et les pavillons de {VILLE}, privilégiez un artisan couvreur-charpentier vauclusien capable d'intervenir à la fois sur la rénovation de charpente en bois de pays et sur la zinguerie traditionnelle en zinc, très courante sur les débords de toits des maisons provençales.";
    }
  }

  // 6. Energy Profile (DIFFERENTIATED & LINKS ADDED)
  let energyTemplate = "";
  if (pageType === 'refection') {
    energyTemplate = "Isoler sa toiture lors de sa réfection complète à {VILLE} est capital pour bloquer la chaleur estivale vauclusienne. La technique du **sarking** par l'extérieur, utilisant des panneaux rigides de fibre de bois, garantit un déphasage thermique supérieur à 10 heures. Pour en savoir plus sur l'éligibilité de vos aides énergétiques, consultez le site de référence <a href='https://france-renov.gouv.fr/' target='_blank' rel='noopener nofollow'>France Rénov'</a>.";
  } else if (pageType === 'demoussage') {
    energyTemplate = "Une toiture propre et sèche à {VILLE} contribue indirectement à la performance thermique globale du bâtiment. Des tuiles de terre cuite saturées d'humidité perdent leur pouvoir isolant et transmettent le froid ou la chaleur à l'intérieur. L'application d'un hydrofuge perlant maintient la couverture sèche, évitant ainsi le refroidissement de la lame d'air sous-toiture en hiver.";
  } else {
    energyTemplate = "Pour financer l'isolation thermique de vos combles à {VILLE}, l'artisan couvreur retenu doit obligatoirement être labellisé RGE (Reconnu Garant de l'Environnement). C'est le seul critère ouvrant droit à MaPrimeRénov' et aux primes CEE. Vous pouvez vérifier l'accréditation RGE des entreprises sur l'annuaire du site gouvernemental de l'organisme <a href='https://www.qualibat.com/' target='_blank' rel='noopener nofollow'>Qualibat</a>.";
  }

  // 7. Real Estate Insight (DIFFERENTIATED & LINKS ADDED)
  let realEstateTemplate = "";
  if (pageType === 'refection') {
    realEstateTemplate = "Dans le marché immobilier recherché du Vaucluse à {VILLE}, présenter une facture de réfection de toiture complète accompagnée de sa **garantie décennale de 10 ans** constitue un argument de vente majeur. Cela écarte toute négociation de prix sur le gros œuvre. Découvrez les tendances de l'habitat local sur le site du <a href='https://www.vaucluse.fr/' target='_blank' rel='noopener nofollow'>Département de Vaucluse (84)</a>.";
  } else if (pageType === 'demoussage') {
    realEstateTemplate = "L'aspect visuel de votre toiture à {VILLE} conditionne la première impression des acheteurs potentiels. Un toit recouvert de mousses vertes et de lichens noirs renvoie l'image d'un bâtiment mal entretenu et fait craindre des défauts d'étanchéité cachés. Un démoussage hydrofuge redonne de l'éclat à vos tuiles canal ou romanes et valorise immédiatement votre maison.";
  } else {
    realEstateTemplate = "Faire auditer sa toiture par un couvreur professionnel à {VILLE} avant la mise en vente de sa bastide ou de sa villa permet de rassurer les acquéreurs. Un toit sain, exempt de fuites et de tuiles cassées, garantit des visites sereines et accélère la transaction immobilière dans le secteur de {VILLE} ({ZIP}) et de ses communes limitrophes.";
  }

  // Parsing templates
  const finalTitle = replaceVariables(parseSpintax(slug, 'title', titleTemplate), vars);
  const finalIntro = replaceVariables(parseSpintax(slug, 'intro', introTemplate), vars);
  const finalClimate = replaceVariables(parseSpintax(slug, 'climate', climateTemplate), vars);
  const finalAbf = replaceVariables(parseSpintax(slug, 'abf', abfTemplate), vars);
  const finalHousing = replaceVariables(parseSpintax(slug, 'housing', housingTemplate), vars);
  const finalEnergy = replaceVariables(parseSpintax(slug, 'energy', energyTemplate), vars);
  const finalRealEstate = replaceVariables(parseSpintax(slug, 'realestate', realEstateTemplate), vars);

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    climateContext: finalClimate,
    abfRegulations: finalAbf,
    housingTypologyInsight: finalHousing,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
    faqItems: commune.faq || []
  };
}
