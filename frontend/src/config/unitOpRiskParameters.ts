// frontend/src/config/unitOpRiskParameters.ts
// Single source of truth for Unit Operation Type suggested risk parameters & CQA relevance maps

export interface SuggestedRiskParamConfig {
  name: string
  unit?: string
  defaultType: 'CPP-candidate' | 'CMA-candidate'
}

export const UNIT_OP_SUGGESTED_PARAMETERS: Record<string, SuggestedRiskParamConfig[]> = {
  Reaction: [
    { name: 'Reaction Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Agitation Speed (RPM)', unit: 'RPM', defaultType: 'CMA-candidate' },
    { name: 'Reagent Molar Ratio (eq)', unit: 'eq', defaultType: 'CPP-candidate' },
    { name: 'Catalyst / Base Equivalents', unit: 'eq', defaultType: 'CPP-candidate' },
    { name: 'Reaction Hold Time (h)', unit: 'h', defaultType: 'CPP-candidate' },
    { name: 'Reagent Addition / Dosing Rate (mL/min)', unit: 'mL/min', defaultType: 'CPP-candidate' },
    { name: 'Solvent Water Content / Moisture (ppm)', unit: 'ppm', defaultType: 'CMA-candidate' }
  ],
  Crystallization: [
    { name: 'Cooling Rate (°C/min)', unit: '°C/min', defaultType: 'CPP-candidate' },
    { name: 'Seeding Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Anti-solvent Addition Rate (mL/min)', unit: 'mL/min', defaultType: 'CPP-candidate' },
    { name: 'Agitation Speed (RPM)', unit: 'RPM', defaultType: 'CMA-candidate' },
    { name: 'Slurry Hold Time (h)', unit: 'h', defaultType: 'CPP-candidate' }
  ],
  Workup: [
    { name: 'Aqueous Layer pH', unit: 'pH', defaultType: 'CPP-candidate' },
    { name: 'Extraction Ratio (v/v)', unit: 'v/v', defaultType: 'CPP-candidate' },
    { name: 'Quench Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Phase Separation Settling Time (min)', unit: 'min', defaultType: 'CMA-candidate' },
    { name: 'Wash Volume (L/kg)', unit: 'L/kg', defaultType: 'CPP-candidate' }
  ],
  Filtration: [
    { name: 'Wash Solvent Volume (L/kg)', unit: 'L/kg', defaultType: 'CPP-candidate' },
    { name: 'Cake Thickness (cm)', unit: 'cm', defaultType: 'CMA-candidate' },
    { name: 'Filtration Pressure (bar)', unit: 'bar', defaultType: 'CPP-candidate' },
    { name: 'Wash Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' }
  ],
  Drying: [
    { name: 'Drying Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Vacuum Pressure (mbar)', unit: 'mbar', defaultType: 'CPP-candidate' },
    { name: 'Drying Time (h)', unit: 'h', defaultType: 'CPP-candidate' },
    { name: 'Nitrogen Bleed Rate (Nm³/h)', unit: 'Nm³/h', defaultType: 'CMA-candidate' },
    { name: 'Bed Thickness (mm)', unit: 'mm', defaultType: 'CMA-candidate' }
  ],
  Distillation: [
    { name: 'Column Head Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Reflux Ratio', unit: '', defaultType: 'CPP-candidate' },
    { name: 'Reboiler Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Column Pressure (mbar)', unit: 'mbar', defaultType: 'CPP-candidate' },
    { name: 'Feed Flow Rate (L/h)', unit: 'L/h', defaultType: 'CPP-candidate' }
  ],
  Purification: [
    { name: 'Eluent Flow Rate (mL/min)', unit: 'mL/min', defaultType: 'CPP-candidate' },
    { name: 'Gradient Slope (%/min)', unit: '%/min', defaultType: 'CPP-candidate' },
    { name: 'Column Temperature (°C)', unit: '°C', defaultType: 'CPP-candidate' },
    { name: 'Column Loading (g/L)', unit: 'g/L', defaultType: 'CPP-candidate' }
  ],
  Milling: [
    { name: 'Rotor Speed / Tip Speed (m/s)', unit: 'm/s', defaultType: 'CPP-candidate' },
    { name: 'Feed Rate (kg/h)', unit: 'kg/h', defaultType: 'CPP-candidate' },
    { name: 'Classifier Wheel Speed (RPM)', unit: 'RPM', defaultType: 'CPP-candidate' },
    { name: 'Grinding Chamber Pressure (bar)', unit: 'bar', defaultType: 'CMA-candidate' }
  ],
  Blending: [
    { name: 'Blender Speed (RPM)', unit: 'RPM', defaultType: 'CPP-candidate' },
    { name: 'Blending Duration (min)', unit: 'min', defaultType: 'CPP-candidate' },
    { name: 'Fill Level (% volume)', unit: '%', defaultType: 'CMA-candidate' }
  ],
  Other: [] // Starts with empty table
}

// Deterministic keywords for "Likely relevant" CQA highlighting
export const CQA_RELEVANCE_MAP: Record<string, string[]> = {
  purity: ['temperature', 'time', 'ratio', 'catalyst', 'dosing', 'rate', 'quench', 'cooling'],
  impurity: ['temperature', 'time', 'ratio', 'catalyst', 'dosing', 'rate', 'quench', 'cooling', 'wash'],
  assay: ['temperature', 'time', 'ratio', 'catalyst', 'dosing', 'extraction'],
  solvent: ['drying', 'vacuum', 'temperature', 'bleed', 'distillation', 'wash'],
  lod: ['drying', 'vacuum', 'temperature', 'time', 'bleed'],
  particle: ['cooling', 'seeding', 'agitation', 'speed', 'rotor', 'mill', 'rate', 'slurry'],
  psd: ['cooling', 'seeding', 'agitation', 'speed', 'rotor', 'mill', 'rate', 'slurry'],
  polymorph: ['cooling', 'seeding', 'temperature', 'solvent', 'slurry'],
  water: ['moisture', 'water', 'drying', 'vacuum'],
  moisture: ['moisture', 'water', 'drying', 'vacuum']
}

export function isParamLikelyRelevant(paramName: string, cqas: Array<{ name: string } | string>): boolean {
  if (!paramName || !cqas || cqas.length === 0) return false
  const pLower = paramName.toLowerCase()
  for (const item of cqas) {
    const cqaName = typeof item === 'string' ? item : item.name || ''
    const cLower = cqaName.toLowerCase()
    for (const [key, keywords] of Object.entries(CQA_RELEVANCE_MAP)) {
      if (cLower.includes(key)) {
        if (keywords.some(kw => pLower.includes(kw))) {
          return true
        }
      }
    }
  }
  return false
}

// Collapses doubled leading words (e.g. "Reaction Reaction Temperature" -> "Reaction Temperature")
export function sanitizeParamName(name: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  if (words.length >= 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    return words.slice(1).join(' ')
  }
  return name.trim()
}
