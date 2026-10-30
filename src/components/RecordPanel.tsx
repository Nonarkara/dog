import {recordSources,recordExport,type ClinicalField} from '../utils/recordProvenance';
import type {CommitDog} from '../utils/progressStore';
import React, { useEffect, useRef, useState } from 'react';
import { DogProfile, Vaccination } from '../types/dog';
import { calculateDogAge, getVaccineStatus } from '../utils/dogCalculators';
import {
  Box,
  ChevronLeft,
  CircleAlert,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Pill,
  Printer,
  Stethoscope,
  Syringe,
  Upload,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';

/**
 * THE RECORD, IN ONE PANEL.
 *
 * This panel replaces two views that said the same thing twice: the passport
 * and the clinical archive both drew an identity, a photo grid and a medical
 * ledger, and the reader paid for the duplication twice. One panel, five tabs,
 * one copy of every fact.
 *
 * TABS ARE THE ANSWER TO A FIXED FRAME.
 *
 * The app is one screen and nothing scrolls, so a record cannot be a column
 * that grows. Splitting the record into five tabs lets every section have its
 * full density — a two-column fact grid, a row per dose, a ledger — without
 * anything pushing the frame taller. What comes up comes up as a BAR: the
 * dose form, the pipeline reference, the tool list and the model picker are
 * all slim overlays anchored to the bottom of this panel. There is no modal
 * here, and nothing covers the animal while it is used.
 *
 * THE HONESTY IS THE POINT.
 *
 * The 3D pipeline is a reference, not a job this app performs: there is no
 * mesh generator, no optimiser and no exporter behind it. The avatar in the
 * command deck is drawn procedurally from the record's colours. Saying so is
 * the difference between a document and a claim.
 */

export interface RecordPanelProps {
  dog: DogProfile;
  onUpdateDog: CommitDog;
  onAddPhoto: (url: string, angle: 'front' | 'side' | 'closeup' | 'body') => Promise<boolean>;
}

type TabKey = 'identity' | 'vaccines' | 'parasites' | 'history' | 'photos';
type BarKey = 'pipeline' | 'tools' | 'model' | 'vaccine';
type CaptureAngle = 'front' | 'side' | 'closeup' | 'body';

interface TabDef {
  key: TabKey;
  label: string;
  noun: string;
}

const TABS: TabDef[] = [
  { key: 'identity', label: 'Identity', noun: 'recorded facts' },
  { key: 'vaccines', label: 'Vaccines', noun: 'vaccinations' },
  { key: 'parasites', label: 'Parasites', noun: 'parasite records' },
  { key: 'history', label: 'History', noun: 'medical records' },
  { key: 'photos', label: 'Photos', noun: 'photos' },
];

const ANGLES: CaptureAngle[] = ['front', 'side', 'closeup', 'body'];

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
 * A GRID THAT NEVER STRANDS A PHOTO.
 *
 * The column count is taken from the number of photos, and when the count
 * does not divide by the columns the LAST photo spans the rest of its row —
 * so every row is either full or holds one tile that has been given the
 * width it needed. A single photo sitting alone beside empty cells is a hole
 * in the record, and the old clinical view had exactly that.
 */
const photoGrid = (count: number): { cols: string; lastSpan: string } => {
  if (count <= 1) return { cols: 'grid-cols-1', lastSpan: '' };
  const cols = count <= 4 ? count : 4;
  const remainder = count % cols;
  const span = remainder === 0 ? 0 : cols - remainder + 1;
  return {
    cols: `grid-cols-${cols}`,
    lastSpan: span === 0 ? '' : `col-span-${span}`,
  };
};

/**
 * The pipeline stages are a REFERENCE, not a job this app performs: they are
 * what an operator runs on a machine with a GPU. Keeping them as data (tool,
 * command, artefact) makes the difference between "documented" and "done"
 * impossible to miss.
 */
const STAGES = [
  {
    code: '01',
    name: 'Capture the real dog',
    tool: 'Phone camera, video walkaround',
    does: 'The only stage that produces EXPO. Thirty to sixty overlapping frames, moving in ARCS and never panning — a pure rotation gives structure-from-motion nothing to triangulate.',
    command: 'phone camera → frames/',
    output: 'the frames of this actual animal',
  },
  {
    code: '02',
    name: 'Camera poses & sparse cloud',
    tool: 'COLMAP 4.2',
    does: 'Solves where the camera stood for each frame, then refines the sparse point cloud so the frames agree with one another. Every splat trainer downstream reads these poses.',
    command: 'colmap feature_extractor → mapper',
    output: 'sparse/ — cameras.bin, points3D.bin',
  },
  {
    code: '03',
    name: 'Surface or splat',
    tool: 'OpenMVS, Nerfstudio, SfM',
    does: 'Either a mesh (OpenMVS densify → mesh → texture) or a 3D Gaussian Splat, which is the faithful option for a living animal: fur is exactly what a mesh cannot reproduce.',
    command: 'openMVS DensifyPointCloud · nerfstudio splatfacto',
    output: 'mesh.ply, or a trained splat .ply',
  },
  {
    code: '04',
    name: 'Rigging & skinning',
    tool: 'Blender, Rigify, AssetFurnace',
    does: 'Builds the bone hierarchy and skins the mesh to it. This is what makes the result animatable rather than a frozen lump — and it is the hard part.',
    command: 'blender --background rig.py',
    output: 'dog-rig.glb',
  },
];

const TOOLS = [
  {
    name: 'TRELLIS.2',
    org: 'microsoft/TRELLIS.2',
    href: 'https://github.com/microsoft/TRELLIS.2',
    does: 'The best downloadable open image-to-3D model: 4B parameters, MIT licence with no revenue or territory clause, native PBR, multi-view conditioning, GLB export.',
    output: 'textured, PBR-mapped .glb',
  },
  {
    name: 'Pixal3D',
    org: 'TencentARC',
    href: 'https://github.com/tencentarc/Pixal3D',
    does: 'Pixel-aligned image-to-3D on a TRELLIS.2 backbone, with a C++/GGML port that runs on Apple Silicon. Keeps flat colours in one pass.',
    output: 'textured .glb',
  },
  {
    name: 'AssetFurnace',
    org: 'Bingeljell/image-to-3dlab',
    href: 'https://github.com/Bingeljell/image-to-3dlab',
    does: 'The whole pipeline in one place, and the one that matters here: prompt or picture → textured, RIGGED, animated character, locally on Apple Silicon. Auto-rig plus 21 moves.',
    output: 'rigged .glb with animation clips',
  },
  {
    name: 'COLMAP',
    org: 'colmap/colmap',
    href: 'https://github.com/colmap/colmap',
    does: 'Structure-from-motion and multi-view stereo, BSD licence, with ready-made Apple Silicon builds. The standard first step of every photogrammetry workflow.',
    output: 'camera poses, sparse cloud, mesh',
  },
  {
    name: 'Hunyuan3D',
    org: 'Tencent-Hunyuan/Hunyuan3D-2',
    href: 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2',
    does: 'Best-in-class texture and PBR quality. Note the licence: the community terms exclude the EU, UK and South Korea.',
    output: 'PBR-textured .obj / .glb',
  },
];

const PIPELINE_HONESTY =
  'Reference only. Tama-Dog-Chi runs no reconstruction: there is no mesh generator, no optimiser and no exporter behind it. This is the workflow an operator runs on a machine.';

const TOOLS_HONESTY =
  'Linked, not connected. Tama-Dog-Chi neither installs nor calls these projects.';

/**
 * PRINT RELEASES THE FRAME.
 *
 * On paper the record is a document, not a region of a screen: it takes its
 * own height, every section is present, and nothing is truncated. These
 * utilities release the fixed-frame sizing that keeps the screen honest.
 */
const PRINT_AUTO =
  'print:[height:auto] print:[min-height:auto] print:[flex:none] print:overflow-visible';

/* A truncated line on screen, the whole sentence on paper. */
const PRINT_FULL = 'print:whitespace-normal print:overflow-visible print:text-overflow-clip';

/** Colour marks the exception only: a lapsed dose is loud, a current one is quiet. */
const statusTone = (status: 'valid' | 'expiring-soon' | 'expired'): string =>
  status === 'expired' ? 'text-rose-400' : status === 'expiring-soon' ? 'text-accent' : 'text-zinc-400';

const statusWord = (status: 'valid' | 'expiring-soon' | 'expired', days: number): string =>
  status === 'expired'
    ? `Date passed ${Math.abs(days)}d`
    : status === 'expiring-soon'
      ? `Date in ${days}d`
      : `Date in ${days}d`;

interface HeadButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

/** A small icon control in the panel head. */
const HeadButton: React.FC<HeadButtonProps> = ({ label, icon, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`btn-quiet min-h-8 min-w-8 p-0 ${active ? 'text-accent' : ''}`}
  >
    {icon}
  </button>
);

interface ProseListProps {
  title: string;
  items: string[];
  empty: string;
}

/**
 * A recorded observation. On screen it is one line — the panel has no room
 * for an essay — and the full sentence is in the tooltip and on the printout.
 */
const ProseList: React.FC<ProseListProps> = ({ title, items, empty }) => (
  <section className="mb-2 last:mb-0">
    <h4 className="label">
      {title} <span className="data text-zinc-500">{items.length}</span>
    </h4>
    {items.length === 0 ? (
      <p className="mt-0.5 text-[11px] text-zinc-500">{empty}</p>
    ) : (
      <ul className="mt-0.5 space-y-0.5">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            title={item}
            className={`truncate text-[11px] leading-4 text-zinc-300 ${PRINT_FULL}`}
          >
            {item}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const RecordPanel: React.FC<RecordPanelProps> = ({ dog, onUpdateDog, onAddPhoto }) => {
  const doseSaving=useRef(false);
  const [isDoseSaving,setIsDoseSaving]=useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [activeBar, setActiveBar] = useState<BarKey | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [captureAngle, setCaptureAngle] = useState<CaptureAngle>('front');
  const [modelUrl, setModelUrl] = useState('');

  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  // The dose form. Nothing here is invented: the clinic is this dog's own
  // clinic from the record, the date is today, and every other field is
  // filled in by the person recording the dose.
  const [vacName, setVacName] = useState('');
  const [vacType, setVacType] = useState<'core' | 'non-core'>('core');
  const [vacDate, setVacDate] = useState(todayIso());
  const [vacNextDue, setVacNextDue] = useState('');
  const [vacBatch, setVacBatch] = useState('');
  const [vacClinic, setVacClinic] = useState('');
  const [vacVet, setVacVet] = useState('');

  const sources=recordSources(dog);
  const example=(key:ClinicalField)=>sources.fields.includes(key);
  const age = calculateDogAge(dog.birthDate, dog.weightKg);
  const printedOn = formatDate(todayIso());

  /* A note says its thing once and is dismissed. It never waits for a click. */
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 6000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const counts: Record<TabKey, number> = {
    identity:
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

  const closeBar = () => {
    if(doseSaving.current)return;
    setActiveBar(null);
    setExpandedStage(null);
  };

  const openBar = (bar: BarKey) => {
    setActiveBar((current) => (current === bar ? null : bar));
    setExpandedStage(null);
  };

  /* ---- the dose form ----------------------------------------------------- */

  const openVaccineBar = () => {
    setVacName('');
    setVacType('core');
    setVacDate(todayIso());
    setVacNextDue('');
    setVacBatch('');
    setVacClinic(example('primaryVetClinic')?'':dog.primaryVetClinic ?? '');
    setVacVet('');
    setActiveBar('vaccine');
    setExpandedStage(null);
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if(doseSaving.current)return;
    doseSaving.current=true;setIsDoseSaving(true);
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
    const saved=await onUpdateDog(latest=>({...latest,vaccinations:[newVac,...latest.vaccinations]}));
    doseSaving.current=false;setIsDoseSaving(false);
    if(!saved){setNote({tone:'error',text:'Vaccine record was not saved. Please try again.'});return;}
    closeBar();
    setNote({ tone: 'ok', text: `${newVac.name} recorded on ${dog.name}'s passport.` });
  };

  /* ---- export and print -------------------------------------------------- */

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(recordExport(dog), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${dog.name.toLowerCase()}-record.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNote({ tone: 'ok', text: `${dog.name}'s record exported as JSON.` });
  };

  const handlePrint = () => {
    window.print();
  };

  /* ---- photographs -------------------------------------------------------- */

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      if(!await onAddPhoto(reader.result,captureAngle)){setNote({tone:'error',text:'Photo was not saved. Please try again.'});return;}
      setNote({
        tone: 'ok',
        text: `Photo stored on ${dog.name}'s record at ${ANGLE_LABEL[captureAngle].toLowerCase()}.`,
      });
    };
    reader.readAsDataURL(file);
  };

  /* ---- the model file ------------------------------------------------------ */

  const isModelFile = (name: string) => /\.(glb|gltf)$/i.test(name);

  const handleModelInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isModelFile(file.name)) {
      setNote({
        tone: 'error',
        text: `${file.name} is not a .glb or .gltf file, so it was not attached.`,
      });
      return;
    }
    const modelReference=URL.createObjectURL(file);
    if(!await onUpdateDog(latest=>({...latest,avatarConfig:{...latest.avatarConfig,customModelUrl:modelReference}}))){URL.revokeObjectURL(modelReference);setNote({tone:'error',text:'Model reference was not saved.'});return;}
    setNote({
      tone: 'ok',
      text: `${file.name} read in this browser. Its reference is stored on ${dog.name}'s record.`,
    });
  };

  const handleModelUrl = async () => {
    const url = modelUrl.trim();
    if (!url) {
      setNote({ tone: 'error', text: 'Enter a model URL first.' });
      return;
    }
    if(!await onUpdateDog(latest=>({...latest,avatarConfig:{...latest.avatarConfig,customModelUrl:url}}))){setNote({tone:'error',text:'Model URL was not saved.'});return;}
    setModelUrl('');
    setNote({ tone: 'ok', text: `URL stored on ${dog.name}'s record.` });
  };

  const handleClearModel = async () => {
    if(!await onUpdateDog(latest=>{const {customModelUrl:_dropped,...rest}=latest.avatarConfig;return {...latest,avatarConfig:rest};})){setNote({tone:'error',text:'Model reference could not be removed.'});return;}
    setNote({ tone: 'ok', text: 'Model reference removed from this record.' });
  };

  /* ---- tabs ---------------------------------------------------------------- */

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((tab) => tab.key === activeTab);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;

    e.preventDefault();
    const key = TABS[next].key;
    setActiveTab(key);
    setPreviewPhotoId(null);
    tabRefs.current[key]?.focus();
  };

  const selectTab = (key: TabKey) => {
    setActiveTab(key);
    setPreviewPhotoId(null);
  };

  /* ---- identity ------------------------------------------------------------ */

  const exampleField=(label:string)=>{
    const key:Record<string,ClinicalField>={'Microchip':'microchipId','Date of birth':'birthDate','Calendar age':'birthDate','Dog years':'birthDate','Next birthday':'birthDate','Sex':'isNeutered','Weight':'weightKg','Primary clinic':'primaryVetClinic','Emergency 24/7':'emergencyPhone'};
    return key[label]?example(key[label]):false;
  };
  const identityFacts: { label: string; mono: boolean; value: React.ReactNode }[] = [
    { label: 'Microchip', mono: true, value: dog.microchipId || 'Not recorded' },
    { label: 'Date of birth', mono: true, value: formatDate(dog.birthDate) },
    { label: 'Calendar age', mono: true, value: age.formattedCalendarAge },
    { label: 'Dog years', mono: true, value: dog.birthDate ? `about ${age.dogYears}` : 'Not recorded' },
    {
      label: 'Next birthday',
      mono: false,
      value: !dog.birthDate ? 'Not recorded' : age.isBirthdayToday ? (
        <span className="font-body font-semibold text-accent">Today</span>
      ) : (
        <>
          <span className="data">{age.daysUntilNextBirthday}</span>{' '}
          <span className="font-body">days</span>
        </>
      ),
    },
    {
      label: 'Sex',
      mono: false,
      value: `${dog.sex}, ${dog.isNeutered===null ? 'neuter status not recorded' : dog.isNeutered ? 'neutered' : 'intact'}`,
    },
    { label: 'Weight', mono: true, value: dog.weightKg > 0 ? `${dog.weightKg} kg` : 'Not recorded' },
    { label: 'Coat', mono: false, value: dog.coatColor || 'Not recorded' },
    { label: 'Primary clinic', mono: false, value: dog.primaryVetClinic || 'Not recorded' },
    {
      label: 'Emergency 24/7',
      mono: true,
      value: dog.emergencyPhone || 'Not recorded',
    },
  ];

  /* ---- the record's own sections ------------------------------------------ */

  const identityPanel = (
    <div className={`grid h-full grid-cols-2 gap-x-3 ${PRINT_AUTO}`}>
      {/* Facts and measurements: written down, line against line. */}
      <div className="min-w-0 pr-1">
        <div className="border-hairline-b pb-1">
          <h3 className="truncate font-display text-base text-zinc-100" title={dog.name}>
            {dog.name}
          </h3>
          <p className="truncate text-[11px] text-zinc-400" title={dog.breed}>
            {dog.thaiName ? `${dog.thaiName} / ` : ''}
            {dog.breed}
            {dog.thaiBreed ? `, ${dog.thaiBreed}` : ''}
          </p>
        </div>
        <dl className="mt-1">
          {identityFacts.map((fact) => (
            <div
              key={fact.label}
              className="flex items-baseline justify-between gap-2 border-hairline-b py-1 last:border-hairline-b-0"
            >
              <dt className="label shrink-0" title={exampleField(fact.label)?'Starter example, unverified':undefined}>{fact.label}{exampleField(fact.label)?' †':''}</dt>
              <dd
                className={`min-w-0 truncate text-right text-[11px] text-zinc-200 ${
                  fact.mono ? 'data' : ''
                } ${PRINT_FULL}`}
                title={typeof fact.value === 'string' ? fact.value : undefined}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* The dog itself: marks, habits, temperament, the things it likes. */}
      <div className="min-w-0">
        <ProseList
          title="Distinctive marks"
          items={dog.distinctiveMarks}
          empty="No marks recorded."
        />
        <ProseList
          title="Daily habits & quirks"
          items={dog.quirks}
          empty="No habits recorded."
        />
        <ProseList
          title="Temperament"
          items={dog.personalityTraits}
          empty="No traits recorded."
        />
        <section className="mb-2 last:mb-0">
          <h4 className="label">Favourites</h4>
          <dl className="mt-0.5 space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[11px] text-zinc-500">Food</dt>
              <dd
                className={`min-w-0 truncate text-right text-[11px] text-zinc-300 ${PRINT_FULL}`}
                title={dog.favoriteFood || undefined}
              >
                {dog.favoriteFood || 'Not recorded'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[11px] text-zinc-500">Toy</dt>
              <dd
                className={`min-w-0 truncate text-right text-[11px] text-zinc-300 ${PRINT_FULL}`}
                title={dog.favoriteToy || undefined}
              >
                {dog.favoriteToy || 'Not recorded'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );

  const vaccinesPanel = (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-hairline-b pb-1.5">
        <div className="min-w-0">
          <h3 className="font-display text-xs text-zinc-100">Vaccination passport</h3>
          <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
            Stored doses and the next dates entered with each record.
          </p>
        </div>
        <button
          type="button"
          onClick={openVaccineBar}
          className="btn btn-accent min-h-7 shrink-0 px-2 text-[11px]"
        >
          <Syringe size={12} aria-hidden="true" /> Record a dose
        </button>
      </div>

      <div className={`panel-scroll min-h-0 ${PRINT_AUTO}`}>
        {dog.vaccinations.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            No doses recorded. Record the first one — batch number, date given and next due date —
            to start the schedule.
          </p>
        ) : (
          <div className="mt-1">
            {dog.vaccinations.map((vac) => {
              const status = getVaccineStatus(vac.nextDueDate),sample=sources.vaccinations.includes(vac.id);
              const meta = [
                vac.type === 'core' ? 'Core vaccine' : 'Non-core vaccine',
                vac.clinic,
                vac.veterinarian,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <article
                  key={vac.id}
                  className="border-hairline-b py-1.5 last:border-hairline-b-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className={`min-w-0 truncate text-xs font-semibold text-zinc-100 ${PRINT_FULL}`}
                      title={vac.name}
                    >
                      {vac.name}
                    </h4>
                    <span
                      className={`shrink-0 text-[10px] font-semibold ${sample ? 'text-faint' : statusTone(status.status)}`}
                    >
                      {sample?'Starter example':statusWord(status.status, status.daysRemaining)}
                    </span>
                  </div>
                  <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`} title={meta}>
                    {meta}
                  </p>
                  <p className={`data truncate text-[10px] text-zinc-400 ${PRINT_FULL}`}>
                    Given {formatDate(vac.dateAdministered)}, due {formatDate(vac.nextDueDate)},
                    Batch {vac.batchNumber || 'not recorded'}
                  </p>
                  {vac.notes && (
                    <p
                      className={`truncate text-[10px] text-zinc-400 ${PRINT_FULL}`}
                      title={sample?`Example note (unverified): ${vac.notes}`:vac.notes}
                    >
                      {sample?`Example note (unverified): “${vac.notes}”`:vac.notes}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const parasitesPanel = (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-hairline-b pb-1.5">
        <h3 className="font-display text-xs text-zinc-100">Parasite control</h3>
        <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
          Flea, tick and heartworm prevention, with the date each dose falls due.
        </p>
      </div>

      <div className={`panel-scroll min-h-0 ${PRINT_AUTO}`}>
        {dog.parasiteControl.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Nothing is tracked yet. Add each monthly dose with its date given and the next due
            date so the interval never lapses.
          </p>
        ) : (
          <div className="mt-1">
            {dog.parasiteControl.map((pc) => {
              const status = getVaccineStatus(pc.nextDueDate),sample=sources.parasiteControl.includes(pc.id);
              const target = TARGET_LABEL[pc.target] ?? pc.target;
              return (
                <article
                  key={pc.id}
                  className="border-hairline-b py-1.5 last:border-hairline-b-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className={`min-w-0 truncate text-xs font-semibold text-zinc-100 ${PRINT_FULL}`}
                      title={pc.brand}
                    >
                      {pc.brand}
                    </h4>
                    <span
                      className={`shrink-0 text-[10px] font-semibold ${sample ? 'text-faint' : statusTone(status.status)}`}
                    >
                      {sample?'Starter example':statusWord(status.status, status.daysRemaining)}
                    </span>
                  </div>
                  <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`} title={target}>
                    {target}
                  </p>
                  <p className={`data truncate text-[10px] text-zinc-400 ${PRINT_FULL}`}>
                    Given {formatDate(pc.dateAdministered)}, due {formatDate(pc.nextDueDate)}, by{' '}
                    {pc.administeredBy || 'not recorded'}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const historyPanel = (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-hairline-b pb-1.5">
        <h3 className="font-display text-xs text-zinc-100">Medical log</h3>
        <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
          Clinical exams, dental work and laboratory records, with the weight of the day.
        </p>
      </div>

      <div className={`panel-scroll min-h-0 ${PRINT_AUTO}`}>
        {dog.medicalHistory.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            No medical records. Exams, dental work and lab results collect here, each with the
            weight recorded on the day.
          </p>
        ) : (
          <div className="mt-1">
            {dog.medicalHistory.map((rec) => (
              <article
                key={rec.id}
                className="border-hairline-b py-1.5 last:border-hairline-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4
                    className={`min-w-0 truncate text-xs font-semibold text-zinc-100 ${PRINT_FULL}`}
                    title={rec.summary}
                  >
                    {rec.summary}
                  </h4>
                  <span className="data shrink-0 text-[10px] text-zinc-500">
                    {formatDate(rec.date)}
                  </span>
                </div>
                <p className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
                  {sources.medicalHistory.includes(rec.id)?'Starter example · ':''}{CATEGORY_LABEL[rec.category] ?? rec.category}, {rec.clinic || 'Clinic not recorded'}{' '}
                  {rec.weightAtTimeKg} kg
                </p>
                {rec.vetNotes && (
                  <p
                    className={`truncate text-[10px] text-zinc-400 ${PRINT_FULL}`}
                    title={sources.medicalHistory.includes(rec.id)?`Example note (unverified): ${rec.vetNotes}`:rec.vetNotes}
                  >
                    {sources.medicalHistory.includes(rec.id)?`Example note (unverified): “${rec.vetNotes}”`:rec.vetNotes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const grid = photoGrid(dog.photos.length);
  const previewPhoto = previewPhotoId
    ? dog.photos.find((p) => p.id === previewPhotoId) ?? null
    : null;

  const photosPanel = (
    <section className="flex min-h-0 flex-1 flex-col">
      {previewPhoto ? (
        /* The photograph is opened IN PLACE: the photo area of the panel is
           replaced by the large image. There is no lightbox, and nothing
           covers the record. */
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-hairline-b pb-1.5">
            <button
              type="button"
              onClick={() => setPreviewPhotoId(null)}
              className="btn btn-quiet min-h-7 shrink-0 px-2 text-[11px]"
            >
              <ChevronLeft size={12} aria-hidden="true" /> Back to archive
            </button>
            <span className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
              {ANGLE_LABEL[previewPhoto.angle] ?? previewPhoto.angle}{' '}
              {formatDate(previewPhoto.dateTaken)}
              {previewPhoto.notes ? `, ${previewPhoto.notes}` : ''}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
            <img
              src={previewPhoto.url}
              alt={`${dog.name}, ${ANGLE_LABEL[previewPhoto.angle] ?? previewPhoto.angle} view`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="no-print flex shrink-0 items-center gap-2 border-hairline-b pb-1.5">
            <label className="btn btn-accent min-h-7 shrink-0 cursor-pointer px-2 text-[11px]">
              <Upload size={12} aria-hidden="true" /> Add photo
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoInput}
                className="sr-only"
              />
            </label>
            <label htmlFor="record-capture-angle" className="sr-only">
              Capture angle
            </label>
            <select
              id="record-capture-angle"
              value={captureAngle}
              onChange={(e) => setCaptureAngle(e.target.value as CaptureAngle)}
              className="data min-h-7 shrink-0 py-0.5 text-[11px]"
            >
              {ANGLES.map((angle) => (
                <option key={angle} value={angle}>
                  {ANGLE_LABEL[angle]}
                </option>
              ))}
            </select>
            <span className={`truncate text-[10px] text-zinc-500 ${PRINT_FULL}`}>
              Capture date is stamped today — {formatDate(todayIso())}.
            </span>
          </div>

          <div className={`panel-scroll min-h-0 ${PRINT_AUTO}`}>
            {dog.photos.length === 0 ? (
              <div className="mt-2 flex items-start gap-2">
                <ImageIcon size={14} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <p className="text-[11px] text-zinc-400">
                  No photographs on this record yet. A photograph is the only input the 3D pipeline
                  can work from.
                </p>
              </div>
            ) : (
              <div className={`mt-1.5 grid gap-2 ${grid.cols} ${PRINT_AUTO}`}>
                {dog.photos.map((p, i) => {
                  const isLast = i === dog.photos.length - 1;
                  const span = isLast ? grid.lastSpan : '';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreviewPhotoId(p.id)}
                      title={p.notes ? `${p.notes} — ${formatDate(p.dateTaken)}` : formatDate(p.dateTaken)}
                      className={`record-photo block w-full min-w-0 flex-col items-stretch justify-start gap-0 border-hairline bg-black p-1.5 text-left hover:bg-zinc-900 ${span}`}
                    >
                      <span
                        className={`relative mb-1 block w-full overflow-hidden bg-zinc-900 ${
                          span ? 'aspect-[16/9]' : 'aspect-square'
                        } max-h-[9rem]`}
                      >
                        <img
                          src={p.url}
                          alt={p.notes || `${dog.name}, ${ANGLE_LABEL[p.angle] ?? p.angle} view`}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className={`block truncate text-[10px] text-zinc-300 ${PRINT_FULL}`}>
                        {p.notes || 'No note recorded'}
                      </span>
                      <span className="data mt-0.5 block truncate text-[9px] text-zinc-500">
                        {ANGLE_LABEL[p.angle] ?? p.angle}, {formatDate(p.dateTaken)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-hairline-t pt-1.5">
            <h4 className="label">3D model</h4>
            <p className={`truncate text-[10px] text-zinc-400 ${PRINT_FULL}`}>
              {dog.avatarConfig.customModelUrl
                ? 'An imported model is attached. The stage attempts to render it; built-in household dogs use illustrated artwork.'
                : 'No model attached. Household dogs use illustrated artwork; custom coats use the procedural fallback.'}
            </p>
          </div>
        </>
      )}
    </section>
  );

  const renderPanel = (key: TabKey): React.ReactNode => {
    switch (key) {
      case 'identity':
        return identityPanel;
      case 'vaccines':
        return vaccinesPanel;
      case 'parasites':
        return parasitesPanel;
      case 'history':
        return historyPanel;
      case 'photos':
        return photosPanel;
    }
  };

  return (
    <div
      className={`panel region-record print-sheet h-full w-full min-h-0 ${PRINT_AUTO} print:border-0`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && activeBar) {
          e.stopPropagation();
          closeBar();
        }
      }}
    >
      {/* ---- the region ---------------------------------------------------- */}
      <div className="panel-head no-print">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="shrink-0 font-display text-sm text-zinc-100">Record</h2>
          <span className="truncate text-[11px] text-zinc-500">
            {dog.name} / {dog.breed}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HeadButton
            label="Photogrammetry pipeline reference"
            icon={<Workflow size={14} aria-hidden="true" />}
            onClick={() => openBar('pipeline')}
            active={activeBar === 'pipeline'}
          />
          <HeadButton
            label="Open-source 3D tools"
            icon={<Wrench size={14} aria-hidden="true" />}
            onClick={() => openBar('tools')}
            active={activeBar === 'tools'}
          />
          <HeadButton
            label="Attach a 3D model file"
            icon={<Box size={14} aria-hidden="true" />}
            onClick={() => openBar('model')}
            active={activeBar === 'model'}
          />
          <HeadButton
            label="Export the record as JSON"
            icon={<Download size={14} aria-hidden="true" />}
            onClick={handleExport}
          />
          <HeadButton
            label="Print the record"
            icon={<Printer size={14} aria-hidden="true" />}
            onClick={handlePrint}
          />
        </div>
      </div>

      <div className={`panel-body ${PRINT_AUTO}`}>
        {/* ---- the tabs ----------------------------------------------------- */}
        <div
          role="tablist"
          aria-label="Record sections"
          className="no-print flex shrink-0 border-hairline-b bg-black"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`record-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`record-panel-${tab.key}`}
                aria-label={count > 0 ? `${tab.label}, ${count} ${tab.noun}` : tab.label}
                tabIndex={selected ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                onClick={() => selectTab(tab.key)}
                onKeyDown={onTabKeyDown}
                className={`flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 border-hairline-r px-1 text-[11px] ${
                  selected
                    ? 'border-b-2 border-accent bg-zinc-900 font-semibold text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span className="data shrink-0 text-[9px] text-zinc-500">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ---- the record --------------------------------------------------- */}
        <div className={`flex min-h-0 flex-1 flex-col ${PRINT_AUTO}`}>
          <p className="record-source-note text-[10px] leading-snug text-faint border-hairline-b pb-1 mb-1">† Starter examples; other entries owner/imported. Health facts unverified.</p>
          {/* A printed record carries every section, so the masthead is
              print-only and the inactive panels come back on paper. */}
          <div className="print-only border-hairline-b pb-2">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div>
                <h2 className="font-display text-xl">{dog.name}</h2>
                <p className="text-xs">
                  {dog.breed}
                  {dog.thaiBreed ? `, ${dog.thaiBreed}` : ''}
                </p>
              </div>
              <dl className="flex gap-6">
                <div>
                  <dt className="label">Microchip</dt>
                  <dd className="data text-xs">{dog.microchipId || 'Not recorded'}{example('microchipId')?' †':''}</dd>
                </div>
                <div>
                  <dt className="label">Printed</dt>
                  <dd className="data text-xs">{printedOn}</dd>
                </div>
              </dl>
            </div>
          </div>

          {TABS.map((tab) => (
            <div
              key={tab.key}
              role="tabpanel"
              id={`record-panel-${tab.key}`}
              aria-labelledby={`record-tab-${tab.key}`}
              tabIndex={0}
              className={
                // The record is a document, so its tab body SCROLLS when a
                // dog has more history than the region holds. It used to
                // clip: up to 465px of photos and doses were simply not
                // there, with nothing to say so. A scrollbar says so.
                activeTab === tab.key
                  ? `min-h-0 flex-1 overflow-y-auto ${PRINT_AUTO}`
                  : 'print-only'
              }
            >
              {renderPanel(tab.key)}
            </div>
          ))}
        </div>

        {/* ---- the bars ------------------------------------------------------ */}

        {/* THE DOSE FORM. A bar, not a modal: it sits over the bottom of the
            record and never covers the tab strip. */}
        {activeBar === 'vaccine' && (
          <form className="bar bar--stack no-print" onSubmit={handleAddVaccine}>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="col-span-2">
                <label htmlFor="record-vac-name" className="label mb-0.5 block">
                  Vaccine name
                </label>
                <input
                  id="record-vac-name"
                  type="text"
                  value={vacName}
                  onChange={(e) => setVacName(e.target.value)}
                  placeholder="e.g. Rabies booster"
                  required
                  className="w-full py-1 text-[11px]"
                />
              </div>
              <div>
                <label htmlFor="record-vac-type" className="label mb-0.5 block">
                  Type
                </label>
                <select
                  id="record-vac-type"
                  value={vacType}
                  onChange={(e) => setVacType(e.target.value === 'non-core' ? 'non-core' : 'core')}
                  className="w-full py-1 text-[11px]"
                >
                  <option value="core">Core</option>
                  <option value="non-core">Non-core</option>
                </select>
              </div>
              <div>
                <label htmlFor="record-vac-date" className="label mb-0.5 block">
                  Date given
                </label>
                <input
                  id="record-vac-date"
                  type="date"
                  value={vacDate}
                  onChange={(e) => setVacDate(e.target.value)}
                  required
                  className="data w-full py-1 text-[11px]"
                />
              </div>
              <div>
                <label htmlFor="record-vac-due" className="label mb-0.5 block">
                  Next due
                </label>
                <input
                  id="record-vac-due"
                  type="date"
                  value={vacNextDue}
                  onChange={(e) => setVacNextDue(e.target.value)}
                  required
                  className="data w-full py-1 text-[11px]"
                />
              </div>
              <div>
                <label htmlFor="record-vac-batch" className="label mb-0.5 block">
                  Batch
                </label>
                <input
                  id="record-vac-batch"
                  type="text"
                  value={vacBatch}
                  onChange={(e) => setVacBatch(e.target.value)}
                  className="data w-full py-1 text-[11px]"
                />
              </div>
              <div>
                <label htmlFor="record-vac-clinic" className="label mb-0.5 block">
                  Clinic
                </label>
                <input
                  id="record-vac-clinic"
                  type="text"
                  value={vacClinic}
                  onChange={(e) => setVacClinic(e.target.value)}
                  className="w-full py-1 text-[11px]"
                />
              </div>
              <div>
                <label htmlFor="record-vac-vet" className="label mb-0.5 block">
                  Veterinarian
                </label>
                <input
                  id="record-vac-vet"
                  type="text"
                  value={vacVet}
                  onChange={(e) => setVacVet(e.target.value)}
                  className="w-full py-1 text-[11px]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-hairline-t pt-1.5">
              <button type="button" onClick={closeBar} className="btn min-h-7 px-2 text-[11px]">
                Cancel
              </button>
              <button type="submit" disabled={isDoseSaving} className="btn btn-accent min-h-7 px-2 text-[11px]">
                Save to passport
              </button>
            </div>
          </form>
        )}

        {/* THE PIPELINE. A reference in one bar, with the honesty in it. */}
        {activeBar === 'pipeline' && (
          <div className="bar bar--stack no-print" aria-label="Photogrammetry pipeline reference">
            <div className="flex items-stretch gap-1">
              {STAGES.map((stage) => {
                const expanded = expandedStage === stage.code;
                return (
                  <button
                    key={stage.code}
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedStage(expanded ? null : stage.code)}
                    title={`${stage.name} — ${stage.tool}`}
                    className={`min-w-0 flex-1 border-hairline px-1.5 py-1 text-left hover:bg-zinc-900 ${
                      expanded ? 'bg-zinc-900' : ''
                    }`}
                  >
                    <span className="data block text-[9px] text-accent">{stage.code}</span>
                    <span className="block truncate text-[10px] text-zinc-200">{stage.name}</span>
                    <span className="data block truncate text-[9px] text-zinc-500">{stage.tool}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={closeBar}
                aria-label="Close the pipeline reference"
                className="btn-quiet min-h-8 shrink-0 px-1"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>

            <p className="truncate text-[10px] text-zinc-400" title={PIPELINE_HONESTY}>
              {PIPELINE_HONESTY}
            </p>

            {expandedStage && (
              <div className="border-hairline-t pt-1.5">
                {STAGES.filter((stage) => stage.code === expandedStage).map((stage) => (
                  <div key={stage.code} className="min-w-0">
                    <p className="truncate text-[10px] text-zinc-300" title={stage.does}>
                      {stage.does}
                    </p>
                    <p className="data truncate text-[9px] text-accent">
                      {stage.command} → {stage.output}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* THE TOOLS. Three open-source projects, linked but not connected. */}
        {activeBar === 'tools' && (
          <div className="bar bar--stack no-print" aria-label="Open-source reconstruction tools">
            <div className="flex items-stretch gap-2">
              {TOOLS.map((tool) => (
                <div key={tool.name} className="min-w-0 flex-1 border-hairline-r pr-2 last:border-hairline-r-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[11px] font-semibold text-zinc-100">
                      {tool.name}
                    </span>
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${tool.name} on GitHub`}
                      className="shrink-0 text-zinc-400 hover:text-accent"
                    >
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                  <a
                    href={tool.href}
                    target="_blank"
                    rel="noreferrer"
                    className="data block truncate text-[9px] text-accent"
                    title={tool.href}
                  >
                    {tool.org}
                  </a>
                  <p className="line-clamp-2 mt-0.5 text-[10px] leading-[14px] text-zinc-300">
                    {tool.does}
                  </p>
                  <p className="data truncate text-[9px] text-zinc-500" title={tool.output}>
                    {tool.output}
                  </p>
                </div>
              ))}
              <button
                type="button"
                onClick={closeBar}
                aria-label="Close the tool list"
                className="btn-quiet min-h-8 shrink-0 px-1"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            <p className="truncate text-[10px] text-zinc-400" title={TOOLS_HONESTY}>
              {TOOLS_HONESTY}
            </p>
          </div>
        )}

        {/* THE MODEL. A file picker and a URL, for attaching a real mesh. */}
        {activeBar === 'model' && (
          <div className="bar bar--stack no-print" aria-label="Attach a 3D model">
            <div className="flex items-end gap-2">
              <div className="shrink-0">
                <span className="label mb-0.5 block">Model file</span>
                <label className="btn min-h-7 cursor-pointer px-2 text-[11px]">
                  <Upload size={12} aria-hidden="true" /> Choose .glb / .gltf
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleModelInput}
                    className="sr-only"
                  />
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="record-model-url" className="label mb-0.5 block">
                  Model URL
                </label>
                <input
                  id="record-model-url"
                  type="url"
                  value={modelUrl}
                  onChange={(e) => setModelUrl(e.target.value)}
                  placeholder="https://example.com/dog-model.glb"
                  className="data w-full py-1 text-[11px]"
                />
              </div>
              <button
                type="button"
                onClick={handleModelUrl}
                className="btn btn-accent min-h-7 shrink-0 px-2 text-[11px]"
              >
                Attach
              </button>
            </div>
            <div className="flex items-center gap-2 border-hairline-t pt-1.5">
              <p
                className={`min-w-0 flex-1 truncate text-[10px] ${
                  dog.avatarConfig.customModelUrl ? 'text-zinc-300' : 'text-zinc-500'
                }`}
                title={dog.avatarConfig.customModelUrl || undefined}
              >
                {dog.avatarConfig.customModelUrl
                  ? `Attached: ${dog.avatarConfig.customModelUrl}. The avatar stays procedural.`
                  : 'No model attached. The avatar in the command deck is drawn procedurally.'}
              </p>
              {dog.avatarConfig.customModelUrl && (
                <button
                  type="button"
                  onClick={handleClearModel}
                  className="btn min-h-7 shrink-0 px-2 text-[11px]"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={closeBar}
                className="btn min-h-7 shrink-0 px-2 text-[11px]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* THE NOTE. What just happened, said once. */}
        {note && !activeBar && (
          <div
            role="status"
            className={`bar bar--note no-print ${note.tone === 'error' ? 'border-accent' : ''}`}
          >
            {note.tone === 'error' && (
              <CircleAlert size={13} className="shrink-0 text-accent" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">{note.text}</p>
            <button
              type="button"
              onClick={() => setNote(null)}
              aria-label="Dismiss the note"
              className="btn-quiet min-h-8 shrink-0 px-1"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
