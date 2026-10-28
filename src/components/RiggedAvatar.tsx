import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';

/**
 * A REAL DOG.
 *
 * This is the honest path: a scanned or generated MESH of the actual animal,
 * loaded from a `.glb` and animated by its own skeleton. It is what the
 * photogrammetry pipeline in the Record region is FOR, and it is why the
 * avatar is not always the procedural one.
 *
 * The procedural dog is still here, and it is still the fallback: a record
 * with no model attached gets the drawn animal, which is better than a hole.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not pretend. If the file is missing, unreadable, or not a model,
 * the reader is told so in words, and the drawn animal takes over. A stage
 * that silently shows nothing is the failure this app is trying hardest to
 * avoid.
 */

interface RiggedAvatarProps {
  dog: DogProfile;
  petState: PetState;
  url: string;
  interactionTrigger: 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'communicate' | null;
  onInteractionEnd?: () => void;
}

/**
 * FINDING A CLIP.
 *
 * A rig's clips are named by whatever built it, so a rig that says "Walk" and
 * a rig that says "walk_forward" are the same intention. So the clip is found
 * by INTENT — walking, sleeping, eating — and the names are tried in order
 * of how likely a pipeline is to have used them.
 */
const CLIP_INTENTS: Record<string, string[][]> = {
  idle: [['idle'], ['stand'], ['rest'], ['breathing'], ['look']],
  walk: [['walk'], ['run'], ['trot'], ['move']],
  sleep: [['sleep'], ['lie', 'down'], ['curl'], ['rest', 'idle'], ['doze']],
  eat: [['eat'], ['feed'], ['bite'], ['drink']],
  play: [['play'], ['jump'], ['fetch'], ['ball']],
  pet: [['pet'], ['affection'], ['happy']],
  groom: [['groom'], ['shake'], ['brush']],
};

function findClip(clips: THREE.AnimationClip[], intent: string): THREE.AnimationClip | null {
  const names = CLIP_INTENTS[intent] ?? [[intent]];
  for (const group of names) {
    for (const clip of clips) {
      const lowered = clip.name.toLowerCase();
      if (group.every((part) => lowered.includes(part))) return clip;
    }
  }
  return null;
}

export const RiggedAvatar: React.FC<RiggedAvatarProps> = ({
  dog,
  petState,
  url,
  interactionTrigger,
  onInteractionEnd,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The mixer and the clips live in refs, not in state: they change every
  // frame, and React has no business re-rendering for a tail wag.
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const rootRef = useRef<THREE.Group | null>(null);
  const currentRef = useRef<string>('');

  // The reason for a re-render: the dog's mood changes, and the rig has to
  // be told which clip to hold.
  const asleep = petState.sleep?.asleep ?? false;

  useEffect(() => {
    if (!url || !mountRef.current) return;
    let disposed = false;
    const container = mountRef.current;
    container.innerHTML = '';

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const scene = cloneSkeleton(gltf.scene);

        // SKINNED MESHES VANISH if the bounding sphere is stale. Every rig
        // that has ever been animated has this bug.
        scene.traverse((o: THREE.Object3D) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            (o as THREE.SkinnedMesh).frustumCulled = false;
          }
        });

        // STAND IT ON THE GROUND, at a size a person can read: a dog is
        // about half a metre at the shoulder, and the scene's units are
        // whatever the scanner chose.
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const TARGET_HEIGHT = 0.62; // metres at the shoulder
        if (size.y > 0.0001) scene.scale.setScalar(TARGET_HEIGHT / size.y);
        const scaled = new THREE.Box3().setFromObject(scene);
        scene.position.y -= scaled.min.y;
        // And face it the way the reader expects: +Z is forward.
        scene.rotation.y = Math.PI * 0.18;

        const pivot = new THREE.Group();
        pivot.add(scene);
        container.appendChild(container.ownerDocument.createElement('div'));
        const canvas = container.ownerDocument.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);

        const scene3d = new THREE.Scene();
        scene3d.background = new THREE.Color(0x0c0c0e);
        scene3d.add(pivot);

        const ambient = new THREE.AmbientLight(0xd8dbe4, 0.5);
        scene3d.add(ambient);
        const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
        key.position.set(4, 6, 5);
        key.castShadow = true;
        scene3d.add(key);
        const rim = new THREE.DirectionalLight(0x9fb4d6, 1.2);
        rim.position.set(-4, 3, -4);
        scene3d.add(rim);

        const camera = new THREE.PerspectiveCamera(
          40,
          (container.clientWidth || 1) / (container.clientHeight || 1),
          0.01,
          100
        );
        camera.position.set(0, 0.42, 1.35);
        camera.lookAt(0, 0.26, 0);

        const mixer = new THREE.AnimationMixer(scene);
        mixerRef.current = mixer;
        clipsRef.current = gltf.animations ?? [];
        rootRef.current = pivot;

        const clock = new THREE.Clock();
        let frame = 0;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          mixer.update(clock.getDelta());
          renderer.render(scene3d, camera);
        };
        animate();

        const onResize = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (!w || !h) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        const observer = new ResizeObserver(onResize);
        observer.observe(container);

        setLoaded(true);

        // The teardown has to be complete: a rig that is not disposed leaks a
        // WebGL context every time the reader switches dogs.
        (container as HTMLDivElement & { __afDispose?: () => void }).__afDispose = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          mixer.stopAllAction();
          mixer.uncacheRoot(scene);
          scene.traverse((o: THREE.Object3D) => {
            const mesh = o as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
          });
          renderer.dispose();
          container.innerHTML = '';
        };
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.error('Could not load the dog model:', err);
        setError(
          `This dog has a model attached, but it could not be read (${url}). The drawn animal is shown instead.`
        );
      }
    );

    return () => {
      disposed = true;
      (container as HTMLDivElement & { __afDispose?: () => void }).__afDispose?.();
      mixerRef.current = null;
      clipsRef.current = [];
      rootRef.current = null;
      setLoaded(false);
    };
  }, [url]);

  /** HOLD A CLIP. The last one asked for wins. */
  const play = (intent: string) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    if (currentRef.current === intent) return;
    const clip = findClip(clipsRef.current, intent);
    if (!clip) return;
    currentRef.current = intent;
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset();
    action.play();
  };

  // The mood decides the clip. Asleep, he sleeps. Otherwise he is up.
  useEffect(() => {
    if (!loaded) return;
    if (asleep) {
      play('sleep');
    } else if (!interactionTrigger) {
      play('idle');
    }
  }, [asleep, loaded, interactionTrigger]);

  // An interaction plays its own clip, and then he goes back to what he was
  // doing.
  useEffect(() => {
    if (!loaded || !interactionTrigger) return;
    const intent =
      interactionTrigger === 'feed'
        ? 'eat'
        : interactionTrigger === 'play'
          ? 'play'
          : interactionTrigger === 'pet'
            ? 'pet'
            : interactionTrigger === 'groom'
              ? 'groom'
              : interactionTrigger === 'walk'
                ? 'walk'
                : 'idle';
    play(intent);
    const t = window.setTimeout(() => {
      play(asleep ? 'sleep' : 'idle');
      onInteractionEnd?.();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [interactionTrigger, loaded, asleep, onInteractionEnd]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className="text-[11px] leading-snug text-amber-400 border-hairline bg-zinc-950/90 p-2">
            {error}
          </p>
        </div>
      )}
      {!error && (
        <p className="absolute bottom-2 left-2 max-w-[70%] text-[11px] leading-tight text-zinc-300 pointer-events-none">
          {dog.name}
          <span className="text-zinc-500"> / </span>
          {dog.breed}
        </p>
      )}
    </div>
  );
};
