#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

// ──────────────────────────────────────────────────────────────
// DETERMINISTIC SEEDED RANDOM
// ──────────────────────────────────────────────────────────────
function hash(slug, seed = 0) {
  let h = seed * 31 + 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0);
}

function pick(slug, seed, arr) {
  return arr[hash(slug, seed) % arr.length];
}

function pickN(slug, seed, arr, n) {
  const indices = [];
  const used = new Set();
  let s = seed;
  while (indices.length < n && indices.length < arr.length) {
    const idx = hash(slug, s) % arr.length;
    if (!used.has(idx)) { indices.push(idx); used.add(idx); }
    s++;
  }
  return indices.map(i => arr[i]);
}

// ──────────────────────────────────────────────────────────────
// MICRO-RÉGIONS VAUCLUSIENNES (84)
// ──────────────────────────────────────────────────────────────
const MICRO_REGIONS = {
  'luberon': {
    label: 'Luberon & Pays d\'Apt',
    description: 'villages perchés et vallées du Parc Naturel Régional du Luberon',
    climate: 'exposition au Mistral sur les crêtes, gel hivernal vif dans les vallées et sécheresse estivale intense',
    roofRisk: 'fissuration des tuiles canal par gel-dégel et infiltration par vent de face sur toitures séculaires',
    maintenanceCycle: 4,
    communes: [
      'pertuis', 'apt', 'gordes', 'roussillon', 'bonnieux', 'menerbes', 'cadenet', 
      'lourmarin', 'robion', 'cheval-blanc', 'villelaure', 'la-tour-d-aigues', 'cavaillon'
    ]
  },
  'plaine-avignon': {
    label: 'Grand Avignon & Sorgues',
    description: 'bassin de vie avignonnais et confluence du Rhône et de la Durance',
    climate: 'Mistral dévastateur canalisé par la vallée du Rhône soufflant plus de 120 jours par an et orages d\'été soudains',
    roofRisk: 'arrachement de tuiles canal ou romanes et infiltrations massives sous toitures en zone urbaine dense',
    maintenanceCycle: 5,
    communes: [
      'avignon', 'le-pontet', 'sorgues', 'vedene', 'morieres-les-avignon', 
      'entraigues-sur-la-sorgue', 'caumont-sur-durance'
    ]
  },
  'ventoux-comtat': {
    label: 'Comtat Venaissin & Ventoux',
    description: 'plaine agricole du Comtat et contreforts du Mont Ventoux',
    climate: 'chaleur estivale écrasante, orages de grêle destructeurs et vent descendant violent du Géant de Provence',
    roofRisk: 'bris de tuiles sous la grêle, dessèchement des mortiers de chaux et infiltration d\'eau cévenole',
    maintenanceCycle: 5,
    communes: [
      'carpentras', 'pernes-les-fontaines', 'aubignan', 'mazan', 'bedoin', 
      'monteux', 'loriol-du-comtat', 'sarrians'
    ]
  },
  'rhone-nord': {
    label: 'Rhône & Haut-Vaucluse',
    description: 'couloir rhodanien nord et collines de l\'Enclave des Papes',
    climate: 'exposition directe au Mistral de plein fouet et risque d\'orages violents à caractère cévenol',
    roofRisk: 'glissement de tuiles canal non crochetées et infiltration sous l\'effet de pluies poussées par le vent du nord',
    maintenanceCycle: 5,
    communes: [
      'orange', 'bollene', 'valreas', 'piolenc', 'courthezon', 'jonquieres', 
      'vaison-la-romaine', 'camaret-sur-aigues', 'sainte-cecile-les-vignes'
    ]
  },
  'sorgue-durance': {
    label: 'Monts de Vaucluse & Sorgues',
    description: 'vallées de la Sorgue, de la Durance et collines environnantes',
    climate: 'taux d\'humidité élevé près des cours d\'eau et alternance thermique jour/nuit sur les roches calcaires',
    roofRisk: 'prolifération de mousses et lichens noirs sur tuiles et corrosion saline/humide des gouttières en zinc',
    maintenanceCycle: 3,
    communes: [
      'l-isle-sur-la-sorgue', 'le-thor', 'chateauneuf-de-gadagne', 'althen-des-paluds'
    ]
  }
};

function getMicroRegion(slug) {
  for (const [key, region] of Object.entries(MICRO_REGIONS)) {
    if (region.communes.includes(slug)) return key;
  }
  // Fallback by coordinates
  const c = communes.find(c => c.slug === slug);
  if (!c) return 'plaine-avignon';
  const lat = c.latitude || 43.94;
  const lon = c.longitude || 4.80;
  
  if (lat > 44.15) return 'rhone-nord';
  if (lat < 43.85) return 'luberon';
  if (lon > 5.15) return 'luberon';
  if (lon < 4.90) return 'plaine-avignon';
  return 'ventoux-comtat';
}

// ──────────────────────────────────────────────────────────────
// LANDMARKS PAR COMMUNE (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
const LANDMARKS_DB = {
  'avignon': ['le Palais des Papes et le Pont Saint-Bénézet classés UNESCO', 'le centre historique ceint de ses remparts médiévaux'],
  'carpentras': ['la cathédrale Saint-Siffrein et la porte d\'Orange', 'la plus ancienne synagogue de France toujours active'],
  'orange': ['le Théâtre Antique d\'Orange classé UNESCO et l\'Arc de Triomphe', 'la colline Saint-Eutrope dominant le fleuve Rhône'],
  'cavaillon': ['la colline Saint-Jacques et l\'arc romain de Cavaillon', 'la cathédrale Saint-Véran et les canaux de la Durance'],
  'l-isle-sur-la-sorgue': ['les roues à aubes sur les canaux de la Sorgue', 'les boutiques d\'antiquaires et le partage des eaux'],
  'apt': ['la cathédrale Sainte-Anne et le pont romain Julien', 'les mines d\'ocre du Pays d\'Apt'],
  'pertuis': ['la Tour Saint-Jacques et l\'église Saint-Nicolas', 'la plaine de la Durance et les châteaux du Luberon'],
  'gordes': ['le château de Gordes classé parmi les plus beaux villages', 'l\'abbaye Notre-Dame de Sénanque entourée de lavande'],
  'vaison-la-romaine': ['le pont romain sur l\'Ouvèze et les vestiges antiques', 'la cité médiévale perchée et sa cathédrale'],
  'bollene': ['la collégiale Saint-Martin et le site troglodytique de Barry', 'la centrale hydroélectrique historique de Donzère-Mondragon']
};

function getLandmarks(slug) {
  if (LANDMARKS_DB[slug]) return LANDMARKS_DB[slug];
  const region = getMicroRegion(slug);
  const fallbacks = {
    'luberon': ['les carrières d\'ocre de Roussillon et les villages perchés', 'le Parc Naturel Régional du Luberon'],
    'plaine-avignon': ['le Palais des Papes d\'Avignon', 'les remparts historiques et le fleuve Rhône'],
    'ventoux-comtat': ['le géant de Provence Mont Ventoux', 'les dentelles de Montmirail'],
    'rhone-nord': ['le Théâtre Antique d\'Orange', 'les vignobles réputés de Châteauneuf-du-Pape'],
    'sorgue-durance': ['les sources et fontaines de Fontaine-de-Vaucluse', 'les canaux de L\'Isle-sur-la-Sorgue']
  };
  return fallbacks[region] || ['les paysages provençaux du Vaucluse', 'le patrimoine architectural du 84'];
}

function getAltitude(slug) {
  const altitudes = {
    'avignon': 23, 'carpentras': 95, 'orange': 46, 'cavaillon': 75,
    'l-isle-sur-la-sorgue': 52, 'apt': 170, 'pertuis': 281, 'gordes': 370,
    'vaison-la-romaine': 204, 'bollene': 55, 'sorgues': 30, 'le-pontet': 26,
    'vedene': 60, 'morieres-les-avignon': 40, 'valreas': 230, 'mazan': 160,
    'bedoin': 310
  };
  if (altitudes[slug]) return altitudes[slug];
  const region = getMicroRegion(slug);
  const defaults = {
    'luberon': 250, 'plaine-avignon': 30, 'ventoux-comtat': 110, 'rhone-nord': 90, 'sorgue-durance': 60
  };
  return defaults[region] || 80;
}

// ──────────────────────────────────────────────────────────────
// INTERCOMMUNALITÉS (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getIntercommunalite(cp, slug) {
  const region = getMicroRegion(slug);

  if (['avignon', 'le-pontet', 'morieres-les-avignon', 'caumont-sur-durance', 'vedene', 'entraigues-sur-la-sorgue'].includes(slug)) {
    return "Communauté d'agglomération du Grand Avignon";
  }
  if (['carpentras', 'monteux', 'pernes-les-fontaines', 'aubignan', 'mazan', 'loriol-du-comtat', 'sarrians'].includes(slug)) {
    return "Communauté d'agglomération Ventoux-Comtat Venaissin (CoVe)";
  }
  if (['orange', 'courthezon', 'jonquieres'].includes(slug)) {
    return "Communauté de communes du Pays d'Orange en Vaucluse";
  }
  if (['cavaillon', 'robion', 'cheval-blanc'].includes(slug)) {
    return "Communauté d'agglomération Luberon Monts de Vaucluse";
  }
  if (['pertuis', 'villelaure', 'la-tour-d-aigues'].includes(slug)) {
    return "Métropole d'Aix-Marseille-Provence (Territoire du Pays d'Aix)";
  }
  if (['apt', 'gordes', 'roussillon', 'bonnieux', 'menerbes', 'cadenet', 'lourmarin'].includes(slug)) {
    return "Communauté de communes Pays d'Apt-Luberon";
  }
  if (['l-isle-sur-la-sorgue', 'le-thor', 'chateauneuf-de-gadagne', 'althen-des-paluds'].includes(slug)) {
    return "Communauté de communes Communes du Pays des Sorgues et des Monts de Vaucluse";
  }
  if (['bollene', 'valreas', 'piolenc'].includes(slug)) {
    return "Communauté de communes Rhône Lez Provence";
  }
  return "Département de Vaucluse";
}

// ──────────────────────────────────────────────────────────────
// HABITAT DESCRIPTIONS vauclusiennes
// ──────────────────────────────────────────────────────────────
const HABITAT_BY_REGION = {
  'luberon': [
    "mas séculaires en pierres sèches et bastides luberonnaises aux toitures couvertes de tuiles canal patinées de récupération",
    "maisons de village perchées aux toits serrés encastrés sous fortes contraintes architecturales ABF",
    "propriétés de prestige restaurées avec des génoises maçonnées à trois rangs de tuiles traditionnelles",
    "granges agricoles converties et bastides provençales aux charpentes traditionnelles en bois résineux ou chêne"
  ],
  'plaine-avignon': [
    "hôtels particuliers et maisons bourgeoises intra-muros couvertes de tuiles canal scellées au mortier de chaux",
    "villas résidentielles des couronnes avignonnaises équipées de tuiles romanes en terre cuite à emboîtement",
    "copropriétés de ville et pavillons modernes aux toits terrasses ou charpentes fermettes",
    "maisons de faubourg traditionnelles mitoyennes aux toitures exposées aux rafales canalisées du Mistral"
  ],
  'ventoux-comtat': [
    "mas agricoles du Comtat et maisons de vignerons aux toits très étendus en tuiles canal d'époque",
    "villas individuelles récentes construites dans la garrigue calcaire avec écrans de sous-toiture HPV",
    "maisons de village historiques de Pernes aux toits de tuiles canal et faîtages maçonnés à l'ancienne",
    "pavillons résidentiels modernes avec toitures à double pente résistants à la grêle du Ventoux"
  ],
  'rhone-nord': [
    "maisons anciennes de caractère en pierre de taille à Vaison ou Orange aux toitures hautement réglementées",
    "bâtisses de village exposées aux vents violents de la vallée du Rhône nécessitant un clouage ou crochetage renforcé",
    "domaines viticoles historiques aux toitures à large surface équipées de tuiles canal anciennes",
    "villas contemporaines aux structures légères et matériaux certifiés NF anti-vent"
  ],
  'sorgue-durance': [
    "anciennes filatures et maisons bourgeoises au bord de la Sorgue aux toitures pentues en tuiles de terre cuite",
    "mas maraîchers du val de Durance aux charpentes traditionnelles et zingueries en zinc ou cuivre",
    "villas individuelles modernes sujettes à l'humidité des canaux de L'Isle-sur-la-Sorgue",
    "maisons mitoyennes des coeurs de bourgs aux gouttières anciennes et chenaux en zinc façonnés à la main"
  ]
};

function getHabitatType(slug, region) {
  if (slug === 'avignon') return "immeubles historiques intra-muros, hôtels particuliers aux toitures en tuiles canal anciennes scellées à la chaux et villas individuelles";
  if (slug === 'carpentras') return "maisons de ville traditionnelles comtadines en tuiles canal et pavillons résidentiels récents";
  if (slug === 'orange') return "bâtisses en pierre du centre ancien en tuiles canal sous contraintes ABF et villas contemporaines";
  if (slug === 'gordes') return "maisons en pierre sèche, mas de prestige et toitures canal à très fortes contraintes d'intégration paysagère";
  
  const habitats = HABITAT_BY_REGION[region] || HABITAT_BY_REGION['plaine-avignon'];
  return pick(slug, 10, habitats);
}

// ──────────────────────────────────────────────────────────────
// ROOF CHARACTERISTICS (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getRoofCharacteristics(slug, region) {
  const chars = {
    'luberon': { tuileDominante: 'Tuile canal ancienne de récupération', fixation: 'Mortier de chaux naturelle et crochets inox', ventilation: 'Chatières de toiture discrètes conformes ABF', ecran: 'Écran de sous-toiture HPV respirant et isolant' },
    'plaine-avignon': { tuileDominante: 'Tuile canal terre cuite ou tuile romane', fixation: 'Crochets galvanisés renforcés anti-arrachement Mistral', ventilation: 'Chatières et closoirs ventilés de faîtage', ecran: 'Écran de sous-toiture HPV étanche à l\'eau et au vent' },
    'ventoux-comtat': { tuileDominante: 'Tuile canal ocre flammée ou romane', fixation: 'Crochets de sécurité et clouage DTU 40.21', ventilation: 'Closoir métallique ventilé haute performance', ecran: 'Écran sous-toiture renforcé pare-grêle' },
    'rhone-nord': { tuileDominante: 'Tuile canal scellée ou romane lourde', fixation: 'Double crochetage mécanique DTU Zone d\'exposition III', ventilation: 'Closoir de faîtage ventilé mécanique', ecran: 'Écran sous-toiture HPV résistant aux vents extrêmes' },
    'sorgue-durance': { tuileDominante: 'Tuile canal traditionnelle terre cuite', fixation: 'Mortier bâtard et crochets métalliques', ventilation: 'Chatières pour lutter contre l\'humidité des canaux', ecran: 'Écran sous-toiture HPV avec traitement anti-condensation' }
  };
  return chars[region] || chars['plaine-avignon'];
}

// ──────────────────────────────────────────────────────────────
// 12+ TEMPLATES D'INTRO (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getLocalIntroText(commune, region) {
  const { nom, slug, population } = commune;
  const habitat = getHabitatType(slug, region);
  const regionData = MICRO_REGIONS[region];
  const landmarks = getLandmarks(slug);
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const templates = [
    () => `Perchée ${altitude > 150 ? `à ${altitude}m d'altitude dans un relief typique` : 'dans les plaines ensoleillées de Provence'}, la commune de ${nom} (${pop} habitants) abrite un bâti historique composé de ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} : les toitures subissent ici un ${regionData.roofRisk}. À proximité immédiate de ${landmarks[0]}, les maîtres couvreurs certifiés RGE du 84 restaurent les toitures dans le respect absolu des règles de l'art.`,
    
    () => `La commune de ${nom} dans le Vaucluse fait face à des conditions climatiques intenses : ${regionData.climate}. Les ${pop} habitants du secteur résident dans un parc immobilier composé de ${habitat}, exigeant un savoir-faire traditionnel en couverture. Proche de ${landmarks[0]}, les interventions de rénovation ou de démoussage doivent particulièrement parer aux risques de ${regionData.roofRisk}.`,
    
    () => `${nom} (${commune.codePostal}), charmante ville de ${pop} habitants, présente un marché immobilier patrimonial recherché dans le Vaucluse. Le parc de logements, caractérisé par des ${habitat}, requiert des artisans qualifiés en toiture. La rigueur du climat local — ${regionData.climate} — impose des techniques de pose robustes pour contrer les risques de ${regionData.roofRisk}.`,
    
    () => `Les toitures à ${nom} requièrent une expertise spécifique liée à l'implantation de la ville dans ${regionData.description}. Avec ${pop} habitants et ${landmarks[0]} comme repère visuel, le bâti local composé de ${habitat} subit de plein fouet ${regionData.climate}. Les couvreurs qualifiés interviennent pour limiter les risques de ${regionData.roofRisk} très fréquents dans la région.`,
    
    () => `Prendre soin de son toit à ${nom} est capital pour faire face aux ${regionData.climate}. Le patrimoine résidentiel de cette localité de ${pop} habitants — ${habitat} — recommande un cycle de révision préventif de ${regionData.maintenanceCycle} ans. Proche de ${landmarks[0]}, ${nom} profite d'artisans couvreurs certifiés RGE rompus aux exigences architecturales du ${regionData.label}.`,
    
    () => `Baignée dans ${regionData.description}, la commune de ${nom} compte ${pop} habitants dont les maisons — ${habitat} — sont confrontées à ${regionData.climate}. Le risque principal pour les couvertures réside dans le ${regionData.roofRisk}. Les couvreurs certifiés RGE du secteur adaptent leurs chantiers pour garantir l'étanchéité face aux colères du mistral ou des orages cévenols.`,
    
    () => `Rénover ou entretenir sa toiture à ${nom} (${commune.codePostal}) implique d'allier performance thermique moderne et respect des traditions. Cette commune de ${pop} habitants du ${regionData.label} dispose d'un bâti noble constitué de ${habitat}. La violence de ${regionData.climate} multiplie le risque de ${regionData.roofRisk}, justifiant l'appui d'artisans couvreurs qualifiés du 84.`,
    
    () => `Chaque saison met les charpentes et tuiles de ${nom} à rude épreuve. Le soleil torride d'été surchauffe les combles, tandis que l'automne apporte les vents du nord et la pluie. Le parc immobilier de cette commune de ${pop} habitants — ${habitat} — exige des couvreurs du 84 un diagnostic précis face aux pathologies de ${regionData.description}.`,
    
    () => `Le paysage urbain de ${nom}, ville provençale de ${pop} habitants, se distingue par des ${habitat}. Face à ${regionData.climate} et à l'ombre de ${landmarks[0]}, les toitures subissent d'importantes contraintes mécaniques. Un entretien régulier, conseillé tous les ${regionData.maintenanceCycle} ans, permet d'éviter le ${regionData.roofRisk} et d'étendre la durée de vie du toit.`,
    
    () => `Restaurer sa toiture à ${nom} dans le Vaucluse est un acte de préservation du patrimoine provençal. Les résidents de cette ville de ${pop} habitants habitent principalement des ${habitat} exposés à ${regionData.climate}. Négliger le ${regionData.roofRisk} peut endommager la structure en bois. Les artisans locaux certifiés interviennent pour pérenniser vos biens immobiliers.`,
    
    () => `Dans le département de Vaucluse, la ville de ${nom} (${pop} habitants) affiche des enjeux d'urbanisme évidents : ${regionData.climate}. Son parc résidentiel formé de ${habitat} requiert des solutions thermiques durables. Isoler son toit par l'extérieur ou par soufflage de combles apporte 3°C de fraîcheur en été face aux canicules.`,
    
    () => `Recourir à un artisan couvreur familier du climat vauclusien à ${nom} est la clé pour des travaux durables. Cette commune de ${pop} habitants, sise dans ${regionData.description}, présente un bâti de ${habitat}. Avec ${regionData.climate}, les toitures doivent être solidement ancrées et traitées régulièrement pour stopper le ${regionData.roofRisk}.`
  ];

  return pick(slug, 20, templates)();
}

// ──────────────────────────────────────────────────────────────
// 12+ VARIANTES CONSEIL LOCAL (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getLocalAdvice(commune, region) {
  const { nom, slug, codePostal } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const advices = [
    `Après un coup de Mistral violent à ${nom}, réalisez un contrôle visuel des tuiles de rive et de faîtage. Si des tuiles canal se sont déplacées, contactez un couvreur du Vaucluse pour un ré-alignement ou scellement rapide afin d'éviter une infiltration lors des prochaines pluies.`,
    `Le cycle d'entretien hydrofuge recommandé pour préserver les tuiles canal dans le secteur de ${nom} (${regionData.label}) est de ${regionData.maintenanceCycle} ans. L'application d'un hydrofuge de surface empêche la tuile de devenir poreuse sous l'effet du gel hivernal.`,
    `Pour bénéficier des aides d'État MaPrimeRénov' et CEE lors de l'isolation de votre toiture à ${nom}, vous devez impérativement faire réaliser les travaux par un artisan couvreur certifié RGE (Reconnu Garant de l'Environnement) disposant d'une décennale à jour.`,
    `À ${nom}, le Mistral peut souffler à plus de 120 km/h en rafales. Les couvreurs du 84 recommandent de fixer mécaniquement (clouage ou crochetage) au moins une tuile sur trois, conformément aux normes DTU 40.21 pour la zone d'exposition III.`,
    `Le Plan Local d'Urbanisme (PLU) de ${nom} (${codePostal}) définit précisément les teintes autorisées (tuiles ocre flammé ou vieux sud) et interdit certaines finitions modernes. Renseignez-vous auprès du service d'urbanisme de la mairie avant vos travaux.`,
    `Si votre toiture à ${nom} est située dans le périmètre de visibilité d'un monument historique (comme le Palais des Papes d'Avignon ou le Théâtre Antique d'Orange), vous devrez obligatoirement obtenir l'aval de l'Architecte des Bâtiments de France (ABF).`,
    `Lors de la demande de devis à ${nom}, exigez de l'artisan couvreur qu'il vous présente son attestation d'assurance décennale nominative couvrant spécifiquement la couverture, la zinguerie et l'isolation thermique dans le Vaucluse.`,
    `En ${regionData.description}, l'ensoleillement intense dessèche rapidement les joints de mortier bâtard traditionnels. Faire inspecter l'étanchéité des génoises et des solins de cheminée permet d'anticiper de lourdes rénovations.`,
    `L'intercommunalité ${getIntercommunalite(codePostal, slug)} propose des aides spécifiques ou des conseils via l'Espace Conseil France Rénov' local. N'hésitez pas à les solliciter avant de lancer la rénovation thermique de votre toiture à ${nom}.`,
    `La proximité de pinèdes, de chênes ou de cyprès autour de votre bâtisse à ${nom} peut obstruer vos gouttières avec des aiguilles et feuilles. La pose de crapaudines et de pare-feuilles en aluminium évite les débordements d'eau pluviale.`,
    `En cas d'intempérie de grêle sur le Comtat Venaissin ou le pied du Ventoux, photographiez immédiatement les tuiles brisées et contactez votre assurance dans les 5 jours. Demandez une mise en sécurité temporaire par bâche à un couvreur qualifié.`,
    altitude > 200
      ? `À ${nom} et dans les zones montagneuses du Ventoux ou du Luberon (${altitude}m), le gel hivernal intense peut faire éclater les tuiles de terre cuite. Optez pour des tuiles conformes à la norme NF EN 490 garantissant la résistance au gel.`
      : `Pour atténuer la chaleur sous combles en été à ${nom}, la ventilation sous tuiles est capitale. Assurez-vous que votre couvreur installe des chatières de ventilation suffisantes et un closoir de faîtage ventilé pour réduire la surchauffe.`
  ];

  return pick(slug, 30, advices);
}

// ──────────────────────────────────────────────────────────────
// FAQ POOL (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getLocalFAQ(commune, region) {
  const { nom, slug, codePostal, population } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const universalPool = [
    {
      q: `Quel est le prix moyen par m² pour refaire un toit à ${nom} ?`,
      a: `À ${nom}, le tarif moyen pour une réfection de toiture en tuiles romanes oscille entre 90€ et 145€ le m² TTC (pose comprise). Pour des tuiles canal traditionnelles posées sur un mas ou une bastide provençale, comptez entre 120€ et 185€ le m² TTC en raison de la pose sur mortier de chaux et des finitions en génoises.`
    },
    {
      q: `Puis-je utiliser des tuiles de récupération pour mon mas à ${nom} ?`,
      a: `Oui, pour conserver l'authenticité d'un mas provençal à ${nom}, l'utilisation de tuiles canal anciennes de récupération (patinées par le temps) est très fréquente. Les couvreurs associent généralement une sous-couche moderne (plaque sous-tuile ou tuile de courant neuve) avec des tuiles de couvert anciennes pour garantir l'étanchéité.`
    },
    {
      q: `Quelle est la durée de vie d'une toiture en tuiles dans le Vaucluse ?`,
      a: `Dans le Vaucluse, une toiture en tuiles de terre cuite de qualité a une durée de vie moyenne de 50 à 80 ans. Le climat sec mais soumis au Mistral extrême exige toutefois un contrôle régulier de la fixation et de l'état des joints de mortier tous les 10 ans.`
    },
    {
      q: `Comment isoler ma toiture contre la chaleur estivale à ${nom} ?`,
      a: `Pour protéger votre maison à ${nom} des fortes chaleurs d'été (souvent > 40°C), l'isolation par sarking (extérieure) en laine de bois haute densité est idéale. Avec un déphasage thermique de 10 à 12 heures, elle empêche la chaleur de traverser le toit en journée, réduisant l'usage de la climatisation.`
    },
    {
      q: `Faut-il une autorisation d'urbanisme pour refaire un toit à ${nom} ?`,
      a: `Oui. Toute réfection de toiture à ${nom} impliquant une modification des matériaux, des couleurs ou de l'aspect extérieur nécessite le dépôt d'une Déclaration Préalable (DP) en mairie. En zone de protection du patrimoine (ABF), le délai d'instruction est généralement de 2 mois.`
    },
    {
      q: `Pourquoi installer un écran sous-toiture HPV dans le Vaucluse ?`,
      a: `L'écran sous-toiture HPV (Haute Perméabilité à la Vapeur) protège la charpente des infiltrations de neige poudreuse du Ventoux ou de pluie poussée par le Mistral violent, tout en évacuant l'humidité intérieure de l'habitation.`
    }
  ];

  const luberonPool = [
    {
      q: `Quelles sont les obligations PLU spécifiques pour les génoises dans le Luberon à ${nom} ?`,
      a: `Dans le Luberon et le secteur de ${nom}, le PLU et les architectes-conseil imposent la restauration des génoises traditionnelles (2 ou 3 rangs de tuiles canal selon le standing du mas). Elles doivent être montées au mortier de chaux naturelle de couleur ocre clair, reproduisant les techniques locales historiques.`
    }
  ];

  const mistralPool = [
    {
      q: `Comment sécuriser ma toiture contre le Mistral violent à ${nom} ?`,
      a: `Pour sécuriser le toit à ${nom} face au Mistral qui souffle fréquemment à plus de 100 km/h, le couvreur applique la norme DTU 40.21. Cela consiste à fixer les tuiles mécaniquement à l'aide de crochets ou de vis en inox sur les liteaux, en insistant sur le faîtage, les rives et le bas de pente.`
    }
  ];

  let pool = [...universalPool];
  if (region === 'luberon') pool.push(...luberonPool);
  if (region === 'plaine-avignon' || region === 'rhone-nord') pool.push(...mistralPool);

  const count = (hash(slug, 50) % 2) + 4; // 4 or 5
  return pickN(slug, 40, pool, count);
}

// ──────────────────────────────────────────────────────────────
// MARKET DATA (Vaucluse 84)
// ──────────────────────────────────────────────────────────────
function getMarketData(commune, region) {
  const { slug, population } = commune;
  const h = hash(slug, 4);

  let rgeCount = 2;
  if (population > 80000) rgeCount = 28; // Avignon
  else if (population > 25000) rgeCount = 12; // Orange, Carpentras, Cavaillon
  else if (population > 10000) rgeCount = 6;
  else if (population > 5000) rgeCount = 4;
  rgeCount += (h % 3);
  rgeCount = Math.max(1, rgeCount);

  const priceMultiplier = {
    'luberon': 1.18, // Heritage, premium mas prices
    'plaine-avignon': 1.10,
    'ventoux-comtat': 1.08,
    'rhone-nord': 1.05,
    'sorgue-durance': 1.12
  };
  const mult = priceMultiplier[region] || 1.08;

  const basePriceRef = Math.round((95 + (h % 30)) * mult);
  const basePriceDem = Math.round((12 + (h % 10)) * mult);

  return {
    couvreursRGE: rgeCount,
    prixM2Refection: basePriceRef,
    prixM2Demoussage: basePriceDem,
    delaiMoyenJours: 4 + (h % 14) // 4 - 18 days
  };
}

// ──────────────────────────────────────────────────────────────
// MAIN: ENRICH ALL VAUCLUSE COMMUNES
// ──────────────────────────────────────────────────────────────
const enriched = communes.map(commune => {
  const region = getMicroRegion(commune.slug);
  const regionData = MICRO_REGIONS[region];
  const intercommunalite = getIntercommunalite(commune.codePostal, commune.slug);
  const intro = getLocalIntroText(commune, region);
  const conseil = getLocalAdvice(commune, region);
  const faq = getLocalFAQ(commune, region);
  const market = getMarketData(commune, region);
  const landmarks = getLandmarks(commune.slug);
  const altitude = getAltitude(commune.slug);

  return {
    ...commune,
    intercommunalite,
    microRegion: region,
    microRegionLabel: regionData.label,
    altitude,
    landmarks,
    introText: intro,
    conseilLocal: conseil,
    faq: faq,
    marketData: market
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2), 'utf-8');

// Stats Verification
const introTexts = enriched.map(c => c.introText);
const uniqueIntros = new Set(introTexts);
const regions = {};
enriched.forEach(c => { regions[c.microRegion] = (regions[c.microRegion] || 0) + 1; });

console.log(`✅ Enriched ${enriched.length} Vaucluse (84) communes with unique SEO data.`);
console.log(`   📊 Unique intros: ${uniqueIntros.size} / ${enriched.length}`);
console.log(`   📊 Micro-régions distribution:`, regions);
console.log(`\nSample Avignon intro:\n${enriched.find(c => c.slug === 'avignon')?.introText?.substring(0, 200)}...`);
console.log(`\nSample Carpentras intro:\n${enriched.find(c => c.slug === 'carpentras')?.introText?.substring(0, 200)}...`);
console.log(`\nSample Gordes intro:\n${enriched.find(c => c.slug === 'gordes')?.introText?.substring(0, 200)}...`);
