import React, { useState } from 'react';
import { DogProfile } from '../types/dog';
import { calculateDogAge, getVaccineStatus } from '../utils/dogCalculators';
import { Printer, Download, Dna, ShieldCheck, Camera, X } from 'lucide-react';

interface ClinicalArchiveViewProps {
  dog: DogProfile;
  onOpenReconstruction: () => void;
}

/**
 * THE CLINICAL RECORD IS A RECORD, NOT A SHOWCASE.
 *
 * Everything on this page is a fact that was written down: an identity, a
 * measurement, a vaccination, a note. Nothing here is a claim the app cannot
 * back up — no "official travel certification", no breed-standard conformity
 * check nobody performed, no polygon count for a mesh that does not exist.
 * A veterinary record is read by someone making a decision about an animal.
 * A page that decorates itself with invented precision is worse than no page.
 */
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
    downloadAnchor.setAttribute('download', `${dog.name.toLowerCase()}-record.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // The photo grid takes its column count from the number of photos, so a
  // single photo is not left alone in a three-wide row.
  const photoColumns = dog.photos.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  const facts: { label: string; value: string }[] = [
    { label: 'Microchip', value: dog.microchipId },
    { label: 'Date of birth', value: dog.birthDate },
    { label: 'Calendar age', value: age.formattedCalendarAge },
    { label: 'Dog years', value: `about ${age.dogYears}` },
    { label: 'Sex', value: `${dog.sex}${dog.isNeutered ? ', neutered' : ', intact'}` },
    { label: 'Weight', value: `${dog.weightKg} kg` },
    { label: 'Coat', value: dog.coatColor },
    { label: 'Clinic', value: dog.primaryVetClinic },
    { label: 'Emergency', value: dog.emergencyPhone },
  ];

  return (
    <div className="space-y-4">
      {/* ---- the record's actions ------------------------------------------ */}
      <div className="border-hairline bg-surface p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h2 className="font-display text-base text-white">Clinical record</h2>
          <p className="text-[12px] text-zinc-400">
            Every entry here was written down on this device. Nothing is sent anywhere.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportJson} className="btn">
            <Download size={13} aria-hidden="true" />
            Export record
          </button>
          <button onClick={handlePrint} className="btn btn-accent">
            <Printer size={13} aria-hidden="true" />
            Print record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start print-sheet">
        {/* ---- identity ----------------------------------------------------- */}
        <section className="lg:col-span-3 border-hairline bg-surface p-4">
          <h3 className="font-display text-sm text-white flex items-center gap-2 border-hairline-b pb-2">
            <Dna size={13} aria-hidden="true" />
            Identity
          </h3>

          <dl className="mt-3">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex items-baseline justify-between gap-3 py-1.5 border-hairline-b last:border-b-0"
              >
                <dt className="label">{fact.label}</dt>
                <dd className="data text-[11px] text-zinc-200 text-right">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4">
            <p className="label">Recorded markings</p>
            <ul className="mt-1.5 space-y-1">
              {dog.distinctiveMarks.map((mark) => (
                <li key={mark} className="text-[12px] text-zinc-300 leading-snug">
                  {mark}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <p className="label">Temperament</p>
            <ul className="mt-1.5 space-y-1">
              {dog.personalityTraits.map((trait) => (
                <li key={trait} className="text-[12px] text-zinc-300 leading-snug">
                  {trait}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- photographs and the model ------------------------------------ */}
        <section className="lg:col-span-5 border-hairline bg-surface p-4">
          <h3 className="font-display text-sm text-white flex items-center gap-2 border-hairline-b pb-2">
            <Camera size={13} aria-hidden="true" />
            Photographs
          </h3>

          {dog.photos.length === 0 ? (
            <div className="mt-3 border-hairline p-4 text-center">
              <p className="text-[12px] text-zinc-400">
                No photographs on this record yet. A photograph is the only input the 3D
                pipeline can work from.
              </p>
              <button onClick={onOpenReconstruction} className="btn btn-accent mt-3">
                Add a photograph
              </button>
            </div>
          ) : (
            <>
              <div className={`mt-3 grid ${photoColumns} gap-2`}>
                {dog.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="border-hairline bg-black p-1.5 text-left group"
                  >
                    <span className="relative block aspect-square w-full bg-zinc-900 overflow-hidden mb-1">
                      <img
                        src={photo.url}
                        alt={`${dog.name}, ${photo.angle} view`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/90 text-[9px] text-zinc-200 px-1 py-0.5">
                        {photo.angle}
                      </span>
                    </span>
                    <span className="data block text-[10px] text-zinc-400 truncate">
                      {photo.dateTaken}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-hairline-t pt-3">
                <p className="label">3D model</p>
                {dog.avatarConfig.customModelUrl ? (
                  <p className="text-[12px] text-zinc-300 mt-1">
                    A model file is attached to this record. The avatar in the command deck is
                    drawn procedurally, so the file is stored but not rendered yet.
                  </p>
                ) : (
                  <p className="text-[12px] text-zinc-300 mt-1">
                    No model file. The avatar in the command deck is drawn procedurally from
                    this record&apos;s colours and markings.
                  </p>
                )}
                <button onClick={onOpenReconstruction} className="btn mt-3">
                  Add photographs or a model
                </button>
              </div>
            </>
          )}
        </section>

        {/* ---- the medical ledger ------------------------------------------- */}
        <section className="lg:col-span-4 border-hairline bg-surface p-4">
          <h3 className="font-display text-sm text-white flex items-center gap-2 border-hairline-b pb-2">
            <ShieldCheck size={13} aria-hidden="true" />
            Medical ledger
          </h3>

          {dog.vaccinations.length === 0 && dog.parasiteControl.length === 0 ? (
            <p className="mt-3 text-[12px] text-zinc-400">
              No vaccinations or parasite treatments are on this record.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {dog.vaccinations.map((vac) => {
                const status = getVaccineStatus(vac.nextDueDate);
                const tone =
                  status.status === 'valid'
                    ? 'text-zinc-300 border-zinc-700'
                    : status.status === 'expiring-soon'
                      ? 'text-amber-400 border-amber-500/50'
                      : 'text-red-400 border-red-500/50';
                return (
                  <article key={vac.id} className="border-hairline bg-black p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[12px] font-semibold text-zinc-100">{vac.name}</h4>
                      <span className={`text-[10px] border px-1.5 py-0.5 whitespace-nowrap ${tone}`}>
                        {status.badgeLabel}
                      </span>
                    </div>
                    <dl className="mt-1.5 space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <dt className="label">Given</dt>
                        <dd className="data text-[10px] text-zinc-400">{vac.dateAdministered}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="label">Next due</dt>
                        <dd className="data text-[10px] text-zinc-400">{vac.nextDueDate}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="label">Batch</dt>
                        <dd className="data text-[10px] text-zinc-400 truncate">{vac.batchNumber}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="label">Clinic</dt>
                        <dd className="text-[10px] text-zinc-400 truncate">{vac.clinic}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}

              {dog.parasiteControl.map((pc) => {
                const status = getVaccineStatus(pc.nextDueDate);
                const tone =
                  status.status === 'valid'
                    ? 'text-zinc-300 border-zinc-700'
                    : status.status === 'expiring-soon'
                      ? 'text-amber-400 border-amber-500/50'
                      : 'text-red-400 border-red-500/50';
                return (
                  <article key={pc.id} className="border-hairline bg-black p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[12px] font-semibold text-zinc-100">{pc.brand}</h4>
                      <span className={`text-[10px] border px-1.5 py-0.5 whitespace-nowrap ${tone}`}>
                        {status.badgeLabel}
                      </span>
                    </div>
                    <dl className="mt-1.5 space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <dt className="label">Given</dt>
                        <dd className="data text-[10px] text-zinc-400">{pc.dateAdministered}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="label">Next due</dt>
                        <dd className="data text-[10px] text-zinc-400">{pc.nextDueDate}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}

          {dog.medicalHistory.length > 0 && (
            <div className="mt-4">
              <p className="label">History</p>
              <ul className="mt-1.5 space-y-2">
                {dog.medicalHistory.map((entry) => (
                  <li key={entry.id} className="border-hairline-t pt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-zinc-200">{entry.summary}</span>
                      <span className="data text-[10px] text-zinc-500">{entry.date}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{entry.vetNotes}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ---- the photograph, opened ---------------------------------------- */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 no-print"
          onClick={() => setSelectedPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${dog.name} photograph`}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="btn-quiet absolute -top-9 right-0"
              aria-label="Close photograph"
            >
              <X size={15} aria-hidden="true" />
            </button>
            <img
              src={selectedPhoto}
              alt={`${dog.name}, detail`}
              className="max-w-full max-h-[85vh] object-contain border-hairline"
            />
            <span className="block text-[12px] text-zinc-400 text-center mt-2">
              {dog.name}. Click anywhere to close.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
