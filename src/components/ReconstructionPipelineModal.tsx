import React, { useEffect, useRef, useState } from 'react';
import { DogProfile } from '../types/dog';
import {
  Box,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';

interface ReconstructionPipelineModalProps {
  dog: DogProfile;
  isOpen: boolean;
  onClose: () => void;
  onAddPhoto: (url: string, angle: 'front' | 'side' | 'closeup' | 'body') => void;
  onLoadCustomModel?: (modelUrl: string) => void;
}

type CaptureAngle = 'front' | 'side' | 'closeup' | 'body';
type TabId = 'photos' | 'pipeline' | 'tools' | 'import';

const TAB_ORDER: TabId[] = ['photos', 'pipeline', 'tools', 'import'];

const ANGLES: CaptureAngle[] = ['front', 'side', 'closeup', 'body'];

const ANGLE_LABELS: Record<CaptureAngle, string> = {
  front: 'Frontal',
  side: 'Side profile',
  closeup: 'Close-up',
  body: 'Full body',
};

/* The pipeline stages are a REFERENCE, not a job this app performs: they are
   what an operator runs on a machine with a GPU. Keeping them as data (tool,
   command, artefact) makes the difference between "documented" and "done"
   impossible to miss. */
const STAGES = [
  {
    code: '01',
    name: 'Mask & keypoint extraction',
    tool: 'COLMAP, Segment Anything',
    does: 'Cuts the dog out of each background and finds feature points that survive the cut. Every other stage is downstream of this one.',
    command: 'colmap feature_extractor',
    output: 'features.db',
  },
  {
    code: '02',
    name: 'Camera poses & bundle adjustment',
    tool: 'COLMAP SfM',
    does: 'Solves where the camera stood for each frame, then refines the sparse point cloud so the frames agree with each other.',
    command: 'colmap mapper',
    output: 'sparse/ — cameras.bin, points3D.bin',
  },
  {
    code: '03',
    name: 'Dense surface & texture bake',
    tool: 'OpenMVS, Nerfstudio',
    does: 'Thickens the sparse cloud into a surface, meshes it, and bakes the photograph colours onto the mesh.',
    command: 'openMVS DensifyPointCloud',
    output: 'scene.mvs → mesh.ply',
  },
  {
    code: '04',
    name: 'Rigging & skinning',
    tool: 'Blender, Mixamo',
    does: 'Builds the bone hierarchy and skins the mesh to it, which is what makes the result animatable rather than a frozen lump.',
    command: 'blender --background rig.py',
    output: 'dog-rig.glb',
  },
];

const TOOLS = [
  {
    name: 'TripoSR',
    org: 'VAST-AI-Research/TripoSR',
    href: 'https://github.com/VAST-AI-Research/TripoSR',
    does: 'Feed-forward generative model that returns a textured mesh from a single image in well under a second on a consumer GPU.',
    output: '.obj / .glb with baked vertex colours',
  },
  {
    name: 'InstantMesh',
    org: 'TencentARC/InstantMesh',
    href: 'https://github.com/TencentARC/InstantMesh',
    does: 'Sparse-view Large Reconstruction Model. Takes a handful of views and produces a clean, watertight mesh.',
    output: 'manifold mesh + high-resolution texture maps',
  },
  {
    name: 'Nerfstudio',
    org: 'nerfstudio-project/nerfstudio',
    href: 'https://github.com/nerfstudio-project/nerfstudio',
    does: 'Full 3D Gaussian Splatting and NeRF pipeline for multi-photo capture, with a viewer and tooling for training and export.',
    output: 'splat .ply · rendered views · trained checkpoints',
  },
];

const isModelFile = (name: string) => /\.(glb|gltf)$/i.test(name);

export const ReconstructionPipelineModal: React.FC<ReconstructionPipelineModalProps> = ({
  dog,
  isOpen,
  onClose,
  onAddPhoto,
  onLoadCustomModel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpenRef = useRef(isOpen);
  const dragDepth = useRef(0);

  const [activeTab, setActiveTab] = useState<TabId>('photos');
  const [captureAngle, setCaptureAngle] = useState<CaptureAngle>('front');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [modelImportUrl, setModelImportUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [importStatus, setImportStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const photos = dog.photos;

  /* Native <dialog> gives the top layer, the focus trap, Escape and focus
     restoration for free. This effect only keeps the element in sync with the
     parent's isOpen flag — it never invents open state. */
  useEffect(() => {
    isOpenRef.current = isOpen;
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    else if (!isOpen && el.open) el.close();
  }, [isOpen]);

  const handleNativeClose = () => {
    if (isOpenRef.current) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = TAB_ORDER.indexOf(activeTab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % TAB_ORDER.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TAB_ORDER.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActiveTab(TAB_ORDER[next]);
    document.getElementById(`recon-tab-${TAB_ORDER[next]}`)?.focus();
  };

  const readPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      onAddPhoto(reader.result, captureAngle);
      setPhotoStatus({
        tone: 'ok',
        text: `Photo stored on ${dog.name}'s record at ${ANGLE_LABELS[captureAngle].toLowerCase()}.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) readPhoto(file);
  };

  const importModelFile = (file: File) => {
    if (!onLoadCustomModel) {
      setImportStatus({ tone: 'error', text: 'This build has no model-import hook, so the file was not attached.' });
      return;
    }
    if (!isModelFile(file.name)) {
      setImportStatus({
        tone: 'error',
        text: `${file.name} is not a .glb or .gltf file, so it was not imported.`,
      });
      return;
    }
    onLoadCustomModel(URL.createObjectURL(file));
    setImportStatus({
      tone: 'ok',
      text: `${file.name} read in this browser. Its reference is stored on ${dog.name}'s record.`,
    });
  };

  const handleModelInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importModelFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importModelFile(file);
  };

  const loadFromUrl = () => {
    const url = modelImportUrl.trim();
    if (!url) {
      setImportStatus({ tone: 'error', text: 'Enter a model URL first.' });
      return;
    }
    if (!onLoadCustomModel) {
      setImportStatus({ tone: 'error', text: 'This build has no model-import hook, so nothing was loaded.' });
      return;
    }
    onLoadCustomModel(url);
    setImportStatus({ tone: 'ok', text: `URL stored on ${dog.name}'s record.` });
  };

  const captureDates = photos.map((p) => p.dateTaken).filter(Boolean).sort();
  /* Column count follows the item count, so the last row is never one stranded
     card sitting beside empty cells. */
  const photoCols =
    photos.length === 1
      ? 'grid-cols-1 sm:grid-cols-1'
      : photos.length === 2
        ? 'grid-cols-2 sm:grid-cols-2'
        : photos.length === 4
          ? 'grid-cols-2 sm:grid-cols-2'
          : photos.length <= 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-3';
  const angleCounts = ANGLES.map((angle) => ({
    angle,
    count: photos.filter((p) => p.angle === angle).length,
  }));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="recon-modal-title"
      onClose={handleNativeClose}
      onClick={handleBackdropClick}
      /* A dropped file outside the zone must not make the browser navigate to it. */
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className="no-print m-auto w-[calc(100vw_-_1.5rem)] max-w-2xl max-h-[90vh] border-0 bg-transparent p-0 text-zinc-100 backdrop:bg-black/90"
    >
      <div className="bg-zinc-950 border-hairline flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-hairline-b bg-zinc-900 px-4 py-3 flex items-start justify-between gap-4">
          <div>
            <span className="label block">Canine 3D engine</span>
            <h2 id="recon-modal-title" className="font-display text-lg text-zinc-100">
              Photo capture &amp; 3D avatar reconstruction
            </h2>
            <p className="text-xs text-zinc-400">
              {dog.name} — {dog.breed}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-quiet shrink-0 px-2"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Tab navigation */}
        <div role="tablist" aria-label="Reconstruction sections" className="flex border-hairline-b bg-black overflow-x-auto">
          {(
            [
              { id: 'photos', label: 'Photo intake' },
              { id: 'pipeline', label: 'Pipeline reference' },
              { id: 'tools', label: 'Open-source tools' },
              { id: 'import', label: 'Model import' },
            ] as { id: TabId; label: string }[]
          ).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`recon-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`recon-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={handleTabKeyDown}
                className={`py-2 px-3 border-hairline-r text-xs font-body whitespace-nowrap ${
                  selected ? 'bg-zinc-900 text-accent font-semibold' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {tab.label}
                {tab.id === 'photos' && <span className="data ml-1.5 text-[11px] text-faint">{photos.length}</span>}
              </button>
            );
          })}
        </div>

        {/* Tab panel */}
        <div
          role="tabpanel"
          id={`recon-panel-${activeTab}`}
          aria-labelledby={`recon-tab-${activeTab}`}
          tabIndex={-1}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
        >
          {/* PHOTOS */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-base text-zinc-100">
                    {dog.name}&rsquo;s captured photos
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Photographs held on this record, with the angle and capture date you gave them.
                    Adding a photo is real work; reconstructing a mesh from it is not something this
                    app does.
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label htmlFor="recon-capture-angle" className="label block mb-1">
                      Angle
                    </label>
                    <select
                      id="recon-capture-angle"
                      value={captureAngle}
                      onChange={(e) => setCaptureAngle(e.target.value as CaptureAngle)}
                      className="data text-xs py-1.5"
                    >
                      {ANGLES.map((angle) => (
                        <option key={angle} value={angle}>
                          {ANGLE_LABELS[angle]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="btn btn-accent cursor-pointer focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2">
                    <Upload size={13} aria-hidden="true" /> Add photo
                    <input type="file" accept="image/*" onChange={handlePhotoInput} className="sr-only" />
                  </label>
                </div>
              </div>

              {photoStatus && (
                <p
                  role="status"
                  className={`text-xs ${photoStatus.tone === 'error' ? 'text-amber-400' : 'text-zinc-300'}`}
                >
                  {photoStatus.text}
                </p>
              )}

              {photos.length === 0 ? (
                <div className="border-hairline bg-black p-4 flex items-start gap-3">
                  <ImageIcon size={18} className="text-zinc-500 mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-zinc-200">No photos on {dog.name}&rsquo;s record yet.</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Add one with the control above. The image is read in this browser, stored on the
                      record with the angle and date you choose, and never uploaded anywhere.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`grid ${photoCols} gap-3`}>
                  {photos.map((photo, i) => (
                    <div
                      key={photo.id || i}
                      className={`border-hairline bg-black p-2 flex flex-col ${
                        photos.length === 1 ? 'sm:max-w-[320px]' : ''
                      }`}
                    >
                      <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden mb-2">
                        <img
                          src={photo.url}
                          alt={`${dog.name}, ${photo.angle} angle`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 bg-black data text-[9px] text-accent px-1.5 py-0.5 border-hairline">
                          {photo.angle.toUpperCase()}
                        </span>
                      </div>
                      {photo.notes && <span className="text-[11px] text-zinc-300 block truncate">{photo.notes}</span>}
                      <span className="data text-[9px] text-zinc-500">{photo.dateTaken}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-hairline bg-zinc-900 p-3">
                <span className="label">Captured angles on record</span>
                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-2">
                  {angleCounts.map(({ angle, count }) => (
                    <div key={angle}>
                      <span className="label block">{ANGLE_LABELS[angle]}</span>
                      <span className="data block text-sm text-zinc-200">{count}</span>
                    </div>
                  ))}
                  {captureDates.length > 0 && (
                    <>
                      <div>
                        <span className="label block">First capture</span>
                        <span className="data block text-sm text-zinc-200">{captureDates[0]}</span>
                      </div>
                      <div>
                        <span className="label block">Last capture</span>
                        <span className="data block text-sm text-zinc-200">{captureDates[captureDates.length - 1]}</span>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-3">
                  This is a record of what was captured and when. Nothing here measures photo
                  quality, keypoint density, or whether these frames would reconstruct — no such
                  check has been run.
                </p>
              </div>
            </div>
          )}

          {/* PIPELINE REFERENCE */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-base text-zinc-100">The photogrammetry pipeline</h3>
                <p className="text-xs text-zinc-400">
                  This tab is a reference, not a job. Canine OS runs no reconstruction: there is no
                  mesh generator, no optimiser and no exporter behind it. What follows is the
                  open-source workflow an operator runs on a machine, stage by stage.
                </p>
              </div>

              <ol className="border-hairline-t">
                {STAGES.map((stage) => {
                  const expanded = expandedStage === stage.code;
                  return (
                    <li key={stage.code} className="border-hairline-b">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`recon-stage-${stage.code}`}
                        onClick={() => setExpandedStage(expanded ? null : stage.code)}
                        className="w-full flex items-start gap-3 p-3 text-left hover:bg-zinc-900"
                      >
                        <span className="data text-[11px] text-accent w-6 shrink-0 pt-0.5">{stage.code}</span>
                        <span className="flex-1 min-w-0">
                          <span className="font-display text-sm text-zinc-100 block">{stage.name}</span>
                          <span className="data text-[11px] text-zinc-400 block mt-0.5">{stage.tool}</span>
                        </span>
                        {expanded ? (
                          <ChevronDown size={14} className="text-zinc-400 mt-1 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight size={14} className="text-zinc-400 mt-1 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                      {expanded && (
                        <div id={`recon-stage-${stage.code}`} className="px-3 pb-3 pl-12 space-y-2">
                          <p className="text-xs text-zinc-300">{stage.does}</p>
                          <div>
                            <span className="label block mb-1">Command</span>
                            <code className="data text-[11px] text-accent block bg-black border-hairline px-2 py-1">
                              {stage.command}
                            </code>
                          </div>
                          <div>
                            <span className="label block mb-1">Produces</span>
                            <span className="data text-[11px] text-zinc-300">{stage.output}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="border-hairline bg-black p-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">
                  Run those stages yourself, then bring the exported file into the importer.
                </p>
                <button type="button" className="btn" onClick={() => setActiveTab('import')}>
                  Open model import
                </button>
              </div>
            </div>
          )}

          {/* OPEN-SOURCE TOOLS */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-display text-base text-zinc-100">Open-source reconstruction tools</h3>
                <p className="text-xs text-zinc-400">
                  Projects you can run yourself against your own photographs. They are linked, not
                  connected — this app neither installs nor calls them.
                </p>
              </div>

              <ul className="border-hairline-t">
                {TOOLS.map((tool) => (
                  <li key={tool.name} className="border-hairline-b p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-display text-sm text-zinc-100">{tool.name}</h4>
                      <a
                        href={tool.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${tool.name} on GitHub`}
                        className="data text-[11px] text-accent hover:text-zinc-100 flex items-center gap-1"
                      >
                        {tool.org}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">{tool.does}</p>
                    <p className="text-[11px] mt-1">
                      <span className="label">Output</span>{' '}
                      <span className="data text-zinc-400">{tool.output}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MODEL IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-base text-zinc-100">Import a model file</h3>
                <p className="text-xs text-zinc-400">
                  Point the app at a real <span className="data">.glb</span> or{' '}
                  <span className="data">.gltf</span> and its reference is written to {dog.name}&rsquo;s
                  record. The file is read in this browser — nothing is uploaded to a server.
                </p>
              </div>

              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
                  /* Swap the whole border rule rather than layering a colour on
                     top of the hairline shorthand — the shorthand wins the
                     cascade and the accent would never show. */
                  isDragging ? 'border border-accent bg-zinc-900' : 'border-hairline bg-black'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Box size={16} className="text-accent shrink-0" aria-hidden="true" />
                  <p className="text-xs text-zinc-300">
                    {isDragging ? (
                      <span className="text-accent">Release to import the model file.</span>
                    ) : (
                      <span>
                        Drop a <span className="data">.glb</span> or <span className="data">.gltf</span>{' '}
                        file here.
                      </span>
                    )}
                  </p>
                </div>
                <label className="btn btn-accent cursor-pointer focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2">
                  <Upload size={13} aria-hidden="true" /> Browse files
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleModelInput}
                    className="sr-only"
                  />
                </label>
              </div>

              <p className="text-[11px] text-zinc-500">
                Only self-contained <span className="data">.glb</span> resolves from a local file. A{' '}
                <span className="data">.gltf</span> that references an external{' '}
                <span className="data">.bin</span> or texture folder will not load from a browser file
                handle — host it and use the URL field instead.
              </p>

              <div className="space-y-2">
                <label htmlFor="recon-model-url" className="label block">
                  Model URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="recon-model-url"
                    type="url"
                    value={modelImportUrl}
                    onChange={(e) => setModelImportUrl(e.target.value)}
                    placeholder="https://example.com/dog-model.glb"
                    className="flex-1 text-xs data"
                  />
                  <button type="button" onClick={loadFromUrl} className="btn btn-accent">
                    Load model
                  </button>
                </div>
              </div>

              {importStatus && (
                <p
                  role="status"
                  className={`text-xs flex items-start gap-2 ${
                    importStatus.tone === 'error' ? 'text-amber-400' : 'text-zinc-300'
                  }`}
                >
                  {importStatus.tone === 'error' ? (
                    <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  ) : null}
                  <span>{importStatus.text}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-hairline-t bg-black px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="label">Photos</span>
              <span className="data text-xs text-zinc-300">{photos.length}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="label">Model</span>
              <span className="data text-xs text-zinc-300">
                {dog.avatarConfig.customModelUrl ? 'custom reference' : 'procedural'}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn">
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
};
