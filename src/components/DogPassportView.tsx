import React, { useEffect, useRef, useState } from 'react';
import { DogProfile, Vaccination } from '../types/dog';
import { calculateDogAge, getVaccineStatus } from '../utils/dogCalculators';
import {
  Camera,
  Download,
  Pill,
  Plus,
  Printer,
  Sparkles,
  Stethoscope,
  Syringe,
  X,
} from 'lucide-react';

interface DogPassportViewProps {
  dog: DogProfile;
  onUpdateDog: (updated: DogProfile) => void;
  onOpenReconstruction: () => void;
}

type SubTabKey = 'overview' | 'vaccines' | 'parasites' | 'history' | 'photos';

interface SubTabDef {
  key: SubTabKey;
  label: string;
  noun: string; // used for the screen-reader label of the count
}

const SUB_TABS: SubTabDef[] = [
  { key: 'overview', label: 'Identity', noun: 'recorded details' },
  { key: 'vaccines', label: 'Vaccines', noun: 'vaccinations' },
  { key: 'parasites', label: 'Parasites', noun: 'parasite records' },
  { key: 'history', label: 'History', noun: 'medical records' },
  { key: 'photos', label: 'Photos', noun: 'photos' },
];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Dates are read as dates, never as UTC-shifted ISO strings. */
const formatDate = (iso: string): string => {
  if (!iso) return 'Not recorded';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
};

const todayIso = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const TARGET_LABEL: Record<string, string> = {
  'flea-tick-heartworm': 'Flea, tick & heartworm',
  'flea-tick': 'Flea & tick',
  heartworm: 'Heartworm',
  'all-in-one': 'All in one',
};

const CATEGORY_LABEL: Record<string, string> = {
  checkup: 'Checkup',
  treatment: 'Treatment',
  surgery: 'Surgery',
  dental: 'Dental',
  dietary: 'Dietary',
};

const ANGLE_LABEL: Record<string, string> = {
  front: 'Front',
  side: 'Side',
  closeup: 'Close-up',
  body: 'Full body',
  other: 'Other',
};

/**
 * A photo grid takes its column count from the number of photos, so the last
 * row never leaves a single tile stranded. When no count divides the photos
 * cleanly, the last tile spans the row instead of sitting alone.
 */
const photoGrid = (count: number): { cols: string; spanLast: boolean } => {
  if (count <= 1) return { cols: 'grid-cols-1', spanLast: false };
  if (count === 2) return { cols: 'grid-cols-2', spanLast: false };
  if (count === 3) return { cols: 'grid-cols-3', spanLast: false };
  if (count === 4) return { cols: 'grid-cols-2', spanLast: false };
  if (count <= 6) return { cols: 'grid-cols-3', spanLast: false };
  if (count % 3 === 0) return { cols: 'grid-cols-3', spanLast: false };
  if (count % 4 === 0) return { cols: 'grid-cols-4', spanLast: false };
  if (count % 3 === 1) return { cols: 'grid-cols-4', spanLast: true };
  return { cols: 'grid-cols-3', spanLast: false };
};

/** One row of a definition list: sans label, sans or mono value. */
const DefRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
    <dt className="label">{label}</dt>
    <dd className="text-xs text-zinc-200">{children}</dd>
  </div>
);

/** A compact label/value cell for grids of facts. */
const FactCell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="label">{label}</dt>
    <dd className="mt-0.5 text-xs text-zinc-200">{children}</dd>
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}

/** Every list states what to do next — an empty box teaches nothing. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action }) => (
  <div className="mt-3 border-hairline p-4">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-zinc-500">
        {icon}
      </span>
      <h4 className="font-display text-sm text-zinc-100">{title}</h4>
    </div>
    <p className="mt-1.5 max-w-prose text-xs text-zinc-400">{body}</p>
    {action && <div className="mt-3">{action}</div>}
  </div>
);

const VaccineStatus: React.FC<{ status: ReturnType<typeof getVaccineStatus> }> = ({ status }) => {
  // Colour marks the exception only: a current dose is quiet, a lapsed one is not.
  const tone =
    status.status === 'expired'
      ? 'text-rose-400'
      : status.status === 'expiring-soon'
        ? 'text-amber-400'
        : 'text-zinc-300';
  const word =
    status.status === 'expired' ? 'Expired' : status.status === 'expiring-soon' ? 'Due soon' : 'Current';
  const detail =
    status.status === 'expired'
      ? `${Math.abs(status.daysRemaining)} days ago`
      : status.status === 'expiring-soon'
        ? `in ${status.daysRemaining} days`
        : `${status.daysRemaining} days left`;

  return (
    <div className="text-xs">
      <div className={`font-body font-semibold ${tone}`}>{word}</div>
      <div className="data text-[11px] text-zinc-500">{detail}</div>
    </div>
  );
};

export const DogPassportView: React.FC<DogPassportViewProps> = ({
  dog,
  onUpdateDog,
  onOpenReconstruction,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('overview');
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const recordRef = useRef<HTMLDivElement>(null);
  const vaccineDialogRef = useRef<HTMLDialogElement>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Partial<Record<SubTabKey, HTMLButtonElement | null>>>({});

  const [printedOn] = useState(() => formatDate(todayIso()));

  // New vaccine form state. Nothing here is invented: the clinic is the dog's
  // own clinic from the record, the date is today, and every other field is
  // filled by the person recording the dose.
  const [vacName, setVacName] = useState('');
  const [vacType, setVacType] = useState<'core' | 'non-core'>('core');
  const [vacDate, setVacDate] = useState(todayIso());
  const [vacNextDue, setVacNextDue] = useState('');
  const [vacBatch, setVacBatch] = useState('');
  const [vacClinic, setVacClinic] = useState('');
  const [vacVet, setVacVet] = useState('');

  const age = calculateDogAge(dog.birthDate, dog.weightKg);
  const hasPortrait = Boolean(dog.primaryPhotoUrl);

  const counts: Record<SubTabKey, number> = {
    overview:
      dog.distinctiveMarks.length +
      dog.quirks.length +
      dog.personalityTraits.length +
      (dog.favoriteFood ? 1 : 0) +
      (dog.favoriteToy ? 1 : 0) +
      (dog.primaryVetClinic ? 1 : 0) +
      (dog.emergencyPhone ? 1 : 0),
    vaccines: dog.vaccinations.length,
    parasites: dog.parasiteControl.length,
    history: dog.medicalHistory.length,
    photos: dog.photos.length,
  };

  // The record's own facts: what is written down, nothing more.
  const facts: { label: string; mono: boolean; value: React.ReactNode }[] = [
    {
      label: 'Sex',
      mono: false,
      value: `${dog.sex}, ${dog.isNeutered ? 'neutered' : 'intact'}`,
    },
    { label: 'Weight', mono: true, value: `${dog.weightKg} kg` },
    { label: 'Born', mono: true, value: formatDate(dog.birthDate) },
    { label: 'Calendar age', mono: true, value: age.formattedCalendarAge },
    { label: 'Dog years', mono: true, value: `about ${age.dogYears}` },
    {
      label: 'Next birthday',
      mono: false,
      value: age.isBirthdayToday ? (
        <span className="font-body font-semibold text-accent">Today</span>
      ) : (
        <>
          <span className="data">{age.daysUntilNextBirthday}</span>{' '}
          <span className="font-body">days</span>
        </>
      ),
    },
    { label: 'Microchip', mono: true, value: dog.microchipId || 'Not recorded' },
    { label: 'Coat', mono: false, value: dog.coatColor || 'Not recorded' },
  ];

  // Native <dialog> owns focus trapping and Escape-to-close; we only mirror state.
  useEffect(() => {
    const el = vaccineDialogRef.current;
    if (!el) return;
    if (showAddVaccineModal && !el.open) el.showModal();
    if (!showAddVaccineModal && el.open) el.close();
  }, [showAddVaccineModal]);

  useEffect(() => {
    const el = lightboxRef.current;
    if (!el) return;
    if (selectedPhoto && !el.open) el.showModal();
    if (!selectedPhoto && el.open) el.close();
  }, [selectedPhoto]);

  /** Open a blank form — the clinic comes from this dog's record. */
  const openVaccineDialog = () => {
    setVacName('');
    setVacType('core');
    setVacDate(todayIso());
    setVacNextDue('');
    setVacBatch('');
    setVacClinic(dog.primaryVetClinic ?? '');
    setVacVet('');
    setShowAddVaccineModal(true);
  };

  const handleAddVaccine = (e: React.FormEvent) => {
    e.preventDefault();
    const newVac: Vaccination = {
      id: `vac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: vacName.trim(),
      type: vacType,
      dateAdministered: vacDate,
      nextDueDate: vacNextDue,
      batchNumber: vacBatch.trim(),
      clinic: vacClinic.trim(),
      veterinarian: vacVet.trim(),
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

  /**
   * Print the record, not the app. The chrome (header, footer, 3D stage) lives
   * in App.tsx, so the record is printed in an isolated frame carrying the same
   * stylesheets; only the passport container is copied into it.
   */
  const handlePrintPassport = () => {
    const source = recordRef.current;
    if (!source) {
      window.print();
      return;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1200px;height:1600px;border:0;';
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      window.print();
      return;
    }

    const styles = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"], style'),
    )
      .map((node) => node.outerHTML)
      .join('');

    doc.open();
    doc.write(
      `<!doctype html><html><head><base href=${JSON.stringify(document.baseURI)}><meta charset="utf-8">${styles}</head><body class="bg-white text-black">${source.outerHTML}</body></html>`,
    );
    doc.close();

    const print = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    };

    const images = Array.from(doc.images);
    const unresolved = images.filter((img) => !img.complete);
    if (unresolved.length === 0) {
      setTimeout(print, 60);
    } else {
      let pending = unresolved.length;
      unresolved.forEach((img) => {
        img.addEventListener('load', () => {
          pending -= 1;
          if (pending === 0) setTimeout(print, 60);
        });
      });
    }

    frame.contentWindow?.addEventListener('afterprint', () => frame.remove());
    setTimeout(() => frame.remove(), 15000);
  };

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = SUB_TABS.findIndex((tab) => tab.key === activeSubTab);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % SUB_TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + SUB_TABS.length) % SUB_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SUB_TABS.length - 1;
    else return;

    e.preventDefault();
    const key = SUB_TABS[next].key;
    setActiveSubTab(key);
    tabRefs.current[key]?.focus();
  };

  const renderPanel = (key: SubTabKey) => {
    switch (key) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <section>
                <h4 className="font-display text-sm text-zinc-100">Distinctive marks</h4>
                {dog.distinctiveMarks.length === 0 ? (
                  <p className="mt-1.5 text-xs text-zinc-500">No marks recorded.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {dog.distinctiveMarks.map((mark, i) => (
                      <li key={i} className="text-xs leading-relaxed text-zinc-300">
                        {mark}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="font-display text-sm text-zinc-100">Daily habits and quirks</h4>
                {dog.quirks.length === 0 ? (
                  <p className="mt-1.5 text-xs text-zinc-500">No habits recorded.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {dog.quirks.map((quirk, i) => (
                      <li key={i} className="text-xs leading-relaxed text-zinc-300">
                        {quirk}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section>
                <h4 className="font-display text-sm text-zinc-100">Temperament</h4>
                {dog.personalityTraits.length === 0 ? (
                  <p className="mt-1.5 text-xs text-zinc-500">No traits recorded.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {dog.personalityTraits.map((trait, i) => (
                      <li key={i} className="text-xs leading-relaxed text-zinc-300">
                        {trait}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="font-display text-sm text-zinc-100">Diet and toys</h4>
                <dl className="mt-1.5 space-y-1.5">
                  <DefRow label="Favorite food">{dog.favoriteFood || 'Not recorded'}</DefRow>
                  <DefRow label="Favorite toy">{dog.favoriteToy || 'Not recorded'}</DefRow>
                </dl>
              </section>

              <section>
                <h4 className="font-display text-sm text-zinc-100">Veterinary contacts</h4>
                <dl className="mt-1.5 space-y-1.5">
                  <DefRow label="Primary clinic">{dog.primaryVetClinic || 'Not recorded'}</DefRow>
                  <DefRow label="Emergency 24/7">
                    <span className="data">{dog.emergencyPhone || 'Not recorded'}</span>
                  </DefRow>
                </dl>
              </section>
            </div>
          </div>
        );

      case 'vaccines':
        return (
          <section aria-labelledby="vaccines-heading">
            <div className="border-hairline-b pb-2">
              <h3 id="vaccines-heading" className="font-display text-base text-zinc-100">
                Vaccination passport
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Mandatory and preventative doses, with the date each one falls due
              </p>
            </div>

            {dog.vaccinations.length === 0 ? (
              <EmptyState
                icon={<Syringe size={14} />}
                title="No vaccinations recorded"
                body="The passport is empty. Record the first dose — batch number, date given and next due date — to start the schedule."
                action={
                  <button
                    type="button"
                    onClick={openVaccineDialog}
                    className="btn btn-accent no-print min-h-11"
                  >
                    <Plus size={13} aria-hidden="true" /> Record the first dose
                  </button>
                }
              />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <caption className="sr-only">
                    Vaccinations for {dog.name}: batch, dates given and due, and current status.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="label border-hairline-b py-2 pr-4 font-semibold">
                        Vaccine
                      </th>
                      <th scope="col" className="label border-hairline-b py-2 pr-4 font-semibold">
                        Batch
                      </th>
                      <th scope="col" className="label border-hairline-b py-2 pr-4 font-semibold">
                        Given
                      </th>
                      <th scope="col" className="label border-hairline-b py-2 pr-4 font-semibold">
                        Due
                      </th>
                      <th scope="col" className="label border-hairline-b py-2 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dog.vaccinations.map((vac) => {
                      const status = getVaccineStatus(vac.nextDueDate);
                      const meta = [
                        vac.type === 'core' ? 'Core vaccine' : 'Non-core vaccine',
                        vac.clinic,
                        vac.veterinarian,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <tr key={vac.id} className="align-top">
                          <td className="border-hairline-b py-2 pr-4">
                            <div className="text-sm text-zinc-100">{vac.name}</div>
                            {meta && <div className="text-xs text-zinc-500">{meta}</div>}
                            {vac.notes && <div className="mt-0.5 text-xs text-zinc-400">{vac.notes}</div>}
                          </td>
                          <td className="border-hairline-b py-2 pr-4">
                            <span className="data text-xs text-zinc-300">
                              {vac.batchNumber || 'Not recorded'}
                            </span>
                          </td>
                          <td className="border-hairline-b py-2 pr-4">
                            <span className="data text-xs text-zinc-300">
                              {formatDate(vac.dateAdministered)}
                            </span>
                          </td>
                          <td className="border-hairline-b py-2 pr-4">
                            <span className="data text-xs text-zinc-300">
                              {formatDate(vac.nextDueDate)}
                            </span>
                          </td>
                          <td className="border-hairline-b py-2">
                            <VaccineStatus status={status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );

      case 'parasites':
        return (
          <section aria-labelledby="parasites-heading">
            <div className="border-hairline-b pb-2">
              <h3 id="parasites-heading" className="font-display text-base text-zinc-100">
                Parasite control
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Flea, tick and heartworm prevention, with the date each dose falls due
              </p>
            </div>

            {dog.parasiteControl.length === 0 ? (
              <EmptyState
                icon={<Pill size={14} />}
                title="No parasite schedule"
                body="Nothing is tracked yet. Add each monthly dose with its date given and the next due date so the interval never lapses."
              />
            ) : (
              <div className="mt-1">
                {dog.parasiteControl.map((pc) => (
                  <article key={pc.id} className="border-hairline-b py-3 last:border-hairline-b-0">
                    <h4 className="font-display text-sm text-zinc-100">{pc.brand}</h4>
                    <dl className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
                      <FactCell label="Targets">
                        {TARGET_LABEL[pc.target] ?? pc.target}
                      </FactCell>
                      <FactCell label="Last given">
                        <span className="data">{formatDate(pc.dateAdministered)}</span>
                      </FactCell>
                      <FactCell label="Next due">
                        <span className="data">{formatDate(pc.nextDueDate)}</span>
                      </FactCell>
                      <FactCell label="Given by">{pc.administeredBy || 'Not recorded'}</FactCell>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        );

      case 'history':
        return (
          <section aria-labelledby="history-heading">
            <div className="border-hairline-b pb-2">
              <h3 id="history-heading" className="font-display text-base text-zinc-100">
                Medical logs
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Clinical exams, dental work and laboratory records, with the weight of the day
              </p>
            </div>

            {dog.medicalHistory.length === 0 ? (
              <EmptyState
                icon={<Stethoscope size={14} />}
                title="No medical records"
                body="Exams, dental work and lab results collect here, each with the weight recorded on the day."
              />
            ) : (
              <div className="mt-1">
                {dog.medicalHistory.map((rec) => (
                  <article key={rec.id} className="border-hairline-b py-3 last:border-hairline-b-0">
                    <h4 className="font-display text-sm text-zinc-100">{rec.summary}</h4>
                    {rec.vetNotes && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-300">{rec.vetNotes}</p>
                    )}
                    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
                      <FactCell label="Date">
                        <span className="data">{formatDate(rec.date)}</span>
                      </FactCell>
                      <FactCell label="Type">
                        {CATEGORY_LABEL[rec.category] ?? rec.category}
                      </FactCell>
                      <FactCell label="Clinic">{rec.clinic || 'Not recorded'}</FactCell>
                      <FactCell label="Weight">
                        <span className="data">{rec.weightAtTimeKg} kg</span>
                      </FactCell>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        );

      case 'photos': {
        const grid = photoGrid(dog.photos.length);
        return (
          <section aria-labelledby="photos-heading">
            <div className="border-hairline-b pb-2">
              <h3 id="photos-heading" className="font-display text-base text-zinc-100">
                Photo archive
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Captured frames of {dog.name}, the only input the 3D pipeline can work from
              </p>
            </div>

            {dog.photos.length === 0 ? (
              <EmptyState
                icon={<Camera size={14} />}
                title="No photos captured"
                body="The archive is empty. Capture a front, side and close-up frame to build the avatar mesh."
                action={
                  <button
                    type="button"
                    onClick={onOpenReconstruction}
                    className="btn btn-accent no-print min-h-11"
                  >
                    <Sparkles size={13} aria-hidden="true" /> Open the 3D pipeline
                  </button>
                }
              />
            ) : (
              <div className={`mt-3 grid gap-3 ${grid.cols}`}>
                {dog.photos.map((p, i) => {
                  const isLast = i === dog.photos.length - 1;
                  const spans = grid.spanLast && isLast;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPhoto(p.url)}
                      title={p.notes ? `${p.notes} — ${formatDate(p.dateTaken)}` : formatDate(p.dateTaken)}
                      className={`block w-full flex-col items-stretch justify-start gap-0 border-hairline bg-black p-2 text-left hover:bg-zinc-900 ${
                        spans ? 'col-span-full' : ''
                      }`}
                    >
                      <span
                        className={`relative mb-2 block w-full overflow-hidden bg-zinc-900 ${
                          spans ? 'aspect-[16/9]' : 'aspect-square'
                        }`}
                      >
                        <img
                          src={p.url}
                          alt={p.notes || `${dog.name}, ${ANGLE_LABEL[p.angle] ?? p.angle} view`}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className="line-clamp-2 font-body text-xs text-zinc-300">
                        {p.notes || 'No note recorded'}
                      </span>
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {ANGLE_LABEL[p.angle] ?? p.angle}
                      </span>
                      <span className="data block text-[11px] text-zinc-500">
                        {formatDate(p.dateTaken)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      }
    }
  };

  return (
    <div className="w-full">
      <div ref={recordRef} className="print-sheet border-hairline bg-zinc-950">
        {/* Print-only masthead: a printed record must say whose it is and when. */}
        <div className="print-only border-hairline-b px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <h2 className="font-display text-2xl text-black">{dog.name}</h2>
              <p className="text-sm text-zinc-700">
                {dog.breed}
                {dog.thaiBreed ? `, ${dog.thaiBreed}` : ''}
              </p>
            </div>
            <dl className="flex gap-6">
              <div>
                <dt className="label">Microchip</dt>
                <dd className="data text-sm text-zinc-900">{dog.microchipId || 'Not recorded'}</dd>
              </div>
              <div>
                <dt className="label">Printed</dt>
                <dd className="data text-sm text-zinc-900">{printedOn}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Identity. The portrait fills its column of the grid, so it never sits
            stranded beside a taller block of text. */}
        <section
          className={`grid grid-cols-1 gap-4 p-4 sm:gap-5 ${
            hasPortrait ? 'sm:grid-cols-[6rem_minmax(0,1fr)]' : ''
          }`}
          aria-labelledby="identity-heading"
        >
          <div className="min-w-0 sm:col-start-2 sm:row-start-1">
            <h2 id="identity-heading" className="font-display text-2xl text-white">
              {dog.name}
            </h2>
            {dog.thaiName && (
              <p className="mt-0.5 font-body text-base text-zinc-400">{dog.thaiName}</p>
            )}
            <p className="mt-1 text-sm text-zinc-300">
              {dog.breed}
              {dog.thaiBreed ? `, ${dog.thaiBreed}` : ''}
            </p>
            {dog.metaverseTribe && (
              <p className="mt-1 text-xs text-zinc-400">{dog.metaverseTribe}</p>
            )}
          </div>

          {hasPortrait && (
            <button
              type="button"
              onClick={() => setSelectedPhoto(dog.primaryPhotoUrl)}
              aria-label={`Open the full-size portrait of ${dog.name}`}
              className="relative block min-h-[6rem] w-full overflow-hidden border-hairline bg-zinc-900 hover:bg-zinc-800 sm:col-start-1 sm:row-start-1"
            >
              <img
                src={dog.primaryPhotoUrl}
                alt={`${dog.name}, ${dog.breed}`}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </button>
          )}
        </section>

        {/* The record's facts, in columns that line up. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-hairline-t px-4 py-4 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="label">{fact.label}</dt>
              <dd className={`mt-0.5 text-sm text-zinc-100 ${fact.mono ? 'data' : ''}`}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Actions: one row, four controls, two columns on a narrow screen so
            no control is ever left alone on the last row. */}
        <div className="no-print grid grid-cols-2 gap-2 border-hairline-t px-4 py-3 sm:grid-cols-4">
          <button type="button" onClick={openVaccineDialog} className="btn btn-accent min-h-11">
            <Syringe size={13} aria-hidden="true" /> Record dose
          </button>
          <button type="button" onClick={onOpenReconstruction} className="btn min-h-11">
            <Sparkles size={13} aria-hidden="true" /> 3D reconstruction
          </button>
          <button type="button" onClick={handleExportPassportJson} className="btn min-h-11">
            <Download size={13} aria-hidden="true" /> Export JSON
          </button>
          <button type="button" onClick={handlePrintPassport} className="btn min-h-11">
            <Printer size={13} aria-hidden="true" /> Print passport
          </button>
        </div>

        {/* Tabs */}
        <div className="no-print border-hairline-t overflow-x-auto">
          <div role="tablist" aria-label="Passport sections" className="flex w-max min-w-full">
            {SUB_TABS.map((tab) => {
              const selected = activeSubTab === tab.key;
              const count = counts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => {
                    tabRefs.current[tab.key] = el;
                  }}
                  onClick={() => setActiveSubTab(tab.key)}
                  onKeyDown={onTabKeyDown}
                  aria-label={count > 0 ? `${tab.label}, ${count} ${tab.noun}` : tab.label}
                  className={`flex min-h-11 shrink-0 items-baseline gap-1.5 whitespace-nowrap border-0 bg-transparent px-3 py-2 font-body text-xs hover:bg-zinc-900 hover:text-zinc-100 ${
                    selected ? 'border-b-2 border-accent text-zinc-100' : 'text-zinc-400'
                  }`}
                >
                  {tab.label}
                  {count > 0 && <span className="data text-[11px] text-zinc-500">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panels */}
        <div className="p-4">
          {SUB_TABS.map((tab) => (
            <div
              key={tab.key}
              role="tabpanel"
              id={`panel-${tab.key}`}
              aria-labelledby={`tab-${tab.key}`}
              tabIndex={0}
              // Inactive panels stay in the sheet so a printed record carries every section.
              className={activeSubTab === tab.key ? '' : 'print-only'}
            >
              {renderPanel(tab.key)}
            </div>
          ))}
        </div>
      </div>

      {/* Add vaccine modal */}
      <dialog
        ref={vaccineDialogRef}
        onClose={() => setShowAddVaccineModal(false)}
        onClick={(e) => {
          // Backdrop clicks land on the dialog element itself.
          if (e.target === e.currentTarget) setShowAddVaccineModal(false);
        }}
        aria-labelledby="vaccine-dialog-title"
        className="m-auto max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto border border-hairline bg-zinc-950 p-4 text-zinc-100 [&::backdrop]:bg-black"
      >
        <div className="flex items-start justify-between gap-3 border-hairline-b pb-2">
          <h3 id="vaccine-dialog-title" className="font-display text-base text-white">
            Record vaccine dose
          </h3>
          <button
            type="button"
            onClick={() => setShowAddVaccineModal(false)}
            aria-label="Close the vaccine form"
            className="btn-quiet min-h-11 min-w-11 p-1"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleAddVaccine} className="mt-3 space-y-3">
          <div>
            <label htmlFor="vac-name" className="label mb-1 block">
              Vaccine name
            </label>
            <input
              id="vac-name"
              type="text"
              value={vacName}
              onChange={(e) => setVacName(e.target.value)}
              placeholder="e.g. Rabies booster"
              className="w-full"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="vac-type" className="label mb-1 block">
                Vaccine type
              </label>
              <select
                id="vac-type"
                value={vacType}
                onChange={(e) => setVacType(e.target.value === 'non-core' ? 'non-core' : 'core')}
                className="w-full"
              >
                <option value="core">Core</option>
                <option value="non-core">Non-core</option>
              </select>
            </div>

            <div>
              <label htmlFor="vac-batch" className="label mb-1 block">
                Batch number
              </label>
              <input
                id="vac-batch"
                type="text"
                value={vacBatch}
                onChange={(e) => setVacBatch(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="vac-date" className="label mb-1 block">
                Date given
              </label>
              <input
                id="vac-date"
                type="date"
                value={vacDate}
                onChange={(e) => setVacDate(e.target.value)}
                className="w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="vac-next-due" className="label mb-1 block">
                Next due date
              </label>
              <input
                id="vac-next-due"
                type="date"
                value={vacNextDue}
                onChange={(e) => setVacNextDue(e.target.value)}
                className="w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="vac-clinic" className="label mb-1 block">
                Clinic
              </label>
              <input
                id="vac-clinic"
                type="text"
                value={vacClinic}
                onChange={(e) => setVacClinic(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="vac-vet" className="label mb-1 block">
                Veterinarian
              </label>
              <input
                id="vac-vet"
                type="text"
                value={vacVet}
                onChange={(e) => setVacVet(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-hairline-t pt-3">
            <button type="button" onClick={() => setShowAddVaccineModal(false)} className="btn min-h-11">
              Cancel
            </button>
            <button type="submit" className="btn btn-accent min-h-11">
              Save to passport
            </button>
          </div>
        </form>
      </dialog>

      {/* Photo lightbox */}
      <dialog
        ref={lightboxRef}
        onClose={() => setSelectedPhoto(null)}
        onClick={(e) => {
          // The backdrop closes; the photograph itself does not.
          if (e.target === e.currentTarget) setSelectedPhoto(null);
        }}
        aria-labelledby="lightbox-caption"
        className="m-auto max-h-[92vh] max-w-3xl border-0 bg-transparent p-0 [&::backdrop]:bg-black"
      >
        <div className="relative">
          <img
            src={selectedPhoto ?? ''}
            alt={`${dog.name}, full view`}
            className="max-h-[85vh] w-auto max-w-full border-hairline object-contain"
          />
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            aria-label="Close the photo viewer"
            className="btn btn-quiet absolute right-1 top-1 min-h-11 min-w-11 bg-black p-1"
          >
            <X size={14} aria-hidden="true" />
          </button>
          <p id="lightbox-caption" className="mt-2 text-center font-body text-xs text-zinc-300">
            {dog.name}
            {dog.breed ? `, ${dog.breed}` : ''}
            <span className="block text-zinc-500">
              Press Escape or click outside to close.
            </span>
          </p>
        </div>
      </dialog>
    </div>
  );
};
