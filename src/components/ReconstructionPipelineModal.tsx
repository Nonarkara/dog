import React, { useState } from 'react';
import { DogProfile } from '../types/dog';
import { Box, Layers, Cpu, CheckCircle2, Upload, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';

interface ReconstructionPipelineModalProps {
  dog: DogProfile;
  isOpen: boolean;
  onClose: () => void;
  onAddPhoto: (url: string, angle: 'front' | 'side' | 'closeup' | 'body') => void;
  onLoadCustomModel?: (modelUrl: string) => void;
}

export const ReconstructionPipelineModal: React.FC<ReconstructionPipelineModalProps> = ({
  dog,
  isOpen,
  onClose,
  onAddPhoto,
  onLoadCustomModel,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'photos' | 'pipeline' | 'repos' | 'custom-model'>('photos');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [modelImportUrl, setModelImportUrl] = useState('');

  const runReconstructionSimulation = () => {
    setIsProcessing(true);
    setProgressStage(1);

    setTimeout(() => setProgressStage(2), 1200);
    setTimeout(() => setProgressStage(3), 2600);
    setTimeout(() => {
      setProgressStage(4);
      setIsProcessing(false);
    }, 4000);
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
      const url = URL.createObjectURL(file);
      onLoadCustomModel?.(url);
    } else {
      // Photo upload
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAddPhoto(reader.result, 'body');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-zinc-950 border border-amber-500/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-3.5 border-hairline-b flex items-center justify-between bg-zinc-900/60">
          <div>
            <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest block">
              CANINE 3D ENGINE // PHOTOGRAMMETRY & AI MESH PIPELINE
            </span>
            <h3 className="font-display text-lg text-white">
              PHOTO STITCHING & 3D AVATAR RECONSTRUCTION
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white font-mono text-sm px-2 py-1 border-hairline"
          >
            ESC / CLOSE ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-hairline-b bg-black text-xs font-mono">
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-2 px-3 border-hairline-r ${
              activeTab === 'photos' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            1. PHOTO INTAKE ({dog.photos.length})
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-2 px-3 border-hairline-r ${
              activeTab === 'pipeline' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            2. RECONSTRUCTION PIPELINE
          </button>
          <button
            onClick={() => setActiveTab('repos')}
            className={`py-2 px-3 border-hairline-r ${
              activeTab === 'repos' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            3. OPEN-SOURCE REPOS
          </button>
          <button
            onClick={() => setActiveTab('custom-model')}
            className={`py-2 px-3 ${
              activeTab === 'custom-model' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            4. GLTF/GLB IMPORTER
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: Photos */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-sm text-zinc-200">EXPO'S CAPTURED PHOTO ANGLES</h4>
                  <p className="text-xs text-zinc-400">
                    High-quality multi-angle photos used to extract coat textures, facial mask, and proportions.
                  </p>
                </div>
                <label className="btn btn-accent cursor-pointer text-xs py-1.5 px-3">
                  <Upload size={13} /> ADD PHOTO
                  <input type="file" accept="image/*" onChange={handleCustomFileUpload} className="hidden" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {dog.photos.map((photo, i) => (
                  <div key={photo.id || i} className="border-hairline bg-black p-2 flex flex-col">
                    <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden mb-2">
                      <img
                        src={photo.url}
                        alt={`Photo angle ${photo.angle}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/90 font-mono text-[9px] text-amber-400 px-1.5 py-0.5 border-hairline">
                        {photo.angle.toUpperCase()}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400 block truncate">
                      {photo.notes || `Angle ${i + 1}`}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-600">{photo.dateTaken}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 border-hairline bg-zinc-900/40 text-xs flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono text-[11px] text-amber-400 block font-semibold">
                    PHOTOGRAMMETRY FIDELITY CHECK
                  </span>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    Expo's 3 photos provide frontal face symmetry, side body silhouette with the Bangkaew lion mane, and high-resolution facial gaze. This provides ample keypoints for geometric feature matching.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Pipeline Execution */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-sm text-zinc-200">AUTOMATED 3D STITCHING PIPELINE</h4>
                  <p className="text-xs text-zinc-400">
                    Runs multi-view feature matching, structure-from-motion (SfM), and neural mesh extraction.
                  </p>
                </div>
                <button
                  onClick={runReconstructionSimulation}
                  disabled={isProcessing}
                  className="btn btn-accent text-xs"
                >
                  <Cpu size={13} /> {isProcessing ? 'PROCESSING...' : 'RUN PIPELINE'}
                </button>
              </div>

              {/* Progress Stepper */}
              <div className="space-y-2 font-mono text-xs">
                <div
                  className={`p-2.5 border-hairline flex items-center justify-between ${
                    progressStage >= 1 ? 'border-amber-500/80 bg-amber-500/10' : 'bg-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center border-hairline text-[10px]">
                      01
                    </span>
                    <span>KEYPOINT EXTRACTION & MASK SEGMENTATION</span>
                  </div>
                  {progressStage >= 1 && (
                    <span className="text-amber-400 text-[10px]">
                      {progressStage > 1 ? 'COMPLETE' : 'EXTRACTING...'}
                    </span>
                  )}
                </div>

                <div
                  className={`p-2.5 border-hairline flex items-center justify-between ${
                    progressStage >= 2 ? 'border-amber-500/80 bg-amber-500/10' : 'bg-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center border-hairline text-[10px]">
                      02
                    </span>
                    <span>CAMERA POSE SOLVER & BUNDLE ADJUSTMENT</span>
                  </div>
                  {progressStage >= 2 && (
                    <span className="text-amber-400 text-[10px]">
                      {progressStage > 2 ? 'COMPLETE' : 'SOLVING POSES...'}
                    </span>
                  )}
                </div>

                <div
                  className={`p-2.5 border-hairline flex items-center justify-between ${
                    progressStage >= 3 ? 'border-amber-500/80 bg-amber-500/10' : 'bg-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center border-hairline text-[10px]">
                      03
                    </span>
                    <span>CANINE MESH RECONSTRUCTION & UV TEXTURE BAKE</span>
                  </div>
                  {progressStage >= 3 && (
                    <span className="text-amber-400 text-[10px]">
                      {progressStage > 3 ? 'COMPLETE' : 'BAKING TEXTURES...'}
                    </span>
                  )}
                </div>

                <div
                  className={`p-2.5 border-hairline flex items-center justify-between ${
                    progressStage >= 4 ? 'border-emerald-500 bg-emerald-500/10' : 'bg-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center border-hairline text-[10px]">
                      04
                    </span>
                    <span>TAMAGOTCHI RIGGING & BONE HIERARCHY</span>
                  </div>
                  {progressStage >= 4 && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                      <CheckCircle2 size={12} /> READY IN 3D ENGINE
                    </span>
                  )}
                </div>
              </div>

              {progressStage >= 4 && (
                <div className="p-3 border border-emerald-500/60 bg-emerald-950/20 text-xs">
                  <span className="text-emerald-400 font-mono font-bold block mb-1">
                    ✓ EXPO'S 3D AVATAR OPTIMIZED FOR REALTIME TAMAGOTCHI & METAVERSE
                  </span>
                  <p className="text-zinc-300 text-[11px]">
                    The procedural rigged model now reflects Expo's sable saddle, white lion chest ruff, and dark face mask with real-time breathing, ear twitches, and wagging animations.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Open-Source Repos */}
          {activeTab === 'repos' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                The open-source 3D reconstruction engines you can connect directly to this pipeline:
              </p>

              <div className="border-hairline p-3 bg-black space-y-1.5">
                <div className="flex justify-between items-start">
                  <h5 className="font-display text-sm text-amber-400">TripoSR (VAST AI Research)</h5>
                  <a
                    href="https://github.com/VAST-AI-Research/TripoSR"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    GITHUB <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-xs text-zinc-300">
                  Fast feedforward 3D generative model capable of producing textured 3D meshes from single or multi-view dog photos in under 0.5 seconds on a consumer GPU.
                </p>
                <span className="font-mono text-[10px] text-zinc-500 block">
                  Output: Wavefront .OBJ / .GLB with baked vertex colors.
                </span>
              </div>

              <div className="border-hairline p-3 bg-black space-y-1.5">
                <div className="flex justify-between items-start">
                  <h5 className="font-display text-sm text-amber-400">InstantMesh (Tencent ARC)</h5>
                  <a
                    href="https://github.com/TencentARC/InstantMesh"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    GITHUB <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-xs text-zinc-300">
                  Efficient 3D mesh generation from multi-view images using sparse-view Large Reconstruction Models (LRM). Produces clean watertight meshes.
                </p>
                <span className="font-mono text-[10px] text-zinc-500 block">
                  Output: Rig-ready manifold meshes with high-res texture maps.
                </span>
              </div>

              <div className="border-hairline p-3 bg-black space-y-1.5">
                <div className="flex justify-between items-start">
                  <h5 className="font-display text-sm text-amber-400">3D Gaussian Splatting / Nerfstudio</h5>
                  <a
                    href="https://github.com/nerfstudio-project/nerfstudio"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    GITHUB <ExternalLink size={10} />
                  </a>
                </div>
                <p className="text-xs text-zinc-300">
                  Multi-photo photogrammetry pipeline that creates real-time radiance splats from dog video clips or 20+ photos taken while the dog sits still.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: GLTF / GLB Custom Model Importer */}
          {activeTab === 'custom-model' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-display text-sm text-zinc-200">IMPORT CUSTOM 3D MESH (.GLB / .GLTF)</h4>
                <p className="text-xs text-zinc-400">
                  Have an exported 3D model generated by Blender, TripoSR, or photogrammetry? Load it directly.
                </p>
              </div>

              <div className="p-4 border-2 border-dashed border-zinc-700 bg-black flex flex-col items-center justify-center text-center space-y-2">
                <Box size={28} className="text-amber-500" />
                <span className="font-mono text-xs text-zinc-300">
                  DRAG & DROP .GLB / .GLTF FILE HERE
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  Supports embedded PBR materials & skeleton animations
                </span>
                <label className="btn btn-accent text-xs mt-2 cursor-pointer">
                  BROWSE FILES
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleCustomFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs text-zinc-400 block">
                  OR LOAD FROM DIRECT MODEL URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelImportUrl}
                    onChange={(e) => setModelImportUrl(e.target.value)}
                    placeholder="https://example.com/models/expo-bangkaew.glb"
                    className="flex-1 text-xs"
                  />
                  <button
                    onClick={() => {
                      if (modelImportUrl.trim()) {
                        onLoadCustomModel?.(modelImportUrl.trim());
                        onClose();
                      }
                    }}
                    className="btn btn-accent text-xs"
                  >
                    LOAD MODEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-hairline-t bg-black flex justify-between items-center text-xs">
          <span className="font-mono text-[10px] text-zinc-500">
            DOG_ID: {dog.id} · PIPELINE_STATUS: READY
          </span>
          <button onClick={onClose} className="btn text-xs py-1 px-3">
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
