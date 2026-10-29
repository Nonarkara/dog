import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { coatColorAt, coatOf, type CoatPart } from '../domain/coat';
import { sound } from '../utils/proceduralAudio';

/** What the body is doing. Training (and sleep) set it; the avatar eases into it. */
export type AvatarPose = 'stand' | 'sit' | 'down' | 'paw' | 'sleep';

export type AvatarInteractionTrigger =
  | 'pet'
  | 'feed'
  | 'play'
  | 'groom'
  | 'walk'
  | 'communicate'
  | 'clean'
  | 'medicine'
  | 'scold'
  | null;

interface DogAvatar3DProps {
  dog: DogProfile;
  petState: PetState;
  interactionTrigger: AvatarInteractionTrigger;
  onInteractionEnd?: () => void;
  pose?: AvatarPose;
  /** He was petted by hand (a tap or a stroke on his body). */
  onPet?: () => void;
  /** Clean up poop clicked in 3D. */
  onClean?: () => void;
  /** Interactive play mini-game completed. */
  onMiniGameComplete?: (won: boolean) => void;
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
  // Resting his chin on his beloved bolster cushion
  sleep: { rootY: -0.27, pitch: 0, front: -1.5, frontR: -1.5, back: -1.45, headY: -0.22, headPitch: 0.36 },
};

export const DogAvatar3D: React.FC<DogAvatar3DProps> = ({
  dog,
  petState,
  interactionTrigger,
  onInteractionEnd,
  pose = 'stand',
  onPet,
  onClean,
  onMiniGameComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  const [webglError, setWebglError] = useState<string | null>(null);

  // The scene is built once per dog, but the dog's mood changes every
  // minute. The render loop reads mood through refs, never through the
  // closure it was born in.
  const petStateRef = useRef(petState);
  petStateRef.current = petState;
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const onPetRef = useRef(onPet);
  onPetRef.current = onPet;
  const onCleanRef = useRef(onClean);
  onCleanRef.current = onClean;
  const onMiniGameCompleteRef = useRef(onMiniGameComplete);
  onMiniGameCompleteRef.current = onMiniGameComplete;

  const dogParts = useRef<{
    root: THREE.Group;
    head: THREE.Group;
    jaw: THREE.Group;
    heartsGroup: THREE.Group;
    sparksGroup: THREE.Group;
    bowlGroup: THREE.Group;
    bolsterGroup: THREE.Group;
    poopGroup: THREE.Group;
    ballItem: THREE.Mesh | null;
  } | null>(null);

  const interactionState = useRef<{
    type: AvatarInteractionTrigger;
    timer: number;
  }>({ type: null, timer: 0 });

  const gameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameBusy = useRef(false);
  useEffect(() => () => { if (gameTimer.current) clearTimeout(gameTimer.current); }, []);

  // Tamagotchi Agility Catch Mini-Game state
  const [miniGame, setMiniGame] = useState<{
    active: boolean;
    target: 'left' | 'right';
    round: number; // 1..5
    score: number;
    lastResult: 'hit' | 'miss' | null;
    leaping: 'left' | 'right' | null;
  }>({ active: false, target: 'left', round: 1, score: 0, lastResult: null, leaping: null });

  const gameLeap = useRef<{ dir: 'left' | 'right' | null; progress: number }>({ dir: null, progress: 0 });

  useEffect(() => {
    if (!interactionTrigger) return;
    interactionState.current = { type: interactionTrigger, timer: 2.2 };

    if (interactionTrigger === 'play') {
      if (gameTimer.current) clearTimeout(gameTimer.current);
      gameBusy.current = false;
      gameLeap.current = { dir: null, progress: 0 };
    }
    if (interactionTrigger === 'pet') {
      sound.happyYip();
      spawnHeart();
    } else if (interactionTrigger === 'feed') {
      sound.eatCrunch();
    } else if (interactionTrigger === 'play') {
      sound.ballBounce();
      sound.bark();
      setMiniGame({ active: true, target: Math.random() < 0.5 ? 'left' : 'right', round: 1, score: 0, lastResult: null, leaping: null });
    } else if (interactionTrigger === 'groom') {
      sound.happyYip();
      spawnSparkAtCenter();
    } else if (interactionTrigger === 'clean') {
      sound.sweepClean();
      spawnSparkAtCenter();
    } else if (interactionTrigger === 'medicine') {
      sound.medicineChime();
      spawnHeart();
    } else if (interactionTrigger === 'scold') {
      sound.scoldBuzzer();
    } else if (interactionTrigger === 'walk') {
      sound.bark();
    } else if (interactionTrigger === 'communicate') {
      sound.happyYip();
    }

    const t = setTimeout(() => {
      onInteractionEnd?.();
    }, 2200);
    return () => clearTimeout(t);
  }, [interactionTrigger]);

  const spawnHeart = (count = 1) => {
    if (!dogParts.current) return;
    const { heartsGroup } = dogParts.current;
    for (let i = 0; i < count; i++) {
      const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      heart.position.set((Math.random() - 0.5) * 0.6, 1.55, 0.3 + (Math.random() - 0.5) * 0.4);
      heart.userData = { vy: 0.5 + Math.random() * 0.4, life: 1 };
      heartsGroup.add(heart);
    }
  };

  const spawnSparkAtCenter = () => {
    if (!dogParts.current) return;
    const { sparksGroup } = dogParts.current;
    for (let i = 0; i < 8; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 1 })
      );
      spark.position.set((Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.5, 0.1);
      spark.userData = {
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.2 + Math.random() * 0.6,
        vz: (Math.random() - 0.5) * 0.8,
        life: 0.8,
      };
      sparksGroup.add(spark);
    }
  };

  const spawnTouchSpark = (pos: THREE.Vector3) => {
    if (!dogParts.current) return;
    const { sparksGroup } = dogParts.current;
    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 1 })
      );
      spark.position.copy(pos);
      spark.userData = {
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.3 + Math.random() * 0.5,
        vz: (Math.random() - 0.5) * 0.6,
        life: 0.7,
      };
      sparksGroup.add(spark);
    }
  };

  const spawnBall = (targetX: number) => {
    if (!dogParts.current) return;
    const previous = dogParts.current.ballItem;
    if (previous) { previous.removeFromParent(); previous.geometry.dispose(); (previous.material as THREE.Material).dispose(); }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.8 })
    );
    ball.position.set(0, 1.4, 1.4);
    ball.userData = { vx: targetX * 0.8, vy: 0.5, vz: -1.2 };
    dogParts.current.root.add(ball);
    dogParts.current.ballItem = ball;
  };

  // Mini-Game Player Choice (Left or Right)
  const handleMiniGameChoice = (choice: 'left' | 'right') => {
    if (!miniGame.active || miniGame.leaping !== null || gameBusy.current) return;
    gameBusy.current = true;
    // The ball's direction is visible before the player chooses. No hidden coin toss.
    const dogChoice = choice;
    const isHit = choice === miniGame.target;
    gameLeap.current = { dir: dogChoice, progress: 0 };
    spawnBall(miniGame.target === 'left' ? -0.7 : 0.7);

    if (isHit) {
      sound.bark();
      sound.chimeSuccess();
      spawnHeart(2);
    } else {
      sound.ballBounce();
    }

    setMiniGame((prev) => ({
      ...prev,
      leaping: dogChoice,
      score: prev.score + (isHit ? 1 : 0),
      lastResult: isHit ? 'hit' : 'miss',
    }));

    const score = miniGame.score + (isHit ? 1 : 0);
    gameTimer.current = setTimeout(() => {
      gameBusy.current = false;
      if (miniGame.round >= 5) {
        const won = score >= 3;
        if (won) sound.chimeSuccess();
        setMiniGame(prev => ({ ...prev, active: false, leaping: null }));
        onMiniGameCompleteRef.current?.(won);
      } else {
        setMiniGame(prev => ({ ...prev, round: prev.round + 1, leaping: null,
          lastResult: null, target: Math.random() < 0.5 ? 'left' : 'right' }));
      }
      gameLeap.current = { dir: null, progress: 0 };
    }, 850);
  };

  const closeMiniGame = () => {
    if (gameTimer.current) clearTimeout(gameTimer.current);
    gameBusy.current = false;
    setMiniGame({ active: false, target: 'left', round: 1, score: 0, lastResult: null, leaping: null });
    gameLeap.current = { dir: null, progress: 0 };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 390;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    const DOG_HEIGHT = 2.12;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

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

    // Warm stage spotlight on center podium
    const spot = new THREE.SpotLight(0xffeedd, 1.2, 8, Math.PI / 4, 0.5);
    spot.position.set(0, 4.5, 2.5);
    spot.target.position.set(0, 0.5, 0);
    scene.add(spot);
    scene.add(spot.target);

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
    // EXPO'S BOLSTER BED (Bolster Connoisseur Quirk)
    // ==========================================
    const bolsterGroup = new THREE.Group();
    const bolsterRingGeo = new THREE.TorusGeometry(0.72, 0.16, 20, 36);
    bolsterRingGeo.rotateX(Math.PI / 2);
    const bolsterMat = new THREE.MeshStandardMaterial({ color: 0x24332f, roughness: 0.92 });
    const bolsterRing = new THREE.Mesh(bolsterRingGeo, bolsterMat);
    bolsterRing.position.set(0, 0.08, -0.05);
    bolsterRing.castShadow = true;
    bolsterRing.receiveShadow = true;
    bolsterGroup.add(bolsterRing);

    const padGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.09, 32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.95 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 0.045, -0.05);
    pad.receiveShadow = true;
    bolsterGroup.add(pad);
    bolsterGroup.scale.set(0.001, 0.001, 0.001);
    scene.add(bolsterGroup);

    // ==========================================
    // 3D FOOD BOWL & REAL FEASTING
    // ==========================================
    const bowlGroup = new THREE.Group();
    const bowlGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.11, 24, 1, false);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.7, roughness: 0.25 });
    const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    bowlGroup.add(bowlMesh);

    const kibbleMat = new THREE.MeshStandardMaterial({ color: 0x5a341a, roughness: 0.9 });
    const kibbleGeo = new THREE.DodecahedronGeometry(0.032);
    const kibbleMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const km = new THREE.Mesh(kibbleGeo, kibbleMat);
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 0.04 + Math.random() * 0.1;
      km.position.set(Math.cos(ang) * dist, 0.035 + (i % 3) * 0.015, Math.sin(ang) * dist);
      km.rotation.set(Math.random(), Math.random(), Math.random());
      bowlGroup.add(km);
      kibbleMeshes.push(km);
    }
    bowlGroup.position.set(0, 0.055, 0.65);
    bowlGroup.scale.set(0.001, 0.001, 0.001);
    scene.add(bowlGroup);

    // ==========================================
    // 3D WASTE / POOP ON THE STAGE
    // ==========================================
    const poopGroup = new THREE.Group();
    scene.add(poopGroup);

    const POOP_SPOTS = [
      new THREE.Vector3(0.72, 0.05, -0.22),
      new THREE.Vector3(-0.75, 0.05, 0.18),
      new THREE.Vector3(0.55, 0.05, 0.68),
      new THREE.Vector3(-0.52, 0.05, -0.62),
    ];
    const poopMat = new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.35 });
    const flyMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const flyGeo = new THREE.SphereGeometry(0.018, 6, 6);

    const poopMeshes: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const pGrp = new THREE.Group();
      pGrp.position.copy(POOP_SPOTS[i]);
      const baseTorus = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.045, 8, 16), poopMat);
      baseTorus.rotation.x = Math.PI / 2;
      pGrp.add(baseTorus);
      const midTorus = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.035, 8, 16), poopMat);
      midTorus.rotation.x = Math.PI / 2;
      midTorus.position.y = 0.04;
      pGrp.add(midTorus);
      const tipSphere = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), poopMat);
      tipSphere.position.y = 0.075;
      pGrp.add(tipSphere);

      const fly = new THREE.Mesh(flyGeo, flyMat);
      fly.position.set(0.06, 0.12, 0);
      pGrp.add(fly);

      pGrp.userData = { isPoop: true, index: i, fly };
      pGrp.scale.set(0.001, 0.001, 0.001);
      poopGroup.add(pGrp);
      poopMeshes.push(pGrp);
    }

    // ==========================================
    // SICKNESS INDICATOR AURA
    // ==========================================
    const sickAura = new THREE.Group();
    const sickMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.75 });
    // Thermometer / cross icon
    const crossBarH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), sickMat);
    const crossBarV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), sickMat);
    sickAura.add(crossBarH);
    sickAura.add(crossBarV);
    sickAura.position.set(0, 1.85, 0.35);
    sickAura.scale.set(0.001, 0.001, 0.001);
    scene.add(sickAura);

    // ==========================================
    // THE PLUSH BANGKAEW
    // ==========================================
    const { pattern, colors } = coatOf(dog.avatarConfig);
    const fluff = 0.45 + 0.75 * (dog.avatarConfig.furFluff ?? 0.6);

    // Solid cel surfaces: no alpha-tested fur shells or procedural strand texture.
    const skinMat = new THREE.MeshToonMaterial({ vertexColors: true });
    const compact = /French Bulldog|Pug/i.test(dog.breed);
    const pug = /Pug/i.test(dog.breed);
    const frenchie = /French Bulldog/i.test(dog.breed);
    const mali = dog.id === 'mali-2022';
    const bangkaew = /Bangkaew/i.test(dog.breed);
    const muzzleDepth = compact ? 0.45 : 1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        if (pug) {
          // Paolo's cream forehead has no white blaze. His dark mask sits low,
          // around the eyes and broad jowls, as in the owner's photographs.
          const dark = part === 'ear' || part === 'muzzle' ||
            (part === 'head' && cz > 0.13 && (cy < -0.015 || Math.hypot(Math.abs(cx) - 0.165, cy - 0.025) < 0.09));
          const color = new THREE.Color(dark ? colors.dark : part === 'head' || part === 'cheek' ? colors.base : colors.light);
          // THREE.Color has already converted this colour to linear space.
          tmp.copy(color);
        } else
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

    const blob = (sx: number, sy: number, sz: number, w = 24, h = 16) =>
      new THREE.SphereGeometry(1, Math.min(w, 24), Math.min(h, 16)).scale(sx, sy, sz);

    const skins: THREE.Mesh[] = [];
    const furry = (geo: THREE.BufferGeometry, _shells = true, region = 'body') => {
      const group = new THREE.Group();
      const skin = new THREE.Mesh(geo, skinMat);
      skin.castShadow = true;
      skin.userData.region = region;
      skins.push(skin);
      group.add(skin);
      // Sparse ink describes the ruff; the silhouette carries the volume.
      return group;
    };

    const dogRoot = new THREE.Group();
    scene.add(dogRoot);

    const HIP = new THREE.Vector3(0, 0.45, -0.38);
    const chassis = new THREE.Group();
    chassis.position.copy(HIP);
    dogRoot.add(chassis);
    const onChassis = (obj: THREE.Object3D, x: number, y: number, z: number) => {
      obj.position.set(x - HIP.x, y - HIP.y, z - HIP.z);
      chassis.add(obj);
      return obj;
    };

    // 1. Body & lion mane
    const torsoGeo = paint(blob(mali ? 0.49 : pug ? 0.47 : compact ? 0.39 : 0.4, mali ? 0.39 : compact ? 0.3 : 0.36, pug ? 0.57 : compact ? 0.49 : 0.6), 'torso', 0.065).translate(0, 0.6, -0.05);
    const maneGeo = paint(
      blob(bangkaew ? 0.43 : compact ? 0.29 : 0.33, bangkaew ? 0.35 : 0.26, compact ? 0.23 : 0.3),
      'mane',
      (x, y, z) => 0.09 + Math.max(0, z) * 0.06 + Math.max(0, -y) * 0.12 + Math.max(0, Math.abs(x) - 0.3) * 0.25
    ).translate(0, 0.82, 0.26);
    const neckGeo = paint(blob(compact ? 0.24 : 0.3, compact ? 0.21 : 0.27, 0.27), 'mane', (_x, y) => 0.1 + Math.max(0, -y) * 0.15, (x, y, z) => [x, y + 0.08, z - 0.08])
      .translate(0, 1.02, 0.44);
    const body = furry(mergeGeometries([torsoGeo, maneGeo, neckGeo])!);
    const breathing = new THREE.Group();
    breathing.add(body);
    onChassis(breathing, 0, 0, 0);

    // 2. The Head & Articulated Jaw
    const head = new THREE.Group();
    onChassis(head, 0, pug ? 1.12 : 1.2, 0.59);
    if (pug) head.scale.setScalar(1.12);
    const HEAD_REST = head.position.clone();
    const skullGeo = paint(blob(pug ? 0.37 : compact ? 0.34 : 0.32, pug ? 0.3 : 0.29, 0.28), 'head', 0.028);
    const cheekL = paint(blob(bangkaew ? 0.18 : 0.13, 0.15, 0.13, 24, 16), 'cheek', (x) => 0.045 + Math.max(0, x) * 0.2).translate(0.16, -0.08, -0.02);
    const cheekR = paint(blob(bangkaew ? 0.18 : 0.13, 0.15, 0.13, 24, 16), 'cheek', (x) => 0.045 + Math.max(0, -x) * 0.2).translate(-0.16, -0.08, -0.02);
    const muzzleGeo = paint(blob(pug ? 0.22 : compact ? 0.16 : 0.13, pug ? 0.13 : 0.095, 0.18 * muzzleDepth, 24, 16), 'muzzle', 0.012).translate(0, -0.1, 0.25);
    const muzzleTip = paint(blob(0.085, 0.07, 0.08, 20, 14), 'muzzle', 0.008).translate(0, -0.1, compact ? 0.28 : 0.38);
    head.add(furry(mergeGeometries([skullGeo, cheekL, cheekR, muzzleGeo, muzzleTip])!, true, 'head'));

    if (pug) for (const side of [-1, 1]) {
      const jowl = paint(blob(0.125, 0.115, 0.07, 16, 12), 'muzzle', 0);
      head.add(furry(jowl.translate(side * 0.1, -0.115, 0.265), false, 'head'));
    }

    const glossy = (color: number, roughness = 0.2) => new THREE.MeshStandardMaterial({ color, roughness });
    const nose = new THREE.Mesh(blob(pug ? 0.082 : 0.062, pug ? 0.055 : 0.046, 0.046, 20, 14), glossy(0x121010, 0.22));
    nose.position.set(0, -0.06, compact ? 0.325 : 0.455);
    head.add(nose);

    // Articulated Jaw
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.13, compact ? 0.11 : 0.22);
    head.add(jaw);

    const mouth = new THREE.Mesh(blob(0.08, 0.03, 0.07, 16, 10), glossy(0x3a1616, 0.6));
    mouth.position.set(0, -0.05, 0.11);
    jaw.add(mouth);
    const tongue = new THREE.Mesh(blob(0.045, 0.014, 0.08, 16, 10), glossy(0xe0707c, 0.45));
    tongue.position.set(pug ? -0.055 : 0, -0.075, pug ? 0.21 : 0.16);
    tongue.rotation.x = 0.55;
    jaw.add(tongue);

    // Almond eyes with glints
    const eyes: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set((pug ? 0.17 : 0.135) * side, pug ? 0.025 : 0.045, pug ? 0.25 : 0.238);
      const almond = new THREE.Group();
      almond.scale.set(1.3, pug ? 1.05 : 1.1, 1);
      almond.rotation.z = 0.28 * side;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 16), glossy(0x8c5a24, 0.12));
      almond.add(ball);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.033, 20, 14), glossy(0x0c0806, 0.08));
      pupil.position.set(0, 0, 0.026);
      almond.add(pupil);
      for (const [gx, gy, gr] of [[0.016, 0.018, 0.012], [-0.012, -0.014, 0.006]]) {
        const glint = new THREE.Mesh(new THREE.SphereGeometry(gr, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        glint.position.set(gx * side, gy, 0.05);
        glint.userData.glint = true;
        almond.add(glint);
      }
      eye.add(almond);
      head.add(eye);
      eyes.push(eye);
    }

    // Pricked ears
    const ears: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const ear = new THREE.Group();
      ear.position.set((pug ? 0.28 : 0.17) * side, pug ? 0.14 : 0.19, pug ? 0.075 : -0.04);
      const outer = paint((pug ? blob(0.11, 0.1, 0.06, 12, 8) : frenchie ? new THREE.CapsuleGeometry(0.105, 0.18, 4, 10) : new THREE.ConeGeometry(0.135, 0.27, 12, 2)).scale(1, 1, pug ? 1 : 0.55), 'ear', 0.03).translate(0, pug ? -0.025 : 0.135, 0);
      ear.add(furry(outer, true, 'head'));
      const tuft = paint(new THREE.ConeGeometry(0.08, 0.17, 16, 4).scale(1, 1, 0.35), 'muzzle', 0.035).translate(0, 0.1, 0.045);
      if (!pug) ear.add(furry(tuft, true, 'head'));
      if (pug || dog.avatarConfig.earShape === 'floppy') { ear.scale.set(pug ? 1.1 : 0.8, pug ? 1 : 0.55, 1); ear.rotation.x = pug ? 0.25 : 1.4; }
      head.add(ear);
      ears.push(ear);
    }

    // 3. Legs
    const LEG_TOP = 0.45;
    const makeLeg = (x: number, z: number, hind: boolean) => {
      const side = Math.sign(x);
      const parts = [
        paint(new THREE.CapsuleGeometry(0.095, 0.3, 8, 20), 'leg', (_lx, _ly, lz) => 0.055 + Math.max(0, -lz) * 0.5, (lx, ly, lz) => [lx, ly - 0.2, lz]).translate(0, -0.2, 0),
        paint(blob(0.105, 0.065, 0.135, 24, 14), 'leg', 0.02, (lx, ly, lz) => [lx, ly - 0.4, lz]).translate(0, -0.385, 0.035),
      ];
      if (hind) {
        parts.push(
          paint(blob(0.17, 0.22, 0.22, 28, 20), 'thigh', (_lx, ly, lz) => 0.05 + Math.max(0, -lz) * 0.25 + Math.max(0, -ly) * 0.1, (lx, ly, lz) => [lx * side, ly, lz])
            .translate(0.03 * side, 0.03, 0)
        );
      }
      const leg = furry(mergeGeometries(parts)!, true, 'leg');
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

    // 4. Feathered plume tail
    const tail = new THREE.Group();
    onChassis(tail, 0, 0.8, -0.6);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.22, -0.12),
      new THREE.Vector3(0, 0.42, -0.04),
      new THREE.Vector3(0, 0.5, 0.15),
      new THREE.Vector3(0, 0.44, 0.32),
    ]);
    const TAIL_BALLS = compact ? 5 : 7;
    const tailParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < TAIL_BALLS; i++) {
      const t = i / (TAIL_BALLS - 1);
      const p = curve.getPoint(t);
      const r = 0.07 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      tailParts.push(
        paint(blob(r, r, r, 22, 16), 'tail', 0.16 + t * 0.06, (lx, ly) => [lx, ly, t]).translate(p.x, p.y, p.z)
      );
    }
    tail.add(furry(mergeGeometries(tailParts)!, true, 'tail'));
    if (frenchie) tail.scale.setScalar(0.22);
    else if (pug) tail.scale.setScalar(0.45);

    // A few tapered manga marks, attached to the animated body and head.
    const ink = new THREE.LineBasicMaterial({ color: 0x302923 });
    const stroke = (parent: THREE.Object3D, points: number[][]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p as [number, number, number])));
      parent.add(new THREE.Line(geometry, ink));
    };
    if (bangkaew) for (const side of [-1, 1]) {
      stroke(head, [[side * 0.22, -0.03, 0.21], [side * 0.32, -0.1, 0.17], [side * 0.27, -0.11, 0.21]]);
      stroke(head, [[side * 0.23, -0.12, 0.18], [side * 0.31, -0.19, 0.12]]);
      stroke(body, [[side * 0.3, 0.88, 0.5], [side * 0.38, 0.73, 0.47], [side * 0.32, 0.77, 0.52]]);
    }
    if (pug) {
      stroke(head, [[-0.22, 0.12, 0.226], [-0.13, 0.18, 0.245], [-0.04, 0.12, 0.271]]);
      stroke(head, [[0.22, 0.12, 0.226], [0.13, 0.18, 0.245], [0.04, 0.12, 0.271]]);
      stroke(head, [[-0.24, 0.19, 0.18], [-0.12, 0.25, 0.17], [0, 0.21, 0.215], [0.12, 0.25, 0.17], [0.24, 0.19, 0.18]]);
      stroke(head, [[0, 0.21, 0.218], [-0.025, 0.13, 0.272], [0, 0.08, 0.285]]);
    }
    if (compact && !pug) for (const side of [-1, 1]) {
      stroke(head, [[side * 0.04, 0.14, 0.268], [side * 0.12, 0.17, 0.255], [side * 0.19, 0.12, 0.24]]);
    }
    // Mali is deliberately broad and low; short-coated companions have short legs.
    dogRoot.scale.set(mali ? 1.13 : 1, mali ? 0.83 : compact ? 0.74 : 1, mali ? 1.06 : 1);


    const heartsGroup = new THREE.Group();
    scene.add(heartsGroup);
    const sparksGroup = new THREE.Group();
    scene.add(sparksGroup);

    dogParts.current = {
      root: dogRoot,
      head,
      jaw,
      heartsGroup,
      sparksGroup,
      bowlGroup,
      bolsterGroup,
      poopGroup,
      ballItem: null,
    };

    // ==========================================
    // ORBIT, AND PETTING BY HAND & POOP CLICKING
    // ==========================================
    type Spot = 'head' | 'chin' | 'chest' | 'back' | 'other' | 'poop';
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitLocal = new THREE.Vector3();
    const hitWorld = new THREE.Vector3();

    const spotAt = (clientX: number, clientY: number): { spot: Spot | null; point: THREE.Vector3 } => {
      const r = domElem.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);

      // Check poops first
      const currentPoops = petStateRef.current.poopCount ?? 0;
      if (currentPoops > 0) {
        const visiblePoopObjects: THREE.Object3D[] = [];
        poopMeshes.slice(0, currentPoops).forEach((grp) => grp.traverse((obj) => obj instanceof THREE.Mesh && visiblePoopObjects.push(obj)));
        const poopHit = raycaster.intersectObjects(visiblePoopObjects, true)[0];
        if (poopHit) {
          return { spot: 'poop', point: poopHit.point };
        }
      }

      const hit = raycaster.intersectObjects(skins, false)[0];
      if (!hit) return { spot: null, point: hitWorld };
      hitWorld.copy(hit.point);
      const region = hit.object.userData.region as string;
      if (region === 'head') {
        head.worldToLocal(hitLocal.copy(hit.point));
        return { spot: hitLocal.y < -0.08 && hitLocal.z > 0.05 ? 'chin' : 'head', point: hitWorld };
      }
      if (region === 'body') {
        chassis.worldToLocal(hitLocal.copy(hit.point));
        return { spot: hitLocal.z + HIP.z > 0.15 ? 'chest' : 'back', point: hitWorld };
      }
      return { spot: 'other', point: hitWorld };
    };

    const petting = { spot: null as Spot | null, until: 0, strokeTime: 0, lastReport: 0, melt: 0 };
    const reportPet = (point?: THREE.Vector3) => {
      const now = performance.now();
      if (now - petting.lastReport < 2500) return;
      petting.lastReport = now;
      sound.happyYip();
      spawnHeart();
      if (point) spawnTouchSpark(point);
      onPetRef.current?.();
    };

    let mode: 'none' | 'orbit' | 'stroke' = 'none';
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let targetYaw = 0.45;
    let targetTilt = 0;
    const domElem = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      const { spot, point } = spotAt(e.clientX, e.clientY);
      if (spot === 'poop') {
        sound.sweepClean();
        spawnTouchSpark(point);
        onCleanRef.current?.();
        mode = 'none';
        return;
      }
      mode = spot ? 'stroke' : 'orbit';
      if (spot) {
        domElem.setPointerCapture(e.pointerId);
        petting.spot = spot;
        petting.until = performance.now() + 900;
        spawnTouchSpark(point);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (mode === 'orbit') {
        targetYaw += (e.clientX - lastX) * 0.008;
        targetTilt = Math.max(-0.15, Math.min(0.3, targetTilt + (e.clientY - lastY) * 0.004));
      } else if (mode === 'stroke') {
        const { spot, point } = spotAt(e.clientX, e.clientY);
        if (spot && spot !== 'poop') {
          const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
          petting.spot = spot;
          petting.until = performance.now() + 900;
          petting.strokeTime += Math.min(moved, 40) / 200;
          if (moved > 8) spawnTouchSpark(point);
          if (petting.strokeTime > 1) reportPet(point);
        }
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (mode === 'stroke' && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
        const { spot, point } = spotAt(e.clientX, e.clientY);
        if (spot && spot !== 'poop') {
          interactionState.current = { type: 'pet', timer: 1 };
          reportPet(point);
        }
      }
      mode = 'none';
    };

    domElem.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // ==========================================
    // THE LIVING LOOP
    // ==========================================
    const clock = new THREE.Clock();
    let lastFrame = 0;
    const cur = { ...POSES.stand };
    let nextBlink = 2 + Math.random() * 3;
    let blink = 0;
    const camLocal = new THREE.Vector3();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const frameNow = performance.now();
      if (document.hidden || frameNow - lastFrame < (reducedMotion ? 100 : 32)) return;
      lastFrame = frameNow;
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
      const isSick = ps.sick ?? false;
      const act = interactionState.current;
      if (act.timer > 0) act.timer -= dt;
      const acting = act.timer > 0 ? act.type : 'idle';

      // Sickness Aura
      const targetSickAura = isSick && !asleep ? 1 : 0.001;
      sickAura.scale.lerp(new THREE.Vector3(targetSickAura, targetSickAura, targetSickAura), 0.15);
      sickAura.visible = sickAura.scale.x > 0.05;
      if (sickAura.visible) {
        sickAura.rotation.y = t * 1.5;
        sickAura.position.y = 1.85 + Math.sin(t * 3) * 0.04;
      }

      // Bolster Bed Cushion under chin when asleep
      const targetBolsterScale = asleep ? 1 : 0.001;
      bolsterGroup.scale.lerp(new THREE.Vector3(targetBolsterScale, targetBolsterScale, targetBolsterScale), 0.12);
      bolsterGroup.visible = bolsterGroup.scale.x > 0.05;

      // 3D Food Bowl Feasting
      const isFeeding = acting === 'feed';
      const targetBowlScale = isFeeding ? 1 : 0.001;
      bowlGroup.scale.lerp(new THREE.Vector3(targetBowlScale, targetBowlScale, targetBowlScale), 0.15);
      bowlGroup.visible = bowlGroup.scale.x > 0.05;
      if (isFeeding) {
        kibbleMeshes.forEach((km, idx) => {
          if (act.timer < 1.9 - idx * 0.12) {
            km.scale.multiplyScalar(0.88);
          }
        });
      } else {
        kibbleMeshes.forEach((km) => km.scale.set(1, 1, 1));
      }

      // 3D Poop Waste
      const currentPoops = ps.poopCount ?? 0;
      poopMeshes.forEach((pGrp, idx) => {
        const shouldShow = idx < currentPoops;
        const targetScale = shouldShow ? 1 : 0.001;
        pGrp.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        pGrp.visible = pGrp.scale.x > 0.05;
        if (pGrp.visible) {
          const fly = pGrp.userData.fly as THREE.Mesh;
          const flyAngle = t * (4 + idx) + idx * 2;
          fly.position.set(Math.cos(flyAngle) * 0.08, 0.12 + Math.sin(t * 12) * 0.02, Math.sin(flyAngle) * 0.08);
        }
      });

      // Ease toward the target pose
      const now = performance.now();
      const beingPetted = petting.spot !== null && now < petting.until;
      if (!beingPetted) petting.spot = null;
      if (petting.strokeTime > 5 && petting.melt === 0) petting.melt = now + 4000;
      if (petting.melt && now > petting.melt) {
        petting.melt = 0;
        petting.strokeTime = 0;
      }
      if (!beingPetted && petting.strokeTime > 0 && !petting.melt) petting.strokeTime = Math.max(0, petting.strokeTime - dt * 0.5);
      const melting = petting.melt > 0 && !asleep;
      const target = POSES[asleep ? 'sleep' : isSick ? 'down' : melting ? 'down' : poseRef.current];
      const ease = 1 - Math.exp(-dt * 6);
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) cur[k] += (target[k] - cur[k]) * ease;

      dogRoot.rotation.y += (targetYaw - dogRoot.rotation.y) * 0.1;
      dogRoot.rotation.x += (targetTilt - dogRoot.rotation.x) * 0.1;

      // Sickness tremor / shivering
      let shiverX = 0;
      let shiverRot = 0;
      if (isSick && !asleep) {
        shiverX = Math.sin(t * 36) * 0.012;
        shiverRot = Math.sin(t * 42) * 0.008;
      }

      // Breathing: slow asleep, strained when sick
      const breath = (reducedMotion ? 0 : 1) * Math.sin(t * (asleep ? 1.0 : isSick ? 3.5 : 2.6 + arousal * 2)) * (asleep ? 0.035 : 0.014 + energy * 0.012);
      breathing.scale.set(1 + breath, 1 + breath * 0.8, 1);

      let bounce = 0;
      let walkX = 0;
      let stride = 0;
      if (!reducedMotion && (acting === 'pet' || acting === 'groom')) bounce = Math.abs(Math.sin(t * 9)) * 0.05;
      if (acting === 'play') bounce = Math.abs(Math.sin(t * 12)) * 0.1;
      if (acting === 'walk' && !asleep) {
        stride = Math.sin(t * 8);
        bounce = Math.abs(stride) * 0.04;
        walkX = Math.sin(t * 1.8) * 0.35;
      }

      // Mini-Game Leaping
      if (gameLeap.current.dir !== null) {
        gameLeap.current.progress = Math.min(1, gameLeap.current.progress + dt * 2.2);
        const p = gameLeap.current.progress;
        const sideMult = gameLeap.current.dir === 'left' ? -1 : 1;
        walkX = Math.sin(p * Math.PI) * 0.65 * sideMult;
        bounce = Math.sin(p * Math.PI) * 0.32;
      }

      dogRoot.position.set(walkX + shiverX, cur.rootY + bounce, 0);
      dogRoot.rotation.z = shiverRot;
      chassis.rotation.x = cur.pitch;
      frontL.rotation.x = cur.front + stride * 0.5;
      frontR.rotation.x = cur.frontR - stride * 0.5;
      backL.rotation.x = cur.back - stride * 0.4;
      backR.rotation.x = cur.back + stride * 0.4;
      if (poseRef.current === 'paw' && !asleep) frontR.rotation.x += Math.sin(t * 6) * 0.12;

      // The head: follows you, rests on bolster cushion asleep
      camLocal.copy(camera.position);
      dogRoot.worldToLocal(camLocal);
      const gaze = asleep ? 0 : Math.max(-0.6, Math.min(0.6, Math.atan2(camLocal.x, camLocal.z - 0.6)));
      head.position.set(HEAD_REST.x, HEAD_REST.y + cur.headY + (friendly * 0.03 - tired * 0.03), HEAD_REST.z);
      head.rotation.y += (gaze + Math.sin(t * 0.7) * 0.06 - head.rotation.y) * 0.08;

      const spot = beingPetted ? petting.spot : null;
      head.rotation.x =
        cur.headPitch - cur.pitch * 0.9 +
        (isFeeding ? 0.48 : 0) +
        (spot === 'chin' ? -0.32 : 0);
      head.rotation.z =
        acting === 'communicate'
          ? 0.2
          : spot === 'chest' || melting
            ? 0.18
            : Math.sin(t * 1.3) * 0.04;

      // Articulated Jaw movement (Barking & Chewing)
      if (isFeeding) {
        jaw.rotation.x = Math.abs(Math.sin(t * 14)) * 0.22;
      } else if (acting === 'walk' || acting === 'play' || gameLeap.current.dir !== null) {
        jaw.rotation.x = Math.abs(Math.sin(t * 16)) * 0.26;
      } else {
        jaw.rotation.x = 0;
      }

      // Ears: flatten when unsure, droop when sick, relax under petting
      const flat = asleep ? 0.7 : isSick ? 0.95 : spot === 'head' ? 0.75 : (1 - trust) * 0.45 + tired * 0.2;
      ears.forEach((ear, i) => {
        const s = i === 0 ? 1 : -1;
        ear.rotation.x = (pug ? 0.25 : dog.avatarConfig.earShape === 'floppy' ? 1.4 : 0) - flat * 0.8;
        ear.rotation.z = -s * (0.18 + flat * 0.5) + Math.sin(t * (3.1 + i * 0.4)) * 0.04 * alert;
      });

      // Eyes & Blinking
      nextBlink -= dt;
      if (nextBlink <= 0) {
        blink = 0.14;
        nextBlink = 2.5 + Math.random() * 4;
      }
      blink = Math.max(0, blink - dt);
      const lid = asleep ? 0.08 : isSick ? 0.22 : blink > 0 ? 0.12 : melting ? 0.1 : spot ? 0.35 : acting === 'pet' ? 0.45 : 1;
      eyes.forEach((e) => {
        e.scale.y += (lid - e.scale.y) * 0.4;
        e.traverse((c) => c.userData.glint && (c.visible = e.scale.y > 0.3 && !isSick));
      });

      tongue.visible = !asleep && !isSick;
      mouth.visible = !asleep;
      tongue.position.y = -0.075 + Math.sin(t * 2.8) * 0.006 * (1 + arousal);

      // Tail Wagging
      let wagF = Math.max(1, 3 + friendly * 7 + alert * 3 - tired * 3);
      let wagA = Math.max(0.05, 0.18 + friendly * 0.28 + alert * 0.1 - tired * 0.15);
      if (acting === 'pet' || acting === 'feed' || spot === 'back' || spot === 'chest') {
        wagF = 13;
        wagA = 0.5;
      } else if (acting === 'play' || gameLeap.current.dir !== null) {
        wagF = 20;
        wagA = 0.65;
      }
      if (asleep || isSick) {
        wagA = 0.02;
        wagF = 1;
      }
      tail.rotation.y = reducedMotion ? 0 : Math.sin(t * wagF) * wagA;
      tail.rotation.x = asleep ? 0.9 : 0;

      // Ball item physics
      const parts = dogParts.current;
      if (parts?.ballItem) {
        const ball = parts.ballItem;
        ball.userData.vy -= dt * 6;
        ball.position.x += ball.userData.vx * dt;
        ball.position.y += ball.userData.vy * dt;
        ball.position.z += (ball.userData.vz || 0) * dt;
        if (ball.position.y < 0.12) {
          ball.position.y = 0.12;
          ball.userData.vy = Math.abs(ball.userData.vy) * 0.7;
        }
        if (acting !== 'play' && gameLeap.current.dir === null) {
          dogRoot.remove(ball);
          ball.geometry.dispose();
          (ball.material as THREE.Material).dispose();
          parts.ballItem = null;
        }
      }

      heartsGroup.children.slice().forEach((h) => {
        h.position.y += h.userData.vy * dt;
        h.userData.life -= dt * 0.9;
        h.scale.setScalar(Math.max(0.01, h.userData.life));
        if (h.userData.life <= 0) { heartsGroup.remove(h); const m = h as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      });

      sparksGroup.children.slice().forEach((s) => {
        s.position.x += s.userData.vx * dt;
        s.position.y += s.userData.vy * dt;
        s.position.z += s.userData.vz * dt;
        s.userData.life -= dt * 1.5;
        s.scale.setScalar(Math.max(0.01, s.userData.life));
        if (s.userData.life <= 0) { sparksGroup.remove(s); const m = s as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      });

      renderer.render(scene, camera);
      // Rendered evidence for the performance gate; no personal data.
      domElem.dataset.triangles = String(renderer.info.render.triangles);
      domElem.dataset.drawCalls = String(renderer.info.render.calls);
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
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => m.dispose());
        }
      });
      ink.dispose();
      skinMat.dispose();

      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog.id, JSON.stringify(dog.avatarConfig)]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive Tamagotchi Agility Catch Mini-Game HUD */}
      {miniGame.active && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between catch-hud bg-zinc-950 border-hairline px-2 py-1.5 text-[11px] z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="label text-accent font-semibold whitespace-nowrap">Catch · ball {miniGame.target === 'left' ? '◀ left' : 'right ▶'}</span>
            <span className="data text-zinc-300 whitespace-nowrap">
              Round {miniGame.round}/5 · Score {miniGame.score}
            </span>
            {miniGame.lastResult && (
              <span
                className={`label truncate ${
                  miniGame.lastResult === 'hit' ? 'text-accent' : 'text-zinc-500'
                }`}
              >
                {miniGame.lastResult === 'hit' ? '✓ Caught!' : 'Missed!'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={miniGame.leaping !== null}
              onClick={() => handleMiniGameChoice('left')}
              className="btn btn-quiet border-hairline text-[11px] px-2 py-0.5"
            >
              ◀ Left
            </button>
            <button
              type="button"
              disabled={miniGame.leaping !== null}
              onClick={() => handleMiniGameChoice('right')}
              className="btn btn-quiet border-hairline text-[11px] px-2 py-0.5"
            >
              Right ▶
            </button>
            <button
              type="button"
              onClick={closeMiniGame}
              className="btn btn-quiet text-[11px] px-1.5 py-0.5 text-zinc-400"
              title="Close mini-game"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      {!webglError && (
        <p className="absolute bottom-2 right-2 text-[11px] text-zinc-400 pointer-events-none">
          Stroke to pet · drag to turn{petState.poopCount > 0 ? ' · tap mess to clean' : ''}
        </p>
      )}
    </div>
  );
};
