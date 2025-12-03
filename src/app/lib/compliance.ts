// src/app/lib/compliance.ts

type RiskLevel = 'critical' | 'warning' | 'info';

interface RiskCategory {
  level: RiskLevel;
  keywords: string[];
  catKey: string;
  msgKey: string;
}

const riskTaxonomy: Record<string, RiskCategory> = {
  weapons: {
    level: 'critical',
    keywords: ['waffe', 'gun', 'pistole', 'pistol', 'knife', 'messer', 'bomb', 'bombe', 'munition', 'ammo', 'bullet', 'patrone', 'schlagring', 'taser', 'spreng', 'explosiv', 'sihlah', 'سلاح', 'gewehr', 'revolver', 'dynamit', 'granate', 'c4', 'semtex'],
    catKey: 'WAFFEN',
    msgKey: 'Streng verboten. Führt zur Sperrung.'
  },
  hazmat: {
    level: 'critical',
    keywords: ['uran', 'plutonium', 'radioactiv', 'radioaktiv', 'isotope', 'nuclear', 'atom', 'säure', 'acid', 'mercury', 'quecksilber', 'batterie', 'battery', 'lithium', 'gas', 'flammable', 'brennbar', 'poison', 'gift', 'toxin', 'benzin', 'petrol'],
    catKey: 'GEFAHRGUT',
    msgKey: 'Gefahrgut ist im Flugverkehr illegal.'
  },
  narcotics: {
    level: 'critical',
    keywords: ['drogen', 'drug', 'cannabis', 'weed', 'kokain', 'cocaine', 'heroin', 'hashish', 'thc', 'cbd', 'pillen', 'crystal', 'meth', 'mخدر', 'marijuana', 'koks', 'speed', 'amphetamin', 'lsd', 'ecstasy', 'mdma', 'opium', 'fentanyl'],
    catKey: 'BETÄUBUNGSMITTEL',
    msgKey: 'Illegaler Drogenbesitz ist strafbar.'
  },
  medication: {
    level: 'warning',
    keywords: ['ritalin', 'xanax', 'tilidin', 'morphin', 'tramadol', 'oxy', 'benzos', 'valium', 'spritze', 'insulin', 'blood', 'blut', 'darou', 'دارو', 'viagra', 'testosteron', 'steroid', 'anabol', 'antibiotika'],
    catKey: 'MEDIKAMENTE',
    msgKey: 'Ärztliches Attest zwingend erforderlich.'
  },
  protected: {
    level: 'critical',
    keywords: ['elfenbein', 'ivory', 'fell', 'fur', 'skin', 'koralle', 'reptil', 'snake', 'tiger', 'nashorn', 'caviar', 'papagei'],
    catKey: 'ARTENSCHUTZ',
    msgKey: 'Handel mit geschützten Arten verboten.'
  }
};

const levenshteinDistance = (s: string, t: string) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(arr[i - 1][j] + 1, arr[i][j - 1] + 1, arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1));
    }
  }
  return arr[t.length][s.length];
};

export function analyzeContentRisk(text: string) {
  const inputWords = text.toLowerCase().split(/[\s,.-]+/);
  
  for (const [key, category] of Object.entries(riskTaxonomy)) {
    for (const inputWord of inputWords) {
      if (inputWord.length < 3) continue;
      
      for (const keyword of category.keywords) {
        // Exakter Match
        if (inputWord.includes(keyword)) {
          return { found: true, level: category.level, cat: category.catKey, msg: category.msgKey };
        }
        
        // Fuzzy Match (Tippfehler)
        const dist = levenshteinDistance(inputWord, keyword);
        let isFuzzyMatch = false;
        if (keyword.length > 3 && keyword.length <= 5 && dist <= 1) isFuzzyMatch = true;
        if (keyword.length > 5 && dist <= 2) isFuzzyMatch = true;

        if (isFuzzyMatch) {
          return { found: true, level: category.level, cat: category.catKey, msg: category.msgKey };
        }
      }
    }
  }
  return { found: false, level: null, cat: '', msg: '' };
}