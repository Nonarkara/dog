export interface Vaccination {
  id: string;
  name: string;
  type: 'core' | 'non-core';
  dateAdministered: string; // YYYY-MM-DD
  nextDueDate: string;      // YYYY-MM-DD
  batchNumber: string;
  clinic: string;
  veterinarian: string;
  notes?: string;
}

export interface ParasitePrevention {
  id: string;
  brand: string; // e.g. NexGard Spectra, Bravecto
  target: 'flea-tick-heartworm' | 'flea-tick' | 'heartworm' | 'all-in-one';
  dateAdministered: string;
  nextDueDate: string;
  administeredBy: string;
}

export interface MedicalRecord {
  id: string;
  date: string;
  category: 'checkup' | 'treatment' | 'surgery' | 'dental' | 'dietary';
  summary: string;
  clinic: string;
  vetNotes: string;
  weightAtTimeKg: number;
}

export interface TamagotchiStats {
  hunger: number;    // 0 - 100
  happiness: number; // 0 - 100
  energy: number;    // 0 - 100
  hygiene: number;   // 0 - 100
  lastFed: number;   // timestamp
  lastPlayed: number;
  lastWalked: number;
  lastGroomed: number;
}

export interface PhotoRecord {
  id: string;
  url: string;
  angle: 'front' | 'side' | 'closeup' | 'body' | 'other';
  dateTaken: string;
  notes?: string;
}

export interface DogProfile {
  id: string;
  name: string;
  callName?: string;
  thaiName?: string;
  breed: string;
  thaiBreed?: string;
  birthDate: string; // YYYY-MM-DD
  sex: 'male' | 'female';
  isNeutered: boolean;
  microchipId: string;
  weightKg: number;
  coatColor: string;
  distinctiveMarks: string[];
  personalityTraits: string[];
  favoriteFood: string;
  favoriteToy: string;
  quirks: string[];
  primaryVetClinic: string;
  emergencyPhone: string;
  photos: PhotoRecord[];
  primaryPhotoUrl: string;
  vaccinations: Vaccination[];
  parasiteControl: ParasitePrevention[];
  medicalHistory: MedicalRecord[];
  tamagotchi: TamagotchiStats;
  metaverseTribe: string;
  metaverseBio: string;
  avatarConfig: {
    baseColor: string;
    secondaryColor: string;
    maskColor: string;
    pointColor?: string; // tan points; defaults to baseColor
    pattern?: import('../domain/coat').CoatPattern; // defaults to 'solid'
    furFluff: number; // 0 - 1
    earShape: 'pricked' | 'floppy' | 'semi-pricked';
    tailShape: 'curl' | 'plume' | 'straight' | 'bob';
    customModelUrl?: string; // If user imports GLTF/GLB from 3D reconstruction
  };
}

export interface MetaverseNeighborDog {
  id: string;
  name: string;
  breed: string;
  tribe: string;
  ownerName: string;
  personality: string;
  avatarColors: {
    base: string;
    secondary: string;
    mask?: string;
  };
  earShape: 'pricked' | 'floppy';
  position: [number, number, number]; // [x, y, z] in the 3D park
  action: 'sniffing' | 'walking' | 'sitting' | 'barking' | 'running';
  speed: number;
}
