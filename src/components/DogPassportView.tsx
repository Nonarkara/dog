import React, { useState } from 'react';
import { DogProfile, Vaccination, ParasitePrevention, MedicalRecord } from '../types/dog';
import { calculateDogAge, getVaccineStatus } from '../utils/dogCalculators';
import {
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Award,
  Heart,
  Plus,
  Printer,
  Download,
  Info,
  Activity,
  Syringe,
  Pill,
  Sparkles,
} from 'lucide-react';

interface DogPassportViewProps {
  dog: DogProfile;
  onUpdateDog: (updated: DogProfile) => void;
  onOpenReconstruction: () => void;
}

export const DogPassportView: React.FC<DogPassportViewProps> = ({
  dog,
  onUpdateDog,
  onOpenReconstruction,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'vaccines' | 'parasites' | 'history' | 'photos'>('overview');
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // New vaccine form state
  const [vacName, setVacName] = useState('Rabies Booster');
  const [vacDate, setVacDate] = useState('2026-10-28');
  const [vacNextDue, setVacNextDue] = useState('2027-10-28');
  const [vacBatch, setVacBatch] = useState('RB-2026-X');
  const [vacClinic, setVacClinic] = useState('Thonglor Pet Hospital');

  const age = calculateDogAge(dog.birthDate, dog.weightKg);

  const handleAddVaccine = (e: React.FormEvent) => {
    e.preventDefault();
    const newVac: Vaccination = {
      id: `vac-${Date.now()}`,
      name: vacName,
      type: vacName.toLowerCase().includes('rabies') || vacName.toLowerCase().includes('dhpp') ? 'core' : 'non-core',
      dateAdministered: vacDate,
      nextDueDate: vacNextDue,
      batchNumber: vacBatch,
      clinic: vacClinic,
      veterinarian: 'Attending DVM',
    };

    onUpdateDog({
      ...dog,
      vaccinations: [newVac, ...dog.vaccinations],
    });
    setShowAddVaccineModal(false);
  };

  const handleExportPassportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${dog.name.toLowerCase()}-passport.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrintPassport = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Dog Identity Header Card (Dieter Rams precision layout) */}
      <div className="border-hairline bg-zinc-950 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
          {/* Photo & Core Name */}
          <div className="flex items-start gap-4">
            <div className="relative w-24 h-24 md:w-28 md:h-28 bg-zinc-900 border-hairline overflow-hidden shrink-0">
              <img
                src={dog.primaryPhotoUrl}
                alt={dog.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setSelectedPhoto(dog.primaryPhotoUrl)}
              />
              <span className="absolute bottom-0 left-0 right-0 bg-black/80 font-mono text-[9px] text-center text-amber-400 py-0.5">
                {dog.photos.length} PHOTOS
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-amber-500 uppercase tracking-widest">
                  OFFICIAL PASSPORT // TH-{dog.microchipId.slice(-6)}
                </span>
                <span className="status-dot w-2 h-2 bg-emerald-500" />
              </div>

              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">
                  {dog.name}
                </h2>
                {dog.thaiName && (
                  <span className="font-body text-base text-zinc-400">
                    ({dog.thaiName})
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-300 font-mono">
                {dog.breed} {dog.thaiBreed ? `· ${dog.thaiBreed}` : ''}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="font-mono text-[10px] bg-zinc-900 border-hairline px-2 py-0.5 text-zinc-300">
                  SEX: {dog.sex.toUpperCase()} ({dog.isNeutered ? 'NEUTERED' : 'INTACT'})
                </span>
                <span className="font-mono text-[10px] bg-zinc-900 border-hairline px-2 py-0.5 text-zinc-300">
                  WEIGHT: {dog.weightKg} KG
                </span>
                <span className="font-mono text-[10px] bg-zinc-900 border-hairline px-2 py-0.5 text-amber-400">
                  TRIBE: {dog.metaverseTribe}
                </span>
              </div>
            </div>
          </div>

          {/* Age & Birthday Highlight Box */}
          <div className="w-full md:w-auto border-hairline bg-black p-3 space-y-1.5 min-w-[220px]">
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 border-hairline-b pb-1">
              <span>CANINE METRICS</span>
              <span className="text-amber-500 font-bold">AGE CALCULATION</span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">CALENDAR AGE:</span>
              <span className="font-mono text-sm font-semibold text-white">
                {age.formattedCalendarAge}
              </span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">DOG YEARS:</span>
              <span className="font-mono text-sm font-semibold text-amber-400">
                ≈ {age.dogYears} yrs (Prime)
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1 border-hairline-t">
              <span className="text-[11px] text-zinc-400">NEXT BIRTHDAY:</span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {age.isBirthdayToday ? '🎉 TODAY!' : `IN ${age.daysUntilNextBirthday} DAYS`}
              </span>
            </div>

            <span className="block font-mono text-[9px] text-zinc-500 text-right">
              Born: {dog.birthDate} (Nov 17, 2021)
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="mt-4 pt-3 border-hairline-t flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={onOpenReconstruction}
              className="btn btn-accent text-[11px] py-1.5"
            >
              <Sparkles size={12} /> 3D PHOTO RECONSTRUCTION ({dog.photos.length} ANGLES)
            </button>
            <button
              onClick={() => setShowAddVaccineModal(true)}
              className="btn text-[11px] py-1.5"
            >
              <Plus size={12} /> RECORD VACCINE
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExportPassportJson} className="btn text-[10px] py-1">
              <Download size={11} /> EXPORT JSON
            </button>
            <button onClick={handlePrintPassport} className="btn text-[10px] py-1">
              <Printer size={11} /> PRINT PASSPORT
            </button>
          </div>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex border-hairline bg-zinc-950 font-mono text-xs">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`py-2 px-3 border-hairline-r ${
            activeSubTab === 'overview' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          IDENTITY & QUIRKS
        </button>
        <button
          onClick={() => setActiveSubTab('vaccines')}
          className={`py-2 px-3 border-hairline-r ${
            activeSubTab === 'vaccines' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          VACCINE PASSPORT ({dog.vaccinations.length})
        </button>
        <button
          onClick={() => setActiveSubTab('parasites')}
          className={`py-2 px-3 border-hairline-r ${
            activeSubTab === 'parasites' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          PARASITE CONTROL ({dog.parasiteControl.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`py-2 px-3 border-hairline-r ${
            activeSubTab === 'history' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          MEDICAL LOGS ({dog.medicalHistory.length})
        </button>
        <button
          onClick={() => setActiveSubTab('photos')}
          className={`py-2 px-3 ${
            activeSubTab === 'photos' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          PHOTO VAULT ({dog.photos.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="border-hairline bg-zinc-950 p-4">
        {/* OVERVIEW PANEL */}
        {activeSubTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Distinctive Marks & Breed Features */}
            <div className="space-y-3">
              <h4 className="font-display text-xs text-amber-500 uppercase tracking-widest border-hairline-b pb-1">
                DISTINCTIVE PHYSICAL MARKS // BANGKAEW ATTRIBUTES
              </h4>
              <ul className="space-y-1.5 text-xs">
                {dog.distinctiveMarks.map((mark, i) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-300">
                    <span className="text-amber-500 font-mono text-[10px] mt-0.5">▪</span>
                    <span>{mark}</span>
                  </li>
                ))}
              </ul>

              <h4 className="font-display text-xs text-amber-500 uppercase tracking-widest border-hairline-b pb-1 pt-3">
                DAILY HABITS & QUIRKS
              </h4>
              <ul className="space-y-1.5 text-xs">
                {dog.quirks.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-300">
                    <span className="text-amber-500 font-mono text-[10px] mt-0.5">▪</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Personality Traits, Diet & Emergency Contacts */}
            <div className="space-y-3">
              <h4 className="font-display text-xs text-amber-500 uppercase tracking-widest border-hairline-b pb-1">
                TEMPERAMENT & PERSONALITY
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {dog.personalityTraits.map((t, i) => (
                  <span
                    key={i}
                    className="font-mono text-[10px] bg-zinc-900 border-hairline text-zinc-200 px-2 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <h4 className="font-display text-xs text-amber-500 uppercase tracking-widest border-hairline-b pb-1 pt-3">
                DIETARY PREFERENCES & TOYS
              </h4>
              <div className="text-xs space-y-1">
                <p>
                  <span className="text-zinc-500 font-mono text-[10px]">FAVORITE FOOD: </span>
                  <span className="text-zinc-200">{dog.favoriteFood}</span>
                </p>
                <p>
                  <span className="text-zinc-500 font-mono text-[10px]">FAVORITE TOY: </span>
                  <span className="text-zinc-200">{dog.favoriteToy}</span>
                </p>
              </div>

              <h4 className="font-display text-xs text-amber-500 uppercase tracking-widest border-hairline-b pb-1 pt-3">
                VETERINARY & EMERGENCY CONTACTS
              </h4>
              <div className="text-xs space-y-1 bg-black p-2.5 border-hairline font-mono">
                <p className="flex justify-between">
                  <span className="text-zinc-500 text-[10px]">PRIMARY CLINIC:</span>
                  <span className="text-zinc-200">{dog.primaryVetClinic}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-zinc-500 text-[10px]">EMERGENCY 24/7:</span>
                  <span className="text-amber-400">{dog.emergencyPhone}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-zinc-500 text-[10px]">MICROCHIP:</span>
                  <span className="text-zinc-300">{dog.microchipId}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VACCINES PANEL */}
        {activeSubTab === 'vaccines' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-hairline-b pb-2">
              <span className="font-mono text-xs text-zinc-400">
                OFFICIAL VACCINATION PASSPORT // MANDATORY & PREVENTATIVE
              </span>
              <button
                onClick={() => setShowAddVaccineModal(true)}
                className="btn btn-accent text-[10px] py-1"
              >
                <Plus size={11} /> RECORD NEW DOSE
              </button>
            </div>

            <div className="divide-y divide-zinc-800">
              {dog.vaccinations.map((vac) => {
                const status = getVaccineStatus(vac.nextDueDate);
                return (
                  <div key={vac.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-white">{vac.name}</span>
                        <span className="font-mono text-[9px] bg-zinc-800 px-1.5 py-0.2 uppercase text-zinc-400">
                          {vac.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        Batch: {vac.batchNumber} · Administered at {vac.clinic} ({vac.veterinarian})
                      </p>
                      {vac.notes && <p className="text-[11px] text-zinc-500 italic">{vac.notes}</p>}
                    </div>

                    <div className="text-right sm:shrink-0">
                      <div className="font-mono text-xs">
                        <span className="text-zinc-500 text-[10px] block">GIVEN: {vac.dateAdministered}</span>
                        <span className="text-zinc-400 text-[10px] block">DUE: {vac.nextDueDate}</span>
                      </div>
                      <span
                        className={`inline-block font-mono text-[9px] font-bold px-2 py-0.5 mt-1 border ${
                          status.status === 'valid'
                            ? 'border-emerald-500/60 text-emerald-400 bg-emerald-950/20'
                            : status.status === 'expiring-soon'
                            ? 'border-amber-500/60 text-amber-400 bg-amber-950/20'
                            : 'border-rose-500/60 text-rose-400 bg-rose-950/20'
                        }`}
                      >
                        {status.badgeLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PARASITE CONTROL PANEL */}
        {activeSubTab === 'parasites' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-hairline-b pb-2">
              <span className="font-mono text-xs text-zinc-400">
                MONTHLY FLEA, TICK & HEARTWORM PREVENTATIVE CALENDAR
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dog.parasiteControl.map((pc) => (
                <div key={pc.id} className="border-hairline p-3 bg-black space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-display text-sm font-semibold text-white">{pc.brand}</span>
                    <span className="font-mono text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5">
                      {pc.target.toUpperCase()}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-zinc-400 space-y-0.5 pt-1">
                    <p className="flex justify-between">
                      <span className="text-zinc-500 text-[10px]">LAST GIVEN:</span>
                      <span>{pc.dateAdministered}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-zinc-500 text-[10px]">NEXT DUE:</span>
                      <span className="text-emerald-400 font-semibold">{pc.nextDueDate}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-zinc-500 text-[10px]">GIVEN BY:</span>
                      <span>{pc.administeredBy}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEDICAL HISTORY PANEL */}
        {activeSubTab === 'history' && (
          <div className="space-y-3">
            <div className="border-hairline-b pb-2">
              <span className="font-mono text-xs text-zinc-400">
                CLINICAL EXAMS, DENTAL WORK & LABORATORY RECORDS
              </span>
            </div>

            <div className="space-y-2">
              {dog.medicalHistory.map((rec) => (
                <div key={rec.id} className="border-hairline p-3 bg-black space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-amber-500 uppercase font-semibold">
                      {rec.category.toUpperCase()} · {rec.date}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      WEIGHT: {rec.weightAtTimeKg} KG
                    </span>
                  </div>
                  <h5 className="font-display text-sm font-semibold text-white">{rec.summary}</h5>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">{rec.vetNotes}</p>
                  <span className="font-mono text-[9px] text-zinc-500 block pt-1">
                    Clinic: {rec.clinic}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHOTOS VAULT PANEL */}
        {activeSubTab === 'photos' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-hairline-b pb-2">
              <span className="font-mono text-xs text-zinc-400">
                EXPO'S CAPTURED PHOTO ARCHIVE FOR 3D STITCHING
              </span>
              <button onClick={onOpenReconstruction} className="btn btn-accent text-[10px] py-1">
                <Sparkles size={11} /> LAUNCH 3D PIPELINE
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dog.photos.map((p) => (
                <div
                  key={p.id}
                  className="border-hairline bg-black p-2 cursor-pointer group"
                  onClick={() => setSelectedPhoto(p.url)}
                >
                  <div className="aspect-square bg-zinc-900 overflow-hidden mb-2 relative">
                    <img
                      src={p.url}
                      alt={p.notes || dog.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/80 font-mono text-[9px] text-amber-400 px-1 py-0.5">
                      {p.angle.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-300 truncate">{p.notes}</p>
                  <span className="font-mono text-[9px] text-zinc-500">{p.dateTaken}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Vaccine Modal */}
      {showAddVaccineModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-zinc-950 border border-amber-500/80 w-full max-w-md p-4 text-zinc-100 space-y-3">
            <div className="flex justify-between items-center border-hairline-b pb-2">
              <h4 className="font-display text-base text-white">RECORD VACCINE DOSE</h4>
              <button onClick={() => setShowAddVaccineModal(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVaccine} className="space-y-3 text-xs">
              <div>
                <label className="font-mono text-[10px] text-zinc-400 block mb-1">VACCINE NAME</label>
                <input
                  type="text"
                  value={vacName}
                  onChange={(e) => setVacName(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono text-[10px] text-zinc-400 block mb-1">DATE GIVEN</label>
                  <input
                    type="date"
                    value={vacDate}
                    onChange={(e) => setVacDate(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-zinc-400 block mb-1">NEXT DUE DATE</label>
                  <input
                    type="date"
                    value={vacNextDue}
                    onChange={(e) => setVacNextDue(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono text-[10px] text-zinc-400 block mb-1">BATCH NUMBER</label>
                  <input
                    type="text"
                    value={vacBatch}
                    onChange={(e) => setVacBatch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-zinc-400 block mb-1">CLINIC / VET</label>
                  <input
                    type="text"
                    value={vacClinic}
                    onChange={(e) => setVacClinic(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-hairline-t">
                <button
                  type="button"
                  onClick={() => setShowAddVaccineModal(false)}
                  className="btn text-xs py-1 px-3"
                >
                  CANCEL
                </button>
                <button type="submit" className="btn btn-accent text-xs py-1 px-3">
                  SAVE TO PASSPORT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={selectedPhoto} alt="Expo Full View" className="max-w-full max-h-[85vh] object-contain border-hairline" />
            <span className="font-mono text-xs text-zinc-400 text-center block mt-2">
              EXPO · THAI BANGKAEW · CLICK ANYWHERE TO CLOSE
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
