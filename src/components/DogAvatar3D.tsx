import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { coatColorAt, coatOf, type CoatPart } from '../domain/coat';
import { sound } from '../utils/proceduralAudio';

/** What the body is doing. Training (and sleep) set it; the avatar eases into it. */
export type AvatarPose = 'stand' | 'sit' | 'down' | 'paw' | 'sleep';

interface DogAvatar3DProps {
  dog: DogProfile;
  petState: PetState;
  interactionTrigger: 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'communicate' | null;
  onInteractionEnd?: () => void;
  pose?: AvatarPose;
}

/**
 * THE POSES, AS NUMBERS.
 *
 * The body hangs off a "chassis" that pivots at the hips, so a sit is one
 * tilt of the chassis plus the legs folding — not a second model.
 *   rootY      how far the whole dog sinks
 *   pitch      chassis tilt at the hips (negative = nose up)
 *   front/back leg swing at the shoulder / hip (negative = forward)
 *   frontR     the right foreleg on its own (the paw lift)
 *   headY/headPitch  the head dropping toward the paws
 */
const POSES: Record<AvatarPose, { rootY: number; pitch: number; front: number; frontR: number; back: number; headY: number; headPitch: number }> = {
  stand: { rootY: 0, pitch: 0, front: 0, frontR: 0, back: 0, headY: 0, headPitch: 0 },
  sit: { rootY: -0.26, pitch: -0.45, front: 0.45, frontR: 0.45, back: -1.45, headY: 0.02, headPitch: 0.3 },
  paw: { rootY: -0.26, pitch: -0.45, front: 0.45, frontR: -0.75, back: -1.45, headY: 0.02, headPitch: 0.3 },
  down: { rootY: -0.27, pitch: 0, front: -1.5, frontR: -1.5, back: -1.45, headY: -0.04, headPitch: 0 },
  sleep: { rootY: -0.27, pitch: 0, front: -1.5, frontR: -1.5, back: -1.45, headY: -0.3, headPitch: 0.42 },
};

export const DogAvatar3D: React.FC<DogAvatar3DProps> = ({
  dog,
  petState,
  interactionTrigger,
  onInteractionEnd,
  pose = 'stand',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  /**
   * WHEN THE BROWSER CANNOT DRAW.
   *
   * A stage that cannot render used to be a black rectangle: the reader saw
   * nothing and could not tell whether the app was broken or the machine
   * could not. So the failure is stated, in words, in the space the scene
   * would have occupied.
   */
  const [webglError, setWebglError] = useState<string | null>(null);

  // The scene is built once per dog, but the dog's mood changes every
  // minute. The render loop reads mood through refs, never through the
  // closure it was born in — the old build froze Expo's mood at mount.
  const petStateRef = useRef(petState);
  petStateRef.current = petState;
  const poseRef = useRef(pose);
  poseRef.current = pose;

  const dogParts = useRef<{
    root: THREE.Group;
    head: THREE.Group;
    heartsGroup: THREE.Group;
    foodItem: THREE.Group | null;
    ballItem: THREE.Mesh | null;
  } | null>(null);

  const interactionState = useRef<{
    type: 'idle' | 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'communicate';
    timer: number;
  }>({ type: 'idle', timer: 0 });

  useEffect(() => {
    if (!interactionTrigger) return;
    interactionState.current = { type: interactionTrigger, timer: 2 };

    if (interactionTrigger === 'pet') {
      sound.happyYip();
      spawnHeart();
    } else if (interactionTrigger === 'feed') {
      sound.eatCrunch();
      spawnFood();
    } else if (interactionTrigger === 'play') {
      sound.ballBounce();
      sound.bark();
      spawnBall();
    } else if (interactionTrigger === 'groom') {
      sound.happyYip();
    } else if (interactionTrigger === 'walk') {
      sound.bark();
    } else if (interactionTrigger === 'communicate') {
      sound.happyYip();
    }

    const t = setTimeout(() => {
      onInteractionEnd?.();
    }, 2000);
    return () => clearTimeout(t);
  }, [interactionTrigger]);

  const spawnHeart = () => {
    if (!dogParts.current) return;
    const { heartsGroup } = dogParts.current;
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    heart.position.set((Math.random() - 0.5) * 0.6, 1.55, 0.3 + (Math.random() - 0.5) * 0.4);
    heart.userData = { vy: 0.5 + Math.random() * 0.4, life: 1 };
    heartsGroup.add(heart);
  };

  const spawnFood = () => {
    if (!dogParts.current) return;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.5 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), mat);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    const tipGeo = new THREE.SphereGeometry(0.05, 10, 8);
    for (const [x, y] of [[-0.15, 0.04], [-0.15, -0.04], [0.15, 0.04], [0.15, -0.04]]) {
      const tip = new THREE.Mesh(tipGeo, mat);
      tip.position.set(x, y, 0);
      group.add(tip);
    }
    group.position.set(0, 1.7, 0.95);
    dogParts.current.root.add(group);
    dogParts.current.foodItem = group;
  };

  const spawnBall = () => {
    if (!dogParts.current) return;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.8 })
    );
    ball.position.set(1.0, 1.4, 1.0);
    ball.userData = { vx: -0.9, vy: 0 };
    dogParts.current.root.add(ball);
    dogParts.current.ballItem = ball;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 390;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    // THE FRAMING IS A FUNCTION OF THE BOX, NOT A CONSTANT: the distance is
    // solved so the whole dog — paw to ear tip, nose to plume — fits in both
    // axes of whatever region the cockpit gives the stage.
    const DOG_HEIGHT = 1.85;
    const DOG_WIDTH = 1.95;
    const fitCamera = (w: number, h: number) => {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (w / h));
      const distV = DOG_HEIGHT / 2 / Math.tan(vFov / 2);
      const distH = DOG_WIDTH / 2 / Math.tan(hFov / 2);
      const dist = Math.max(distV, distH) * 1.08;
      camera.position.set(0, 0.85 + dist * 0.14, dist);
      camera.lookAt(0, 0.8, 0);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fitCamera(width, height);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) {
      console.error('WebGL is unavailable; the avatar cannot be drawn.', err);
      setWebglError(
        'This browser cannot draw the 3D avatar — WebGL is unavailable. Everything else on this screen still works.'
      );
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    // Light. A white dog under a hot key light is a white blob, so the key
    // is moderate and a sky/ground hemisphere does the soft plush modelling.
    // The amber accent belongs to the interface, never to the fur.
    scene.add(new THREE.HemisphereLight(0xf2f4fa, 0x2a2622, 1.25));
    const key = new THREE.DirectionalLight(0xfff3e4, 1.7);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9bbd8, 0.9);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.0, 0.1, 48),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.75, metalness: 0.1 })
    );
    podium.position.y = -0.05;
    podium.receiveShadow = true;
    scene.add(podium);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.88, 1.9, 64),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, opacity: 0.4, transparent: true })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    // ==========================================
    // THE PLUSH BANGKAEW
    // ==========================================
    //
    // Three earlier builds placed dozens of primitives side by side, and the
    // eye read every primitive: the ruff became a stack of cone cups. This
    // one is a handful of big, overlapping, soft volumes — skull, cheeks,
    // muzzle, a lion's mane, a bean of a body, stubby legs, a curled plume —
    // painted by one coat rule and covered in shell fur, so the seams vanish
    // under the fluff the way they do on a plush toy.
    //
    // Bangkaew signatures carried on purpose: a broad wedge head with cheek
    // ruff, small thick prick ears set high, a mane round neck and chest,
    // feathered "pants", and a plume carried over the back.
    const { pattern, colors } = coatOf(dog.avatarConfig);
    const fluff = 0.45 + 0.75 * (dog.avatarConfig.furFluff ?? 0.6);

    // Shell fur: the same surface drawn again, pushed out along its normals,
    // each layer keeping fewer strands. Fewer layers on phones.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const SHELLS = coarse ? 7 : 11;

    const strandTex = (() => {
      // Random per texel, but sampled smoothly: soft clumps of fur, not the
      // single-pixel static a nearest-filtered noise gives.
      const size = 128;
      const data = new Uint8Array(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        const v = Math.floor(Math.random() * 255);
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      const tex = new THREE.DataTexture(data, size, size);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(9, 5);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return tex;
    })();

    const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const shellMats = Array.from({ length: SHELLS }, (_, i) => {
      const k = (i + 1) / SHELLS;
      const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        alphaMap: strandTex,
        alphaTest: 0.08 + 0.86 * k,
      });
      // Inner layers sit in the shade of the outer ones.
      m.color.setScalar(0.7 + 0.3 * k);
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float furLen;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             transformed += normal * furLen * ${k.toFixed(3)};
             transformed.y -= furLen * ${(k * k * 0.35).toFixed(3)};`
          );
      };
      m.customProgramCacheKey = () => `shell-${i}`;
      return m;
    });

    /**
     * A soft volume: a sphere-like geometry scaled (the scale is baked into
     * the vertices, so normals and fur length stay true), painted by the
     * coat rule in its own coordinates, then moved into place.
     */
    const paint = (
      geo: THREE.BufferGeometry,
      part: CoatPart,
      fur: number | ((x: number, y: number, z: number) => number),
      coords: (x: number, y: number, z: number) => [number, number, number] = (x, y, z) => [x, y, z]
    ) => {
      const pos = geo.getAttribute('position');
      const col = new Float32Array(pos.count * 3);
      const len = new Float32Array(pos.count);
      const tmp = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const [cx, cy, cz] = coords(pos.getX(i), pos.getY(i), pos.getZ(i));
        const [r, g, b] = coatColorAt(part, cx, cy, cz, pattern, colors);
        // The coat rule speaks sRGB; the renderer works in linear light.
        tmp.setRGB(r, g, b, THREE.SRGBColorSpace);
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
        len[i] = (typeof fur === 'number' ? fur : fur(pos.getX(i), pos.getY(i), pos.getZ(i))) * fluff;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
      return geo;
    };

    const blob = (sx: number, sy: number, sz: number, w = 40, h = 28) =>
      new THREE.SphereGeometry(1, w, h).scale(sx, sy, sz);

    /** One furry mesh: a skin plus its shells, all sharing one geometry. */
    const furry = (geo: THREE.BufferGeometry, shells = true) => {
      const group = new THREE.Group();
      const skin = new THREE.Mesh(geo, skinMat);
      skin.castShadow = true;
      skin.userData.skin = true;
      group.add(skin);
      if (shells) {
        for (const m of shellMats) group.add(new THREE.Mesh(geo, m));
      }
      return group;
    };

    const dogRoot = new THREE.Group();
    scene.add(dogRoot);

    // The chassis pivots at the hips; everything but the hind legs rides on it.
    const HIP = new THREE.Vector3(0, 0.45, -0.38);
    const chassis = new THREE.Group();
    chassis.position.copy(HIP);
    dogRoot.add(chassis);
    const onChassis = (obj: THREE.Object3D, x: number, y: number, z: number) => {
      obj.position.set(x - HIP.x, y - HIP.y, z - HIP.z);
      chassis.add(obj);
      return obj;
    };

    // 1. Body and mane, one mesh. The mane is longer fur, longest low in front.
    const torsoGeo = paint(blob(0.4, 0.36, 0.6), 'torso', 0.065).translate(0, 0.6, -0.05);
    const maneGeo = paint(blob(0.4, 0.4, 0.34), 'mane', (_x, y, z) => 0.085 + Math.max(0, z) * 0.08 - Math.min(0, y) * 0.07)
      .translate(0, 0.86, 0.32);
    const body = furry(mergeGeometries([torsoGeo, maneGeo])!);
    const breathing = new THREE.Group();
    breathing.add(body);
    onChassis(breathing, 0, 0, 0);

    // 2. The head: skull, cheek ruff and muzzle as one furry mesh, eyes,
    // nose and mouth as smooth pieces on top.
    const head = new THREE.Group();
    onChassis(head, 0, 1.24, 0.58);
    const HEAD_REST = head.position.clone();
    const skullGeo = paint(blob(0.32, 0.29, 0.28), 'head', 0.026);
    const cheekL = paint(blob(0.14, 0.13, 0.14, 24, 16), 'cheek', 0.05).translate(0.17, -0.09, 0.05);
    const cheekR = paint(blob(0.14, 0.13, 0.14, 24, 16), 'cheek', 0.05).translate(-0.17, -0.09, 0.05);
    const muzzleGeo = paint(blob(0.13, 0.1, 0.15, 28, 20), 'muzzle', 0.012).translate(0, -0.09, 0.24);
    head.add(furry(mergeGeometries([skullGeo, cheekL, cheekR, muzzleGeo])!));

    const glossy = (color: number, roughness = 0.2) => new THREE.MeshStandardMaterial({ color, roughness });
    const nose = new THREE.Mesh(blob(0.058, 0.042, 0.042, 20, 14), glossy(0x121010, 0.25));
    nose.position.set(0, -0.045, 0.385);
    head.add(nose);
    const mouth = new THREE.Mesh(blob(0.075, 0.03, 0.05, 16, 10), glossy(0x3a1616, 0.6));
    mouth.position.set(0, -0.165, 0.27);
    head.add(mouth);
    const tongue = new THREE.Mesh(blob(0.045, 0.014, 0.075, 16, 10), glossy(0xe0707c, 0.45));
    tongue.position.set(0, -0.19, 0.31);
    tongue.rotation.x = 0.55;
    head.add(tongue);

    // The eyes are where the cute lives: big, dark, wet, with a catch-light.
    const eyes: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(0.11 * side, 0.035, 0.235);
      // Expo's eyes are amber-brown: an iris with a dark pupil in front,
      // so they read inside the dark mask instead of vanishing into it.
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 16), glossy(0x7a4a1c, 0.12));
      eye.add(ball);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), glossy(0x0c0806, 0.08));
      pupil.position.set(0, 0, 0.03);
      eye.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(0.018 * side, 0.024, 0.058);
      glint.userData.glint = true;
      eye.add(glint);
      head.add(eye);
      eyes.push(eye);
    }

    // Ears: small, thick, set high, pricked. Pivot at the base so they can
    // turn and flatten.
    const ears: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const ear = new THREE.Group();
      ear.position.set(0.16 * side, 0.2, -0.03);
      const outer = paint(new THREE.ConeGeometry(0.12, 0.24, 24, 6).scale(1, 1, 0.55), 'ear', 0.018).translate(0, 0.12, 0);
      ear.add(furry(outer));
      const inner = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.15, 16).scale(1, 1, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x9c7468, roughness: 0.95 })
      );
      inner.position.set(0, 0.095, 0.045);
      ear.add(inner);
      head.add(ear);
      ears.push(ear);
    }

    // 3. Legs: stubby capsules with round paws; the hind legs carry the
    // feathered thighs. Pivot at the shoulder / hip.
    const LEG_TOP = 0.45;
    const makeLeg = (x: number, z: number, hind: boolean) => {
      const side = Math.sign(x);
      const parts = [
        paint(new THREE.CapsuleGeometry(0.085, 0.3, 8, 20), 'leg', 0.035, (lx, ly, lz) => [lx, ly - 0.2, lz]).translate(0, -0.2, 0),
        paint(blob(0.1, 0.065, 0.13, 24, 14), 'leg', 0.014, (lx, ly, lz) => [lx, ly - 0.4, lz]).translate(0, -0.385, 0.035),
      ];
      if (hind) {
        parts.push(
          paint(blob(0.17, 0.22, 0.22, 28, 20), 'thigh', (_lx, ly, lz) => 0.05 + Math.max(0, -lz) * 0.25 + Math.max(0, -ly) * 0.1, (lx, ly, lz) => [lx * side, ly, lz])
            .translate(0.03 * side, 0.03, 0)
        );
      }
      const leg = furry(mergeGeometries(parts)!);
      const pivot = new THREE.Group();
      pivot.add(leg);
      if (hind) {
        pivot.position.set(x, LEG_TOP, z);
        dogRoot.add(pivot);
      } else {
        onChassis(pivot, x, LEG_TOP, z);
      }
      return pivot;
    };
    const frontL = makeLeg(0.17, 0.3, false);
    const frontR = makeLeg(-0.17, 0.3, false);
    const backL = makeLeg(0.19, -0.4, true);
    const backR = makeLeg(-0.19, -0.4, true);

    // 4. The plume: overlapping balls along a curl over the back, merged and
    // furred so it reads as one feathered tail.
    const tail = new THREE.Group();
    onChassis(tail, 0, 0.8, -0.6);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.22, -0.12),
      new THREE.Vector3(0, 0.42, -0.04),
      new THREE.Vector3(0, 0.5, 0.15),
      new THREE.Vector3(0, 0.44, 0.32),
    ]);
    const TAIL_BALLS = 14;
    const tailParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < TAIL_BALLS; i++) {
      const t = i / (TAIL_BALLS - 1);
      const p = curve.getPoint(t);
      const r = 0.06 + 0.08 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      tailParts.push(
        paint(blob(r, r, r, 22, 16), 'tail', 0.13 + t * 0.05, (lx, ly) => [lx, ly, t]).translate(p.x, p.y, p.z)
      );
    }
    tail.add(furry(mergeGeometries(tailParts)!));

    const heartsGroup = new THREE.Group();
    scene.add(heartsGroup);

    dogParts.current = { root: dogRoot, head, heartsGroup, foodItem: null, ballItem: null };

    // ==========================================
    // ORBIT, AND PETTING BY CLICK (A CLICK IS A PRESS THAT DID NOT DRAG)
    // ==========================================
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let targetYaw = 0.45;
    let targetTilt = 0;
    const domElem = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      targetYaw += (e.clientX - lastX) * 0.008;
      targetTilt = Math.max(-0.15, Math.min(0.3, targetTilt + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (dragging && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
        interactionState.current = { type: 'pet', timer: 1 };
        sound.happyYip();
        spawnHeart();
      }
      dragging = false;
    };
    domElem.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // ==========================================
    // THE LIVING LOOP
    // ==========================================
    const clock = new THREE.Clock();
    const cur = { ...POSES.stand };
    let nextBlink = 2 + Math.random() * 3;
    let blink = 0;
    const camLocal = new THREE.Vector3();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();
      const ps = petStateRef.current;

      const trust = ps.trust / 100;
      const arousal = ps.arousal / 100;
      const hunger = 1 - ps.needs.hunger / 100;
      const energy = ps.needs.energy / 100;
      const friendly = Math.max(0, trust * 0.7 + (1 - hunger * 0.5) * 0.3);
      const alert = Math.min(1, arousal * 0.6 + trust * 0.4);
      const tired = 1 - energy;
      const asleep = ps.sleep?.asleep ?? false;
      const act = interactionState.current;
      if (act.timer > 0) act.timer -= dt;
      const acting = act.timer > 0 ? act.type : 'idle';

      // Ease toward the pose. Sleep wins over anything training asked for.
      const target = POSES[asleep ? 'sleep' : poseRef.current];
      const ease = 1 - Math.exp(-dt * 6);
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) cur[k] += (target[k] - cur[k]) * ease;

      dogRoot.rotation.y += (targetYaw - dogRoot.rotation.y) * 0.1;
      dogRoot.rotation.x += (targetTilt - dogRoot.rotation.x) * 0.1;

      // Breathing: quick when excited, slow and deep asleep.
      const breath = Math.sin(t * (asleep ? 1.0 : 2.6 + arousal * 2)) * (asleep ? 0.035 : 0.014 + energy * 0.012);
      breathing.scale.set(1 + breath, 1 + breath * 0.8, 1);

      let bounce = 0;
      let walkX = 0;
      let stride = 0;
      if (acting === 'pet' || acting === 'groom') bounce = Math.abs(Math.sin(t * 9)) * 0.05;
      if (acting === 'play') bounce = Math.abs(Math.sin(t * 12)) * 0.1;
      if (acting === 'walk' && !asleep) {
        stride = Math.sin(t * 8);
        bounce = Math.abs(stride) * 0.04;
        walkX = Math.sin(t * 1.8) * 0.35;
      }
      dogRoot.position.set(walkX, cur.rootY + bounce, 0);
      chassis.rotation.x = cur.pitch;
      frontL.rotation.x = cur.front + stride * 0.5;
      frontR.rotation.x = cur.frontR - stride * 0.5;
      backL.rotation.x = cur.back - stride * 0.4;
      backR.rotation.x = cur.back + stride * 0.4;
      if (poseRef.current === 'paw' && !asleep) frontR.rotation.x += Math.sin(t * 6) * 0.12;

      // The head: follows you with its eyes and nose, rests on the paws asleep.
      camLocal.copy(camera.position);
      dogRoot.worldToLocal(camLocal);
      const gaze = asleep ? 0 : Math.max(-0.6, Math.min(0.6, Math.atan2(camLocal.x, camLocal.z - 0.6)));
      head.position.set(HEAD_REST.x, HEAD_REST.y + cur.headY + (friendly * 0.03 - tired * 0.03), HEAD_REST.z);
      head.rotation.y += (gaze + Math.sin(t * 0.7) * 0.06 - head.rotation.y) * 0.08;
      head.rotation.x = cur.headPitch - cur.pitch * 0.9 + (acting === 'feed' ? Math.max(0, Math.sin(t * 12)) * 0.15 : 0);
      head.rotation.z = acting === 'communicate' && trust < 0.6 ? 0.2 : Math.sin(t * 1.3) * 0.04;

      // Ears flatten when unsure or sleepy; they flick when alert.
      const flat = asleep ? 0.7 : (1 - trust) * 0.45 + tired * 0.2;
      ears.forEach((ear, i) => {
        const s = i === 0 ? 1 : -1;
        ear.rotation.x = -flat * 0.8;
        ear.rotation.z = -s * (0.18 + flat * 0.5) + Math.sin(t * (3.1 + i * 0.4)) * 0.04 * alert;
      });

      // Blinks, and shut eyes asleep.
      nextBlink -= dt;
      if (nextBlink <= 0) {
        blink = 0.14;
        nextBlink = 2.5 + Math.random() * 4;
      }
      blink = Math.max(0, blink - dt);
      const lid = asleep ? 0.08 : blink > 0 ? 0.12 : acting === 'pet' ? 0.45 : 1;
      eyes.forEach((e) => {
        e.scale.y += (lid - e.scale.y) * 0.4;
        e.children.forEach((c) => c.userData.glint && (c.visible = e.scale.y > 0.3));
      });

      tongue.visible = !asleep;
      mouth.visible = !asleep;
      tongue.position.y = -0.19 + Math.sin(t * 2.8) * 0.006 * (1 + arousal);

      // Tail: the plume wags from its root; asleep it lies wrapped.
      let wagF = Math.max(1, 3 + friendly * 7 + alert * 3 - tired * 3);
      let wagA = Math.max(0.05, 0.18 + friendly * 0.28 + alert * 0.1 - tired * 0.15);
      if (acting === 'pet' || acting === 'feed') {
        wagF = 13;
        wagA = 0.5;
      } else if (acting === 'play') {
        wagF = 16;
        wagA = 0.6;
      }
      if (asleep) {
        wagA = 0.02;
        wagF = 1;
      }
      tail.rotation.y = Math.sin(t * wagF) * wagA;
      tail.rotation.x = asleep ? 0.9 : 0;

      // Food falls and is eaten; the ball bounces past.
      const parts = dogParts.current;
      if (parts?.foodItem) {
        const item = parts.foodItem;
        if (item.position.y > 1.0) item.position.y -= dt * 1.4;
        else item.scale.multiplyScalar(0.93);
        item.rotation.y += dt * 3;
        if (item.scale.x < 0.08 || acting !== 'feed') {
          dogRoot.remove(item);
          parts.foodItem = null;
        }
      }
      if (parts?.ballItem) {
        const ball = parts.ballItem;
        ball.userData.vy -= dt * 6;
        ball.position.x += ball.userData.vx * dt;
        ball.position.y += ball.userData.vy * dt;
        if (ball.position.y < 0.12) {
          ball.position.y = 0.12;
          ball.userData.vy = Math.abs(ball.userData.vy) * 0.7;
        }
        if (acting !== 'play') {
          dogRoot.remove(ball);
          parts.ballItem = null;
        }
      }

      heartsGroup.children.slice().forEach((h) => {
        h.position.y += h.userData.vy * dt;
        h.userData.life -= dt * 0.9;
        h.scale.setScalar(Math.max(0.01, h.userData.life));
        if (h.userData.life <= 0) heartsGroup.remove(h);
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      fitCamera(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    // The cockpit resizes the stage's region, not just the window.
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      domElem.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      shellMats.forEach((m) => m.dispose());
      skinMat.dispose();
      strandTex.dispose();
      renderer.dispose();
    };
  }, [dog]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-zinc-950">
          <div className="max-w-sm border-hairline p-3">
            <p className="label mb-1">No WebGL</p>
            <p className="text-[12px] leading-relaxed text-zinc-300">{webglError}</p>
            <p className="text-[11px] text-zinc-500 mt-2">
              {dog.name} / {dog.breed}
            </p>
          </div>
        </div>
      )}

      {/* What the reader is looking at, and what they can do to it. Said
          once, where the scene does not cover it. */}
      {!webglError && (
        <>
          <p className="absolute bottom-2 left-2 max-w-[70%] text-[11px] leading-tight text-zinc-300 pointer-events-none">
            {dog.name}
            <span className="text-zinc-500"> / </span>
            {dog.breed}
          </p>
          <p className="absolute bottom-2 right-2 text-[11px] text-zinc-400 pointer-events-none">
            Drag to orbit, tap to pet
          </p>
        </>
      )}
    </div>
  );
};
