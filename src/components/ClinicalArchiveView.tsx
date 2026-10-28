import React, { useState } from 'react';
import { DogProfile } from '../types/dog';
import { calculateDogAge } from '../utils/dogCalculators';
import { Printer, Download, Sparkles, ShieldCheck, Box, Dna, FileText } from 'lucide-react';

interface ClinicalArchiveViewProps {
  dog: DogProfile;
  onOpenReconstruction: () => void;
}

export const ClinicalArchiveView: React.FC<ClinicalArchiveViewProps> = ({
  dog,
  onOpenReconstruction,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const age = calculateDogAge(dog.birthDate, dog.weightKg);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${dog.name.toLowerCase()}-clinical-archive.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="border-hairline bg-zinc-950 p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-semibold">
              DECK 03 // CLINICAL ARCHIVE & 3D NEURAL STUDIO
            </span>
          </div>
          <h3 className="font-display text-lg text-white font-bold">
            CANINE GENETIC REGISTRY · VETERINARY PASSPORT
          </h3>
          <p className="text-xs text-zinc-400 font-mono">
            Standard: Swiss International / Vignelli Tri-Column Grid · Subject: {dog.name} ({dog.breed})
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExportJson} className="btn text-xs py-1 px-3">
            <Download size={11} /> EXPORT ARCHIVE
          </button>
          <button onClick={handlePrint} className="btn btn-accent text-xs py-1 px-3">
            <Printer size={11} /> PRINT PASSPORT PDF
          </button>
        </div>
      </div>

      {/* Tri-Column Architectural Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* COLUMN 1: Identity, Breed Standard & Nutrition (3 Cols) */}
        <div className="lg:col-span-3 border-hairline bg-black p-4 space-y-3">
          <div className="border-hairline-b pb-2">
            <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[10px] uppercase tracking-widest font-semibold">
              <Dna size={12} /> 01 / GENETICS & IDENTITY
            </div>
            <h4 className="font-display text-base font-bold text-white mt-0.5">{dog.breed.toUpperCase()}</h4>
            <span className="text-xs text-zinc-400 font-mono">{dog.thaiBreed || 'สุนัขไทยบางแก้ว'} · Spitz Type</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">MICROCHIP</span>
              <span className="text-zinc-200 text-[11px] font-semibold">{dog.microchipId}</span>
            </div>
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">BIRTH DATE</span>
              <span className="text-zinc-200 text-[11px]">{dog.birthDate}</span>
            </div>
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">CHRONO AGE</span>
              <span className="text-zinc-200 text-[11px]">{age.formattedCalendarAge}</span>
            </div>
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">BIOLOGICAL AGE</span>
              <span className="text-amber-400 text-[11px] font-bold">≈ {age.dogYears} DOG YRS</span>
            </div>
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">SEX / CASTRATION</span>
              <span className="text-zinc-200 text-[11px]">{dog.sex.toUpperCase()} ({dog.isNeutered ? 'NEUTERED' : 'INTACT'})</span>
            </div>
            <div className="flex justify-between py-1 border-hairline-b">
              <span className="text-zinc-500 text-[11px]">WEIGHT (BCS 5/9)</span>
              <span className="text-zinc-200 text-[11px]">{dog.weightKg} KG</span>
            </div>
          </div>

          {/* Bangkaew Standard Conformity */}
          <div className="p-3 bg-zinc-950 border-hairline space-y-1.5 text-xs">
            <span className="font-mono text-amber-500 text-[10px] uppercase font-semibold block">
              Breed Standard Conformity
            </span>
            <p className="text-zinc-300 text-[11px]">
              ✓ <strong>Lion Mane Ruff:</strong> Dense white ruff framing throat and chest (*แผงคอสิงโต*).
            </p>
            <p className="text-zinc-300 text-[11px]">
              ✓ <strong>Mask & Blaze:</strong> Symmetrical wolf-sable mask with white vertical blaze.
            </p>
            <p className="text-zinc-300 text-[11px]">
              ✓ <strong>Plume Tail:</strong> Feathered arch carried proudly over back.
            </p>
          </div>

          {/* Prescribed Nutrition */}
          <div className="p-3 bg-zinc-950 border-hairline space-y-1 text-xs font-mono">
            <span className="text-zinc-400 text-[10px] block font-semibold uppercase">Prescribed Nutrition</span>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              {dog.favoriteFood}
            </p>
          </div>
        </div>

        {/* COLUMN 2: 3D Neural Photogrammetry Studio (5 Cols) */}
        <div className="lg:col-span-5 border-hairline bg-zinc-950 p-4 space-y-3">
          <div className="border-hairline-b pb-2">
            <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[10px] uppercase tracking-widest font-semibold">
              <Box size={12} /> 02 / 3D NEURAL RECONSTRUCTION
            </div>
            <h4 className="font-display text-base font-bold text-white mt-0.5">PHOTOGRAMMETRY WORKBENCH</h4>
            <span className="text-xs text-zinc-400 font-mono">TripoSR · InstantMesh · Gaussian Splatting</span>
          </div>

          {/* 3 Photos with Angle Badges */}
          <div className="grid grid-cols-3 gap-2">
            {dog.photos.map((p, i) => (
              <div
                key={p.id || i}
                onClick={() => setSelectedPhoto(p.url)}
                className="border-hairline bg-black p-1.5 cursor-pointer group"
              >
                <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden mb-1">
                  <img
                    src={p.url}
                    alt={p.angle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/90 font-mono text-[8px] text-amber-400 px-1 py-0.5">
                    ANG {i + 1}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-zinc-400 block truncate uppercase">
                  {p.angle}
                </span>
              </div>
            ))}
          </div>

          {/* Neural Wireframe & Telemetry Preview */}
          <div className="w-full h-48 bg-black border-hairline flex flex-col items-center justify-center relative p-3 overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style="background-image: linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px); background-size: 20px 20px;"></div>
            
            <div className="w-36 h-32 border border-dashed border-amber-500/70 flex flex-col items-center justify-center text-center p-2 z-10">
              <span className="font-mono text-xs text-amber-400 font-bold block">
                [EXPO 3D MESH]
              </span>
              <span className="font-mono text-[9px] text-zinc-400 mt-1">
                RIGGED BANGKAEW
              </span>
            </div>

            <div className="absolute bottom-2 left-2 right-2 flex justify-between font-mono text-[9px] text-zinc-500 border-hairline-t pt-1 bg-black/80">
              <span>POLYGONS: 18,420</span>
              <span>TEX: 2048×2048 PBR</span>
              <span>RIG: 28 BONES</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onOpenReconstruction}
              className="btn btn-accent flex-1 text-xs py-1.5"
            >
              <Sparkles size={12} /> LAUNCH RECONSTRUCTION PIPELINE
            </button>
          </div>
        </div>

        {/* COLUMN 3: Official Veterinary Medical Passport (4 Cols) */}
        <div className="lg:col-span-4 border-hairline bg-black p-4 space-y-3">
          <div className="border-hairline-b pb-2">
            <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[10px] uppercase tracking-widest font-semibold">
              <ShieldCheck size={12} /> 03 / CLINICAL PASSPORT
            </div>
            <h4 className="font-display text-base font-bold text-white mt-0.5">VET LEDGER & LOGS</h4>
            <span className="text-xs text-zinc-400 font-mono">{dog.primaryVetClinic}</span>
          </div>

          {/* Vaccine Cards */}
          <div className="space-y-2 text-xs font-mono">
            {dog.vaccinations.map((vac) => (
              <div key={vac.id} className="p-2.5 bg-zinc-950 border-hairline space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-zinc-200">{vac.name}</span>
                  <span className="px-1.5 py-0.5 border border-emerald-500/50 bg-emerald-950/20 text-emerald-400 text-[10px] font-bold">
                    VALID
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 flex justify-between">
                  <span>GIVEN: {vac.dateAdministered}</span>
                  <span>EXP: {vac.nextDueDate}</span>
                </div>
                <div className="text-[9px] text-zinc-500">
                  Batch: {vac.batchNumber} · {vac.clinic}
                </div>
              </div>
            ))}

            {/* Parasite Prevention */}
            {dog.parasiteControl.map((pc) => (
              <div key={pc.id} className="p-2.5 bg-zinc-950 border-hairline space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-zinc-200">{pc.brand}</span>
                  <span className="px-1.5 py-0.5 border border-amber-500/50 bg-amber-950/20 text-amber-400 text-[10px] font-bold">
                    DUE SOON
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 flex justify-between">
                  <span>LAST: {pc.dateAdministered}</span>
                  <span className="text-amber-400 font-semibold">NEXT: {pc.nextDueDate}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Travel & Boarding Stamp */}
          <div className="p-3 bg-zinc-950 border border-emerald-500/40 text-xs font-mono space-y-1">
            <span className="text-emerald-400 font-bold block flex items-center gap-1.5 text-[11px]">
              <ShieldCheck size={13} /> OFFICIAL TRAVEL CERTIFICATION
            </span>
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Rabies titer, microchip compliance, and core boosters meet international canine travel and domestic boarding standards.
            </p>
          </div>
        </div>

      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={selectedPhoto} alt="Expo Detail" className="max-w-full max-h-[85vh] object-contain border-hairline" />
            <span className="font-mono text-xs text-zinc-400 text-center block mt-2">
              EXPO · HIGH RESOLUTION PHOTOGRAMMETRY INTAKE · CLICK TO CLOSE
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
