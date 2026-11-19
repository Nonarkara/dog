import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import type { AvatarInteractionTrigger } from './DogAvatar3D';

/**
 * A REAL DOG.
 *
 * This is the honest path: a scanned or generated MESH of the actual animal,
 * loaded from a `.glb` and animated by its own skeleton. It is what the
 * photogrammetry pipeline in the Record region is FOR, and it is why the
 * avatar is not always the procedural one.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not pretend. If the file is missing, unreadable, or not a model,
 * the reader is told so in words AND the drawn animal takes over — a stage
 * that silently shows nothing is the failure this app is trying hardest to
 * avoid.
 *
 * WHAT THIS DOES
 * --------------
 * - Frames the camera from the model's ACTUAL bounds and the viewport's
 *   aspect, so a dog is never cropped and never stranded.
 * - Crossfades between clips, so a change of behaviour is a change of
 *   behaviour and not a jump cut.
 * - Says so when the rig has no clip for what the dog is doing, instead of
 *   standing there doing nothing in silence.
 * - Takes a touch: the reader can pet the mesh they can see.
 * - Gives the WebGL context back when the dog changes.
 */

const DogAvatar3D = lazy(() =>
  import('./DogAvatar3D').then((m) => ({ default: m.DogAvatar3D }))
);

interface RiggedAvatarProps {
  dog: DogProfile;
  petState: PetState;
  url: string;
  interactionTrigger: AvatarInteractionTrigger;
  onInteractionEnd?: () => void;
  /** The reader touched the animal. */
  onPet?: () => void;
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

/** How long one behaviour blends into the next. */
const CROSSFADE_SECONDS = 0.28;

export const RiggedAvatar: React.FC<RiggedAvatarProps> = ({
  dog,
  petState,
  url,
  interactionTrigger,
  onInteractionEnd,
  onPet,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** Set when the rig cannot do what the dog is doing. Said out loud. */
  const [missingClip, setMissingClip] = useState<string | null>(null);

  // The mixer and the clips live in refs, not in state: they change every
  // frame, and React has no business re-rendering for a tail wag. It also
  // means a state write elsewhere — a care action, a decay tick — never
  // resets the animation.
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const currentRef = useRef<string>('');
  const sceneRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);

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
        const raw = new THREE.Box3().setFromObject(scene);
        const rawSize = raw.getSize(new THREE.Vector3());
        const TARGET_HEIGHT = 0.62; // metres at the shoulder
        if (rawSize.y > 0.0001) scene.scale.setScalar(TARGET_HEIGHT / rawSize.y);
        const scaled = new THREE.Box3().setFromObject(scene);
        scene.position.y -= scaled.min.y;

        const pivot = new THREE.Group();
        pivot.add(scene);

        const canvas = document.createElement('canvas');
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
        cameraRef.current = camera;

        /**
         * THE FRAMING IS A FUNCTION OF THE MODEL AND THE BOX.
         *
         * A hard-coded camera position crops the dog in one viewport and
         * strands it in another, and it crops differently for every model
         * because every model has different bounds. So the camera is solved
         * from the animal's own size and the viewport's aspect: far enough
         * back that the whole dog fits on BOTH axes, with a little air, and
         * three-quarters on so the reader sees a face and a stance.
         */
        const frame = (w: number, h: number) => {
          if (!w || !h) return;
          const box = new THREE.Box3().setFromObject(pivot);
          const size = box.getSize(new THREE.Vector3());
          const centre = box.getCenter(new THREE.Vector3());

          const vFov = (camera.fov * Math.PI) / 180;
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (w / h));
          // A dog's length and its height both have to fit.
          const distH = (Math.max(size.x, size.z) * 0.56) / Math.tan(hFov / 2);
          const distV = (size.y * 0.62) / Math.tan(vFov / 2);
          const dist = Math.max(distH, distV) * 1.16;

          const target = new THREE.Vector3(centre.x, centre.y + size.y * 0.04, centre.z);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          camera.position.set(
            target.x + dist * 0.34,
            target.y + size.y * 0.26,
            target.z + dist
          );
          camera.lookAt(target);
        };
        frame(container.clientWidth || 1, container.clientHeight || 1);

        const mixer = new THREE.AnimationMixer(scene);
        mixerRef.current = mixer;
        clipsRef.current = gltf.animations ?? [];
        sceneRef.current = pivot;
        raycasterRef.current = new THREE.Raycaster();

        const clock = new THREE.Clock();
        let frameId = 0;
        const animate = () => {
          frameId = requestAnimationFrame(animate);
          mixer.update(clock.getDelta());
          renderer.render(scene3d, camera);
        };
        animate();

        const onResize = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (!w || !h) return;
          frame(w, h);
          renderer.setSize(w, h);
        };
        const observer = new ResizeObserver(onResize);
        observer.observe(container);

        // THE CONTEXT CAN BE LOST. On a phone, in a background tab, under
        // memory pressure, the browser takes the WebGL context away. If that
        // happens and nothing is said, the reader sees a frozen frame and
        // assumes the app has hung.
        const onContextLost = (e: Event) => {
          e.preventDefault();
          setError(
            'The 3D view lost its graphics context — usually the phone reclaimed memory. The drawn animal is shown instead.'
          );
        };
        canvas.addEventListener('webglcontextlost', onContextLost);

        // THE READER CAN PET WHAT THEY CAN SEE.
        const onPointerDown = (e: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          const pointer = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const ray = raycasterRef.current;
          if (!ray) return;
          ray.setFromCamera(pointer, camera);
          if (ray.intersectObject(pivot, true).length > 0) onPet?.();
        };
        canvas.addEventListener('pointerdown', onPointerDown);

        setLoaded(true);

        // The teardown has to be complete: a rig that is not disposed leaks a
        // WebGL context every time the reader switches dogs.
        (container as HTMLDivElement & { __afDispose?: () => void }).__afDispose = () => {
          cancelAnimationFrame(frameId);
          observer.disconnect();
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('pointerdown', onPointerDown);
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
      actionRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      currentRef.current = '';
      setLoaded(false);
    };
  }, [url, onPet]);

  /**
   * HOLD A CLIP, CROSSFADING INTO IT.
   *
   * `crossFadeTo` is the whole reason this looks like a dog moving rather
   * than a clip switching. Without it every change of behaviour is a jump
   * cut, and the animal reads as a slideshow.
   */
  const play = useCallback((intent: string) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    if (currentRef.current === intent) return;

    const clip = findClip(clipsRef.current, intent);
    if (!clip) {
      // THE RIG CANNOT DO THIS. Say so, rather than standing there doing
      // nothing in silence.
      setMissingClip(intent);
      currentRef.current = intent;
      return;
    }
    setMissingClip(null);

    const previous = actionRef.current;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    if (previous && previous !== action) {
      previous.crossFadeTo(action, CROSSFADE_SECONDS, true);
    }
    actionRef.current = action;
    currentRef.current = intent;
  }, []);

  // The mood decides the clip. Asleep, he sleeps. Otherwise he is up.
  useEffect(() => {
    if (!loaded) return;
    if (asleep) {
      play('sleep');
    } else if (!interactionTrigger) {
      play('idle');
    }
  }, [asleep, loaded, interactionTrigger, play]);

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
  }, [interactionTrigger, loaded, asleep, play, onInteractionEnd]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />

      {error && (
        <>
          {/* THE FALLBACK IS VISIBLE, NOT PROMISED.
              The message said the drawn animal would take over, so it does. */}
          <Suspense fallback={null}>
            <div className="absolute inset-0">
              <DogAvatar3D
                dog={dog}
                petState={petState}
                interactionTrigger={interactionTrigger}
                onInteractionEnd={onInteractionEnd}
              />
            </div>
          </Suspense>
          <p className="absolute bottom-0 left-0 right-0 z-10 m-2 border-hairline bg-zinc-950/90 p-2 text-[11px] leading-snug text-amber-400">
            {error}
          </p>
        </>
      )}

      {!error && missingClip && (
        <p className="absolute bottom-2 left-2 z-10 border-hairline bg-zinc-950/80 px-1.5 py-1 text-[10px] text-zinc-400">
          This rig has no “{missingClip}” animation.
        </p>
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
