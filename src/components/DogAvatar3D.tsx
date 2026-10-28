import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { sound } from '../utils/proceduralAudio';

interface DogAvatar3DProps {
  dog: DogProfile;
  petState: PetState;
  interactionTrigger: 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'communicate' | null;
  onInteractionEnd?: () => void;
}

export const DogAvatar3D: React.FC<DogAvatar3DProps> = ({
  dog,
  petState,
  interactionTrigger,
  onInteractionEnd,
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

  // References to animated dog parts
  const dogParts = useRef<{
    root: THREE.Group;
    head: THREE.Group;
    tail: THREE.Group;
    leftEar: THREE.Group;
    rightEar: THREE.Group;
    tongue: THREE.Mesh;
    frontLeftLeg: THREE.Group;
    frontRightLeg: THREE.Group;
    backLeftLeg: THREE.Group;
    backRightLeg: THREE.Group;
    heartsGroup: THREE.Group;
    foodItem: THREE.Group | null;
    ballItem: THREE.Mesh | null;
  } | null>(null);

  const interactionState = useRef<{
    type: 'idle' | 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'communicate';
    timer: number;
    intensity: number;
  }>({
    type: 'idle',
    timer: 0,
    intensity: 1,
  });

  useEffect(() => {
    if (!interactionTrigger) return;
    interactionState.current = {
      type: interactionTrigger,
      timer: 120, // ~2 seconds at 60fps
      intensity: 1,
    };

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
    const heartGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(
      (Math.random() - 0.5) * 0.6,
      1.2,
      (Math.random() - 0.5) * 0.6
    );
    (heart as any).vy = 0.02 + Math.random() * 0.02;
    (heart as any).life = 1.0;
    heartsGroup.add(heart);
  };

  const spawnFood = () => {
    if (!dogParts.current) return;
    // Create cute bone geometry
    const group = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);

    const tipGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const t1 = new THREE.Mesh(tipGeo, shaftMat);
    t1.position.set(-0.16, 0.05, 0);
    const t2 = new THREE.Mesh(tipGeo, shaftMat);
    t2.position.set(-0.16, -0.05, 0);
    const t3 = new THREE.Mesh(tipGeo, shaftMat);
    t3.position.set(0.16, 0.05, 0);
    const t4 = new THREE.Mesh(tipGeo, shaftMat);
    t4.position.set(0.16, -0.05, 0);
    group.add(t1, t2, t3, t4);

    group.position.set(0, 1.8, 1.0);
    group.scale.set(1.2, 1.2, 1.2);
    dogParts.current.root.add(group);
    dogParts.current.foodItem = group;
  };

  const spawnBall = () => {
    if (!dogParts.current) return;
    const ballGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xccff00, // vibrant tennis yellow
      roughness: 0.8,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(1.2, 1.5, 1.2);
    (ball as any).vy = -0.04;
    (ball as any).vx = -0.02;
    dogParts.current.root.add(ball);
    dogParts.current.ballItem = ball;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 390;
    const height = container.clientHeight || 320;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e); // Sleek dark console tone

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // THE FRAMING IS A FUNCTION OF THE BOX, NOT A CONSTANT.
    //
    // The stage is a tall column on a wide screen and a wide rectangle on a
    // phone, and a fixed camera distance crops the dog in one and strands it
    // in the other. So the distance is solved from the container's aspect:
    // far enough back that the whole animal — nose to tail, paw to ear tip —
    // fits in BOTH axes, with a little air around it.
    const DOG_HEIGHT = 1.85; // ground to ear tip
    const DOG_WIDTH = 2.15; // nose to the tip of the tail
    const fitCamera = (w: number, h: number) => {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (w / h));
      const distV = DOG_HEIGHT / 2 / Math.tan(vFov / 2);
      const distH = DOG_WIDTH / 2 / Math.tan(hFov / 2);
      const dist = Math.max(distV, distH) * 1.08;
      camera.position.set(0, 0.72 + dist * 0.16, dist);
      camera.lookAt(0, 0.78, 0);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fitCamera(width, height);

    // Renderer
    //
    // A browser with no WebGL — a blocklisted GPU, a hardened profile, a
    // machine with no graphics driver — used to throw here, and the stage
    // stayed black. The failure is caught and stated instead.
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights.
    //
    // The first cut used a hot ambient (1.1) plus a hot key (2.0) plus an
    // amber rim (1.8). The result was a bleached white creature on a brown
    // disc: the ambient washed out the sable, and the amber rim — which is
    // the UI's accent — lit the whole podium toffee.
    //
    // The accent belongs to the interface, not to the fur. The rim is now a
    // dim neutral, and the key does the modelling.
    const ambientLight = new THREE.AmbientLight(0xd8dbe4, 0.42);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff4e6, 2.4);
    dirLight.position.set(4, 6, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // A cool fill from behind separates the sable saddle from the ground.
    const rimLight = new THREE.DirectionalLight(0x9fb4d6, 1.1);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Floor Platform (Minimalist studio podium with hairlines)
    const podiumGeo = new THREE.CylinderGeometry(1.9, 2.0, 0.1, 32);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
      metalness: 0.1,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = -0.05;
    podium.receiveShadow = true;
    scene.add(podium);

    const ringGeo = new THREE.RingGeometry(1.88, 1.9, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      opacity: 0.4,
      transparent: true,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    // ==========================================
    // BUILD BANGKAEW / EXPO PROCEDURAL 3D AVATAR
    // ==========================================
    const dogRoot = new THREE.Group();
    scene.add(dogRoot);

    // THE COAT.
    //
    // Taken from Expo's own photographs, not from a breed book: a coarse
    // WOLF-GREY AGOUTI coat with black-tipped guard hairs (salt-and-pepper),
    // a soft CHARCOAL mask across the muzzle and around both eyes, and a huge
    // CREAM-WHITE ruff, chest, belly and legs.
    //
    // The previous build had this exactly wrong — a chocolate-brown body
    // with a white head — and the record's own colour fields were wrong too,
    // which is why the dog read as a paper craft rather than as this animal.
    const overlay = new THREE.Color(dog.avatarConfig.maskColor || '#3a3630');
    const cream = new THREE.Color(dog.avatarConfig.secondaryColor || '#e6ddcc');
    const coatBase = new THREE.Color(dog.avatarConfig.baseColor || '#6f6a5f');

    // The agouti body: the recorded base, pulled slightly toward the cream
    // so it reads as a soft winter coat rather than a flat grey.
    const agouti = coatBase.clone().lerp(cream, 0.18);
    // The lighter grey on the flanks and the upper legs.
    const agoutiLight = coatBase.clone().lerp(cream, 0.42);
    // The shadow inside the charcoal overlay, so the mask is not a flat hole.
    const overlayDeep = overlay.clone().multiplyScalar(0.72);

    // Materials
    const agoutiMat = new THREE.MeshStandardMaterial({
      color: agouti,
      roughness: 0.9,
      metalness: 0.02,
    });
    const whiteFurMat = new THREE.MeshStandardMaterial({
      color: agoutiLight,
      roughness: 0.88,
      metalness: 0.02,
    });
    const creamFurMat = new THREE.MeshStandardMaterial({
      color: cream,
      roughness: 0.86,
      metalness: 0.02,
    });
    // The charcoal overlay: mask, muzzle, saddle, ear tips.
    const maskMat = new THREE.MeshStandardMaterial({
      color: overlay,
      roughness: 0.92,
      metalness: 0.02,
    });
    const maskDeepMat = new THREE.MeshStandardMaterial({
      color: overlayDeep,
      roughness: 0.94,
      metalness: 0.02,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x0d0c0b,
      roughness: 0.28,
    });
    // Expo's eyes are amber-brown.
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x8a5a1c,
      roughness: 0.16,
      metalness: 0.1,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x0b0908,
      roughness: 0.1,
    });
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xe4636f,
      roughness: 0.4,
    });

    // 1. THE BODY.
    //
    // A dog's torso is HORIZONTAL and tapers: deep chest in front, a tucked
    // waist, and a croup that rises to the tail. The previous build was a
    // vertical cylinder with a box on top, which is why it read as a barrel
    // with a brick strapped to it.
    //
    // Then the second build stacked four ellipsoids on top of each other,
    // which read as a snowman. The body is a SURFACE OF REVOLUTION now — one
    // lathe, turned along the spine, with a profile that carries the whole
    // silhouette: the depth of the chest, the tuck of the waist, the rise of
    // the croup. One continuous skin, no seams to read as lumps.
    const torso = new THREE.Group();
    torso.position.y = 0.66;

    // The profile, in radius-and-along-the-spine. Revolved, this IS the dog.
    const BODY_PROFILE: [number, number][] = [
      [0.03, -0.64],
      [0.17, -0.60],
      [0.29, -0.50],
      [0.32, -0.32],
      [0.29, -0.14],
      [0.31, 0.02],
      [0.37, 0.18],
      [0.35, 0.30],
      [0.23, 0.41],
      [0.14, 0.50],
    ];
    const bodyGeo = new THREE.LatheGeometry(
      BODY_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      28
    );
    const bodyMesh = new THREE.Mesh(bodyGeo, agoutiMat);
    // The lathe's axis is Y; the spine is Z.
    bodyMesh.rotation.x = Math.PI / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    torso.add(bodyMesh);

    // THE SADDLE — the charcoal overlay over the back and shoulders.
    //
    // A second, smaller lathe laid over the first, so it breaks the surface
    // only along the top: a dark band down the spine, with the agouti
    // showing at the flanks and the chest.
    const SADDLE_PROFILE: [number, number][] = [
      [0.03, -0.58],
      [0.16, -0.54],
      [0.25, -0.44],
      [0.27, -0.26],
      [0.245, -0.10],
      [0.255, 0.02],
      [0.29, 0.14],
      [0.26, 0.24],
      [0.16, 0.32],
    ];
    const saddleGeo = new THREE.LatheGeometry(
      SADDLE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      24
    );
    const saddle = new THREE.Mesh(saddleGeo, maskMat);
    saddle.rotation.x = Math.PI / 2;
    // Lifted so the dark band sits ON the back rather than inside the body.
    saddle.position.y = 0.10;
    saddle.castShadow = true;
    torso.add(saddle);

    // THE WHITE CHEST — the underside and the front of the chest, which on a
    // Bang Kaew carries the white that runs up into the throat.
    const chestWhite = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), creamFurMat);
    chestWhite.scale.set(0.32, 0.30, 0.28);
    chestWhite.position.set(0, -0.20, 0.30);
    torso.add(chestWhite);

    // BANGKAEW SIGNATURE: THE LION MANE (แผงคอสิงโต).
    //
    // The breed is named for it, and on Expo it is enormous: a cream-white
    // mane standing out around the neck, framing the dark face and falling
    // over the chest.
    //
    // Three attempts failed before this one. A cylinder collar with two cones
    // read as FINS. A ring of sharp downward cones read as a PICKET FENCE. A
    // ring of round tufts read as a NECKLACE OF PEARLS. What a mane is, is a
    // continuous MASS with a ragged edge — so it is a flared shell (which
    // gives the unbroken volume) with tufts breaking its lower rim (which
    // gives the ragged edge). Volume first, detail second.
    const ruffGroup = new THREE.Group();
    ruffGroup.position.set(0, 0.30, 0.40);

    // The shell: an open cone, wide at the bottom, narrow at the throat.
    const ruffShell = new THREE.Mesh(
      new THREE.ConeGeometry(0.255, 0.62, 20, 1, true),
      creamFurMat
    );
    ruffShell.material.side = THREE.DoubleSide;
    ruffShell.position.y = -0.22;
    ruffShell.castShadow = true;
    ruffGroup.add(ruffShell);

    // The ragged edge: tufts around the lower rim, each leaning out and down.
    const TUFT_COUNT = 11;
    for (let i = 0; i < TUFT_COUNT; i += 1) {
      const angle = (i / TUFT_COUNT) * Math.PI * 2 + (i % 2) * 0.14;
      // Irregular on purpose: an even ring of identical spikes is a
      // picket fence, and a mane is never even.
      const len = 0.26 + ((i * 7) % 5) * 0.036;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.085, len, 5),
        creamFurMat
      );
      tuft.position.set(
        Math.sin(angle) * 0.215,
        -0.46 - len * 0.2,
        Math.cos(angle) * 0.215
      );
      tuft.rotation.x = Math.PI;
      // Leaning only a little out, so the mane falls DOWN the chest rather
      // than spreading sideways like wings.
      tuft.rotation.z = -Math.sin(angle) * 0.26;
      tuft.rotation.y = Math.cos(angle) * 0.22;
      ruffGroup.add(tuft);

      // The charcoal guard hairs at the very edge of the mane.
      if (i % 3 === 1) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.10, 5), maskMat);
        tip.position.set(
          Math.sin(angle) * 0.245,
          -0.54 - len * 0.2,
          Math.cos(angle) * 0.245
        );
        tip.rotation.x = Math.PI;
        tip.rotation.z = -Math.sin(angle) * 0.26;
        tip.rotation.y = Math.cos(angle) * 0.22;
        ruffGroup.add(tip);
      }
    }

    torso.add(ruffGroup);

    // THE NECK — thick, carried forward, running from the shoulders to the
    // skull. A Bang Kaew holds its head high.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.34, 16), agoutiMat);
    neck.position.set(0, 0.30, 0.46);
    neck.rotation.x = -0.40;
    neck.castShadow = true;
    torso.add(neck);

    dogRoot.add(torso);

    // 2. THE HEAD.
    //
    // Expo's actual head, from the photographs: a broad, slightly domed
    // skull; a soft CHARCOAL mask across the muzzle and around both eyes;
    // a WHITE blaze running up the muzzle to the forehead; white cheeks; big
    // erect triangular ears with a pale pink inside; and amber-brown eyes.
    //
    // The mask is the muzzle itself plus a brow patch, not a second sphere
    // laid over the skull — that is what turned the head into a potato.
    const head = new THREE.Group();
    head.position.set(0, 0.46, 0.52);

    // The cranium: one broad, slightly flattened dome.
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), agoutiMat);
    skull.scale.set(0.122, 0.108, 0.130);
    skull.position.set(0, 0.028, -0.012);
    skull.castShadow = true;
    head.add(skull);

    // THE MUZZLE — a lathe along the face, tapering from the stop to the nose.
    // A Bang Kaew has a blunt, strong muzzle, not a fox's snout.
    const MUZZLE_PROFILE: [number, number][] = [
      [0.085, 0.00],
      [0.080, 0.05],
      [0.072, 0.10],
      [0.062, 0.15],
      [0.050, 0.19],
      [0.034, 0.21],
    ];
    const snoutGeo = new THREE.LatheGeometry(
      MUZZLE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      16
    );
    const snout = new THREE.Mesh(snoutGeo, maskMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.058, 0.075);
    snout.castShadow = true;
    head.add(snout);

    // The charcoal mask over the eyes: a flattened patch across the brow,
    // which is where the wolf-sable sits on this breed.
    const maskPatch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), maskMat);
    maskPatch.scale.set(0.112, 0.072, 0.098);
    maskPatch.position.set(0, 0.012, 0.048);
    head.add(maskPatch);

    // The cheeks: white, and small.
    const cheekGeo = new THREE.SphereGeometry(0.5, 14, 10);
    const cheekL = new THREE.Mesh(cheekGeo, creamFurMat);
    cheekL.scale.set(0.078, 0.066, 0.072);
    cheekL.position.set(-0.082, -0.072, 0.010);
    const cheekR = new THREE.Mesh(cheekGeo, creamFurMat);
    cheekR.scale.set(0.078, 0.066, 0.072);
    cheekR.position.set(0.082, -0.072, 0.010);
    head.add(cheekL, cheekR);

    // The WHITE BLAZE — running from the stop to the nose, and the single
    // mark that most says "this is my dog".
    const blazeGeo = new THREE.BoxGeometry(0.040, 0.032, 0.205);
    const blaze = new THREE.Mesh(blazeGeo, creamFurMat);
    blaze.position.set(0, -0.012, 0.175);
    head.add(blaze);

    // The black nose, on the blunt end of the muzzle.
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), noseMat);
    nose.scale.set(0.042, 0.034, 0.032);
    nose.position.set(0, -0.050, 0.288);
    head.add(nose);

    // THE EYES.
    //
    // Amber-brown iris, black pupil, a dark lid ring around each. A dog that
    // has only a dark sphere for an eye reads as a toy; an iris is what makes
    // it read as an animal looking at you. They sit ON the skull, not in
    // front of it — the earlier build had them bulging out like headlights.
    const eyeGeo = new THREE.SphereGeometry(0.030, 16, 14);
    const pupilGeo = new THREE.SphereGeometry(0.015, 12, 10);
    const eyelidGeo = new THREE.RingGeometry(0.034, 0.046, 18);
    const eyelidMat = new THREE.MeshBasicMaterial({ color: 0x2a2724 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.076, 0.032, 0.086);
    eyeL.scale.set(1, 0.92, 0.75);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.088, 0.031, 0.103);
    const lidL = new THREE.Mesh(eyelidGeo, eyelidMat);
    lidL.position.set(-0.076, 0.032, 0.088);
    lidL.rotation.x = Math.PI / 2;
    lidL.rotation.z = -0.25;
    head.add(lidL, pupilL, eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.076, 0.032, 0.086);
    eyeR.scale.set(1, 0.92, 0.75);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.088, 0.031, 0.103);
    const lidR = new THREE.Mesh(eyelidGeo, eyelidMat);
    lidR.position.set(0.076, 0.032, 0.088);
    lidR.rotation.x = Math.PI / 2;
    lidR.rotation.z = 0.25;
    head.add(lidR, pupilR, eyeR);

    // The tongue — Expo's relaxed tongue peek.
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.022, 0.085), tongueMat);
    tongue.position.set(0, -0.128, 0.262);
    tongue.rotation.x = 0.3;
    head.add(tongue);

    // THE EARS.
    //
    // Erect triangles with a pale pink inside — large on this dog, and the
    // clearest single signal that this is not a floppy-eared dog.
    const earGeo = new THREE.ConeGeometry(0.072, 0.20, 4);
    const earTipGeo = new THREE.ConeGeometry(0.034, 0.08, 4);
    const earInnerGeo = new THREE.ConeGeometry(0.042, 0.135, 4);
    const earInnerMat = new THREE.MeshStandardMaterial({
      color: 0xc98d86,
      roughness: 0.7,
    });

    const leftEar = new THREE.Group();
    leftEar.position.set(-0.112, 0.118, -0.022);
    const earLMesh = new THREE.Mesh(earGeo, maskMat);
    earLMesh.rotation.z = -0.09;
    earLMesh.rotation.x = 0.12;
    leftEar.add(earLMesh);
    const earLTip = new THREE.Mesh(earTipGeo, maskDeepMat);
    earLTip.position.y = 0.12;
    earLTip.rotation.z = -0.09;
    earLTip.rotation.x = 0.12;
    leftEar.add(earLTip);
    const earLInner = new THREE.Mesh(earInnerGeo, earInnerMat);
    earLInner.position.set(0.026, -0.012, 0.038);
    earLInner.rotation.z = -0.09;
    earLInner.rotation.x = 0.12;
    leftEar.add(earLInner);

    const rightEar = new THREE.Group();
    rightEar.position.set(0.112, 0.118, -0.022);
    const earRMesh = new THREE.Mesh(earGeo, maskMat);
    earRMesh.rotation.z = 0.09;
    earRMesh.rotation.x = 0.12;
    rightEar.add(earRMesh);
    const earRTip = new THREE.Mesh(earTipGeo, maskDeepMat);
    earRTip.position.y = 0.12;
    earRTip.rotation.z = 0.09;
    earRTip.rotation.x = 0.12;
    rightEar.add(earRTip);
    const earRInner = new THREE.Mesh(earInnerGeo, earInnerMat);
    earRInner.position.set(-0.026, -0.012, 0.038);
    earRInner.rotation.z = 0.09;
    earRInner.rotation.x = 0.12;
    rightEar.add(earRInner);

    head.add(leftEar, rightEar);
    dogRoot.add(head);

    // 3. THE PLUMED TAIL.
    //
    // On Expo the tail is a great cream plume, carried UP and OVER the back
    // and curling forward — the spitz silhouette, not a hanging tail. The
    // previous build made it three stiff cylinders that ended in a cone,
    // which read as a bent pipe.
    //
    // So the tail is a curve now: a smooth tube along a spline that rises
    // from the croup and folds forward over the spine, with the cream plume
    // hanging from the end of it.
    const tail = new THREE.Group();
    tail.position.set(0, 0.76, -0.54);

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.20, -0.10),
      new THREE.Vector3(0, 0.33, -0.04),
      new THREE.Vector3(0, 0.34, 0.08),
      new THREE.Vector3(0, 0.24, 0.14),
    ]);
    const tailTube = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 28, 0.072, 10, false),
      agoutiMat
    );
    tailTube.castShadow = true;
    tail.add(tailTube);

    // THE PLUME — the great cream brush at the end of the tail.
    const plume = new THREE.Group();
    plume.position.set(0, 0.24, 0.14);
    plume.rotation.x = 0.45;

    const plumeCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), creamFurMat);
    plumeCore.scale.set(0.115, 0.105, 0.24);
    plume.add(plumeCore);

    // The brush itself: it HANGS, from the end of the curl, down over the
    // rump. A plume that sticks out sideways is a broom.
    const plumeFall = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.44, 10), creamFurMat);
    plumeFall.position.set(0, -0.22, -0.06);
    plumeFall.rotation.x = Math.PI;
    plume.add(plumeFall);

    // A second, shorter fall on the other side of the curve, so the plume has
    // depth instead of being a flat paddle.
    const plumeFall2 = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 8), creamFurMat);
    plumeFall2.position.set(0.02, -0.15, 0.10);
    plumeFall2.rotation.x = Math.PI * 0.85;
    plume.add(plumeFall2);

    tail.add(plume);
    dogRoot.add(tail);

    // 4. LEGS & PAWS.
    //
    // The front legs are cream from the elbow down, with dark TICKING on the
    // upper foreleg — the freckled speckling you can see on the photographs.
    // The rear legs carry more of the agouti.
    const createLeg = (x: number, z: number, isFront: boolean) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.50, z);

      // The mass of the shoulder or the thigh, so the leg grows out of the
      // body instead of being stuck onto it.
      const mass = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), agoutiMat);
      mass.scale.set(0.145, isFront ? 0.27 : 0.31, 0.16);
      mass.position.set(0, 0.02, isFront ? 0 : -0.02);
      mass.castShadow = true;
      legGroup.add(mass);

      // The ticking: dark speckling up the foreleg.
      if (isFront) {
        const tickGeo = new THREE.SphereGeometry(0.010, 5, 4);
        for (let i = 0; i < 4; i += 1) {
          const tick = new THREE.Mesh(tickGeo, maskMat);
          const side = i % 2 === 0 ? 1 : -1;
          tick.position.set(
            side * (0.068 + (i % 3) * 0.010),
            -0.01 - i * 0.058,
            0.045 + (i % 4) * 0.018
          );
          legGroup.add(tick);
        }
      }

      // The leg itself: cream, tapering to the pastern.
      const legGeo = new THREE.CylinderGeometry(0.095, 0.068, 0.52, 10);
      const legMesh = new THREE.Mesh(legGeo, creamFurMat);
      legMesh.position.set(0, -0.25, 0);
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      // The paw.
      const pawGeo = new THREE.SphereGeometry(0.5, 12, 8);
      const pawMesh = new THREE.Mesh(pawGeo, creamFurMat);
      pawMesh.scale.set(0.092, 0.060, 0.12);
      pawMesh.position.set(0, -0.50, 0.02);
      pawMesh.castShadow = true;
      legGroup.add(pawMesh);

      // Four little toes.
      const toeGeo = new THREE.SphereGeometry(0.04, 6, 4);
      const toePositions = [
        [-0.055, 0, 0.06],
        [-0.02, 0, 0.075],
        [0.02, 0, 0.075],
        [0.055, 0, 0.06],
      ];
      toePositions.forEach(([tx, ty, tz]) => {
        const toe = new THREE.Mesh(toeGeo, creamFurMat);
        toe.position.set(tx, -0.52, tz + 0.02);
        legGroup.add(toe);
      });

      dogRoot.add(legGroup);
      return legGroup;
    };

    const frontLeftLeg = createLeg(-0.25, 0.30, true);
    const frontRightLeg = createLeg(0.25, 0.30, true);
    const backLeftLeg = createLeg(-0.25, -0.40, false);
    const backRightLeg = createLeg(0.25, -0.40, false);

    // Hearts group for petting feedback
    const heartsGroup = new THREE.Group();
    scene.add(heartsGroup);

    dogParts.current = {
      root: dogRoot,
      head,
      tail,
      leftEar,
      rightEar,
      tongue,
      frontLeftLeg,
      frontRightLeg,
      backLeftLeg,
      backRightLeg,
      heartsGroup,
      foodItem: null,
      ballItem: null,
    };

    // Mouse / Touch Interaction for orbit & head tracking
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0.35;
    let targetRotationX = 0;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (isDragging) {
        const deltaX = clientX - prevMouseX;
        const deltaY = clientY - prevMouseY;
        targetRotationY += deltaX * 0.008;
        targetRotationX += deltaY * 0.004;
        targetRotationX = Math.max(-0.2, Math.min(0.4, targetRotationX));
        prevMouseX = clientX;
        prevMouseY = clientY;
      }
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    domElem.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    // Click on canvas to pet directly
    const handleClick = () => {
      interactionState.current = {
        type: 'pet',
        timer: 60,
        intensity: 1,
      };
      sound.happyYip();
      spawnHeart();
    };
    domElem.addEventListener('click', handleClick);

    // ==========================================
    // RENDER LOOP & REAL-TIME ANIMATIONS
    // ==========================================
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // ---- Mood from the dog's inner state ---------------------------------
      const trust = petState.trust / 100;        // 0..1 — how much Expo trusts you
      const arousal = petState.arousal / 100;    // 0..1 — how excited he is
      const hunger = 1 - petState.needs.hunger / 100; // 0..1, 1 = very hungry
      const energy = petState.needs.energy / 100; // 0..1

      // Friendly = trusts you and isn't starving. Alert = aroused + trusting.
      const friendly = Math.max(0, trust * 0.7 + (1 - hunger * 0.5) * 0.3);
      const alert = Math.min(1, arousal * 0.6 + trust * 0.4);
      const tired = 1 - energy;

      // ASLEEP.
      //
      // A sleeping dog is not a standing dog with its eyes shut: he is DOWN.
      // The body sinks and folds, the head comes to rest on the paws, the
      // ears go back, the tail wraps round, and the breathing goes slow and
      // deep. This is the state the whole app exists to make you reluctant
      // to interrupt.
      const asleep = petState.sleep?.asleep ?? false;
      const asleepBlend = asleep ? 1 : 0;

      // Smooth camera / podium orbit interpolation
      dogRoot.rotation.y += (targetRotationY - dogRoot.rotation.y) * 0.1;
      dogRoot.rotation.x += (targetRotationX - dogRoot.rotation.x) * 0.1;

      // 1. Idle breathing — faster when excited, slower when tired, and slow
      // and DEEP when asleep.
      const breathRate = asleep ? 0.9 : 2.8 + arousal * 2.0;
      const breathAmp = asleep ? 0.045 : 0.02 + energy * 0.02;
      const breath = Math.sin(elapsed * breathRate) * breathAmp;
      torso.scale.set(1 + breath, 1 + breath * 0.8, 1);

      // 1b. THE CURL. Sinking, folding down, head to the paws, ears back.
      if (asleep) {
        dogRoot.position.y = -0.06;
        dogRoot.rotation.x = -0.10;
        torso.rotation.z = 0.06;
        head.position.y = 0.30;
        head.position.z = 0.30;
        head.rotation.x = 0.72; // nose down, on the paws
        head.rotation.z = 0.10;
        leftEar.rotation.x = 0.62;
        rightEar.rotation.x = 0.62;
        tail.rotation.x = 0.85; // wrapped round the body
        // The eyes are shut.
        eyeL.scale.setScalar(0.12);
        eyeR.scale.setScalar(0.12);
        pupilL.visible = false;
        pupilR.visible = false;
      } else {
        dogRoot.position.y = 0;
        dogRoot.rotation.x = 0;
        torso.rotation.z = 0;
        head.position.y = 0.46;
        head.position.z = 0.52;
        head.rotation.x = 0;
        head.rotation.z = 0;
        leftEar.rotation.x = 0.12;
        rightEar.rotation.x = 0.12;
        tail.rotation.x = 0;
        eyeL.scale.set(1, 0.92, 0.75);
        eyeR.scale.set(1, 0.92, 0.75);
        pupilL.visible = true;
        pupilR.visible = true;
      }
      void asleepBlend;

      // 2. Tail Wagging dynamics — mood-driven when idle, interaction-driven
      // when you're engaging with him.
      let wagFreq = 4.0 + friendly * 8.0 + alert * 4.0 - tired * 3.0;
      let wagAmp = 0.25 + friendly * 0.35 + alert * 0.15 - tired * 0.2;
      wagFreq = Math.max(1.0, wagFreq);
      wagAmp = Math.max(0.05, wagAmp);

      if (interactionState.current.type === 'pet' || interactionState.current.type === 'feed') {
        wagFreq = 14.0;
        wagAmp = 0.55;
      } else if (interactionState.current.type === 'play') {
        wagFreq = 18.0;
        wagAmp = 0.7;
      } else if (interactionState.current.type === 'communicate') {
        wagFreq = trust > 0.6 ? 12.0 : 2.0;
        wagAmp = trust > 0.6 ? 0.5 : 0.1;
      }
      tail.rotation.y = Math.sin(elapsed * wagFreq) * wagAmp;
      tail.rotation.z = Math.cos(elapsed * wagFreq * 0.5) * 0.1;

      // 3. Head & ear listening twitches — ears flatten when nervous or tired.
      const earFlatten = (1 - trust) * 0.35 + tired * 0.15;
      const headLift = friendly * 0.04 - tired * 0.04;
      head.position.y = 1.05 + headLift;
      head.rotation.y = Math.sin(elapsed * 0.8) * 0.08 * (1 - alert * 0.5);
      head.rotation.z = Math.sin(elapsed * 1.4) * 0.04;
      if (interactionState.current.type === 'communicate' && trust < 0.6) {
        head.rotation.z = 0.18; // head tilt: "I don't know that word"
      }
      leftEar.rotation.z = Math.sin(elapsed * 3.5) * 0.06 - earFlatten;
      rightEar.rotation.z = -Math.cos(elapsed * 3.2) * 0.06 + earFlatten;

      // 4. Tongue peek bob — more tongue when relaxed and friendly.
      const tongueOut = friendly * 0.02;
      tongue.position.y = -0.19 + tongueOut + Math.sin(elapsed * 2.8) * 0.01;

      // 5. Interaction actions
      if (interactionState.current.timer > 0) {
        interactionState.current.timer -= 1;
        const phase = interactionState.current.timer / 120;

        if (interactionState.current.type === 'pet') {
          // Playful body bounce
          dogRoot.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.08;
        } else if (interactionState.current.type === 'feed' && dogParts.current?.foodItem) {
          const item = dogParts.current.foodItem;
          if (item.position.y > 0.8) {
            item.position.y -= 0.025;
            item.rotation.y += 0.05;
          } else {
            // Dog eats the bone
            item.scale.multiplyScalar(0.92);
            head.rotation.x = Math.sin(elapsed * 12) * 0.15; // chewing
            if (item.scale.x < 0.1) {
              dogRoot.remove(item);
              dogParts.current.foodItem = null;
            }
          }
        } else if (interactionState.current.type === 'play' && dogParts.current?.ballItem) {
          const ball = dogParts.current.ballItem;
          ball.position.x += (ball as any).vx;
          ball.position.y += (ball as any).vy;
          (ball as any).vy -= 0.002; // gravity

          if (ball.position.y <= 0.16) {
            ball.position.y = 0.16;
            (ball as any).vy = -(ball as any).vy * 0.7; // bounce
            sound.ballBounce();
          }

          // Dog tracks ball with head
          head.lookAt(ball.position.x, ball.position.y + 0.5, ball.position.z);
          dogRoot.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.12;

          if (interactionState.current.timer <= 1) {
            dogRoot.remove(ball);
            dogParts.current.ballItem = null;
          }
        } else if (interactionState.current.type === 'walk') {
          // A walk is a trott: the body rolls, the legs swing, and the dog
          // moves through the frame rather than standing in it. It used to be
          // the one interaction with no animation at all — a sound and
          // nothing else, so the reader was told about a walk they could not
          // see.
          const stride = Math.sin(elapsed * 7);
          dogRoot.position.y = Math.abs(Math.sin(elapsed * 7)) * 0.05;
          dogRoot.rotation.z = stride * 0.045;
          dogRoot.rotation.x = -0.06;
          dogRoot.position.x = Math.sin(elapsed * 1.75) * 0.42;
          frontLeftLeg.rotation.x = stride * 0.55;
          frontRightLeg.rotation.x = -stride * 0.55;
          backLeftLeg.rotation.x = -stride * 0.42;
          backRightLeg.rotation.x = stride * 0.42;
          tail.rotation.x = -0.18;
          if (interactionState.current.timer <= 1) {
            dogRoot.position.x = 0;
            dogRoot.rotation.x = 0;
            dogRoot.rotation.z = 0;
          }
        }
      } else {
        dogRoot.position.y = 0;
      }

      // 6. Update hearts
      heartsGroup.children.forEach((child) => {
        const heart = child as any;
        heart.position.y += heart.vy;
        heart.life -= 0.015;
        heart.scale.setScalar(heart.life);
        if (heart.life <= 0) {
          heartsGroup.remove(heart);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      fitCamera(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    // The window is not the only thing that resizes this scene: the cockpit
    // gives it a region, and the region's size changes when the layout
    // changes. A ResizeObserver watches the box the scene is actually in.
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      domElem.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      domElem.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      domElem.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, [dog]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* When the browser cannot draw, the space the scene would have
          occupied says so. A black rectangle tells the reader nothing. */}
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

      {/* Two captions, and only two. The scene is the content; a "LIVE" badge
          on a scene that is obviously live is noise, and a dot that pulses to
          prove it is decoration pretending to be a signal. What the reader
          actually needs is what they are looking at, and what they can do to
          it. Both are said once, in the reading voice, where the scene does
          not cover them. */}
      {!webglError && (
        <>
          <p className="absolute bottom-2 left-2 max-w-[70%] text-[11px] leading-tight text-zinc-300 pointer-events-none">
            {dog.name}
            <span className="text-zinc-500"> / </span>
            {dog.breed}
          </p>
          <p className="absolute bottom-2 right-2 text-[11px] text-zinc-400 pointer-events-none">
            Drag to orbit, click to pet
          </p>
        </>
      )}
    </div>
  );
};
