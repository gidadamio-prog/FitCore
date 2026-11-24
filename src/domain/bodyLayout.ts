// Generiert von scripts/traits/process_extras.py.
// Kopf-Ebenen: [links %, oben %, Breite %, Schmuck-Ebene]
export const HEAD_LAYOUT_EXTRA: Record<string, [number, number, number, boolean]> = {
  'augen_augenklappe': [44.92, 9.41, 11.2, false],
  'augen_drahtbrille': [43.88, 10.28, 12.24, false],
  'augen_hornbrille': [43.88, 10.19, 12.24, false],
  'augen_kaisermaske': [43.75, 7.55, 12.5, false],
  'augen_lederklappe': [44.01, 9.45, 11.2, false],
  'augen_monokel': [50.05, 9.62, 9.38, false],
  'augen_pilotenbrille': [43.88, 10.09, 12.24, false],
  'augen_rundbrille': [43.88, 9.77, 12.24, false],
  'augen_schildklappe': [44.27, 8.96, 11.46, false],
  'augen_schutzbrille': [43.75, 9.77, 12.5, false],
  'augen_uhrwerkklappe': [44.01, 9.03, 11.98, false],
  'augen_visier': [43.62, 9.63, 12.76, false],
  'frisur_fransen': [40.62, 4.76, 16.25, false],
  'frisur_wuschel': [39.97, 4.54, 16.25, false],
  'frisur_zerzaust': [41.56, 3.75, 16.55, false],
};

// Körperbereiche je Grundkörper: [links %, oben %, Breite %, Höhe %] im 2:3-Kasten
export type BodyPart = 'torso' | 'armL' | 'armR' | 'legL' | 'legR';
export const BODY_PARTS: Record<string, Record<BodyPart, [number, number, number, number]>> = {
  'adipoes': { torso: [31.16, 19.7, 36.77, 25.73], armL: [12.89, 21.01, 21.95, 41.32], armR: [64.25, 21.01, 22.21, 41.32], legL: [25.7, 65.36, 20.09, 28.21], legR: [53.16, 65.36, 20.24, 28.21] },
  'athletisch': { torso: [33.18, 20.31, 33.12, 22.66], armL: [17.84, 21.61, 18.65, 40.28], armR: [62.99, 21.61, 18.91, 40.28], legL: [33.04, 60.68, 11.78, 31.86], legR: [54.93, 60.68, 11.63, 31.86] },
  'bodybuilder': { torso: [31.61, 19.7, 36.25, 22.81], armL: [16.8, 21.01, 18.44, 40.97], armR: [64.24, 21.01, 18.44, 40.97], legL: [31.29, 60.33, 14.5, 32.2], legR: [53.69, 60.33, 14.5, 32.2] },
  'duenn': { torso: [35.33, 21.61, 28.44, 21.75], armL: [18.36, 22.92, 19.81, 38.89], armR: [60.92, 22.92, 20.2, 38.89], legL: [35.06, 60.42, 8.91, 32.12], legR: [55.23, 60.42, 9.06, 32.12] },
  'durchschnitt': { torso: [33.14, 20.23, 32.81, 24.72], armL: [16.15, 21.53, 20.27, 40.62], armR: [62.67, 21.53, 20.01, 40.62], legL: [29.6, 64.15, 14.5, 29.08], legR: [54.46, 64.15, 14.65, 29.08] },
  'fit': { torso: [34.15, 21.01, 31.56, 22.05], armL: [18.62, 22.31, 18.69, 39.58], armR: [62.56, 22.31, 18.82, 39.58], legL: [34.12, 60.33, 11.18, 34.11], legR: [54.17, 60.33, 11.33, 34.11] },
  'koloss': { torso: [24.97, 16.84, 49.79, 28.24], armL: [6.25, 18.14, 23.7, 44.1], armR: [69.79, 18.14, 23.96, 44.1], legL: [19.41, 66.84, 26.28, 27.17], legR: [52.96, 66.84, 26.89, 27.17] },
  'kraeftig': { torso: [31.65, 20.23, 35.52, 25.12], armL: [15.62, 21.53, 19.58, 40.62], armR: [63.62, 21.53, 19.84, 40.62], legL: [29.31, 64.84, 14.95, 28.99], legR: [54.59, 64.84, 14.65, 28.99] },
  'muskuloes-bauch': { torso: [32.89, 20.05, 33.96, 22.91], armL: [16.93, 21.35, 19.36, 40.62], armR: [63.45, 21.35, 19.36, 40.62], legL: [31.39, 60.85, 13.14, 31.6], legR: [54.95, 60.85, 13.14, 31.6] },
  'schlank': { torso: [34.6, 21.44, 29.9, 22.2], armL: [18.23, 22.74, 19.36, 38.89], armR: [61.5, 22.74, 19.75, 38.89], legL: [33.49, 61.02, 10.87, 31.42], legR: [54.73, 61.02, 10.72, 31.42] },
  'strongman': { torso: [28.29, 19.1, 43.02, 25.73], armL: [11.85, 20.4, 20.75, 42.01], armR: [67.01, 20.4, 21.14, 42.01], legL: [24.78, 64.76, 20.24, 28.99], legR: [54.29, 64.76, 20.84, 28.99] },
  'uebergewichtig': { torso: [33.89, 20.49, 31.56, 22.61], armL: [18.36, 21.79, 18.69, 38.89], armR: [62.3, 21.79, 19.08, 38.89], legL: [31.94, 60.76, 10.72, 27.69], legR: [55.86, 60.76, 11.33, 27.69] },
};

// Seitenverhältnis (Höhe/Breite) der Narben-Bilder
export const SCAR_ASPECT: Record<string, number> = {
  'wange': 0.812,
  'brustnaht': 1.071,
  'baerenkralle': 0.974,
  'hiebe': 0.814,
  'blitz': 2.604,
  'greifenkrallen': 0.614,
  'brand': 1.89,
  'schenkelhieb': 1.478,
  'vierfachhieb': 1.331,
  'kratzer': 1.352,
  'auge': 6.622,
  'doppelnaht': 1.157,
  'schulterkralle': 1.103,
  'langer-schnitt': 1.248,
  'unterarm': 2.171,
};
