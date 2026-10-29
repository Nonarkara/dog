import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MessageSquare, TriangleAlert, Upload, X } from 'lucide-react';
import { DogProfile, MetaverseNeighborDog } from '../types/dog';
import { METAVERSE_NEIGHBORS } from '../data/defaultDogs';
import { sound } from '../utils/proceduralAudio';

/**
 * THE CANINE COMMONS.
 *
 * One region of the cockpit: a 3D park the selected dog shares with its
 * neighbours, the list of who is in it, and the park's comms.
 *
 * THE LAW OF THIS FILE: NOTHING SCROLLS EXCEPT THE CHAT.
 *
 * The whole app is a fixed frame. This panel is a flex column with
 * `min-height: 0`; every child that can grow is allowed to shrink; text is
 * truncated; the only scroll container is the chat log, which is genuinely a
 * history. The 3D scene holds a fixed aspect ratio so the panel's height is
 * decided before the scene arrives, and it can only ever be clipped by the
 * frame that contains it — never pushed taller by it.
 *
 * The scene is a fixed-cost WebGL context: it is disposed — geometry,
 * materials, renderer, animation frame, listeners — when the panel unmounts.
 */

export interface CommonsPanelProps {
  myDog: DogProfile;
}

/* ------------------------------------------------------------------ types */

interface ParkMessage {
  sender: string;
  text: string;
  /** Only real messages carry a clock time. Seeded lines are older than the session. */
  time?: string;
}

/** The shape the importer needs out of a friend's exported dog file. */
interface DogRecord {
  id?: string;
  name: string;
  breed: string;
  metaverseTribe?: string;
  metaverseBio?: string;
  avatarConfig: {
    baseColor: string;
    secondaryColor: string;
    maskColor: string;
    earShape: 'pricked' | 'floppy' | 'semi-pricked';
  };
}

type ImportResult = { ok: true; dog: DogRecord } | { ok: false; error: string };

type VisitorKind = 'you' | 'neighbour' | 'visitor';

interface ParkRow {
  id: string;
  name: string;
  breed: string;
  action: string;
  tribe: string;
  kind: VisitorKind;
}

interface NeighborEntry {
  data: MetaverseNeighborDog;
  group: THREE.Group;
  dir: THREE.Vector3;
  beacon: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
}

interface SceneApi {
  spawnNeighbor: (nbr: MetaverseNeighborDog) => void;
  removeNeighbor: (id: string) => void;
}

/* ------------------------------------------------------------- seed lines */

// The park is local: three lines of scene furniture, and the selected dog
// already in the scene. No clock times — these did not happen just now.
const seedMessages = (dog: DogProfile): ParkMessage[] => [
  {
    sender: 'Somtum (Thai Ridgeback)',
    text: 'Just finished five laps around the agility ramp.',
  },
  {
    sender: 'Waffles (Pembroke Corgi)',
    text: 'Anyone dropping cheese at the water fountain?',
  },
  {
    sender: `${dog.name} (${dog.breed})`,
    text: 'Claimed the quiet spot by the pavilion. Settling in for a watch.',
  },
];

const PARK_ACTIONS: MetaverseNeighborDog['action'][] = [
  'sniffing', 'walking', 'sitting', 'barking', 'running',
];

const randomPosition = (): [number, number, number] => [
  (Math.random() - 0.5) * 40,
  0,
  (Math.random() - 0.5) * 40,
];

/**
 * The old park's conversion, kept: a dog profile becomes a neighbour the park
 * can walk around with. `fallbackId` is used when the imported file carries
 * no id of its own, so two friends' dogs cannot collide on `visitor-undefined`.
 */
const dogProfileToNeighbor = (dog: DogRecord, fallbackId: string): MetaverseNeighborDog => ({
  id: `visitor-${dog.id || fallbackId}`,
  name: dog.name,
  breed: dog.breed,
  tribe: dog.metaverseTribe || 'Visiting Pack',
  ownerName: 'A friend',
  personality: dog.metaverseBio || 'A visiting dog in the park.',
  avatarColors: {
    base: dog.avatarConfig.baseColor,
    secondary: dog.avatarConfig.secondaryColor,
    mask: dog.avatarConfig.maskColor,
  },
  earShape: dog.avatarConfig.earShape === 'semi-pricked' ? 'pricked' : dog.avatarConfig.earShape,
  position: randomPosition(),
  action: PARK_ACTIONS[Math.floor(Math.random() * PARK_ACTIONS.length)],
  speed: 0.01 + Math.random() * 0.03,
});

/* -------------------------------------------------------------- validation */

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const EAR_SHAPES = ['pricked', 'floppy', 'semi-pricked'];

/**
 * A FRIEND'S FILE, READ HONESTLY.
 *
 * The old importer swallowed every failure: a wrong file left the reader
 * looking at a park that did not change, with no way to tell a broken app
 * from a broken file. So every reason a file is refused is named, in a
 * sentence the reader can act on — and nothing is added to the park unless
 * the file is actually a dog.
 */
const validateDogFile = (raw: string): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not JSON — it could not be parsed.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'That file is not a dog record — it is not a JSON object.' };
  }

  const rec = parsed as Record<string, unknown>;

  if (typeof rec.name !== 'string' || !rec.name.trim()) {
    return { ok: false, error: 'That file is not a dog record — it has no `name`.' };
  }
  if (typeof rec.breed !== 'string' || !rec.breed.trim()) {
    return { ok: false, error: 'That file is not a dog record — it has no `breed`.' };
  }

  const avatar = rec.avatarConfig;
  if (typeof avatar !== 'object' || avatar === null || Array.isArray(avatar)) {
    return { ok: false, error: 'That file is not a dog record — it has no `avatarConfig`.' };
  }
  const av = avatar as Record<string, unknown>;

  for (const key of ['baseColor', 'secondaryColor', 'maskColor'] as const) {
    const value = av[key];
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, error: `That file is not a dog record — \`avatarConfig.${key}\` is missing.` };
    }
    if (!HEX_COLOUR.test(value.trim())) {
      return {
        ok: false,
        error: `That file is not a dog record — \`avatarConfig.${key}\` is not a hex colour (#rrggbb).`,
      };
    }
  }

  const earShape = av.earShape;
  if (typeof earShape !== 'string' || !earShape.trim()) {
    return { ok: false, error: 'That file is not a dog record — `avatarConfig.earShape` is missing.' };
  }
  if (!EAR_SHAPES.includes(earShape)) {
    return {
      ok: false,
      error: `That file is not a dog record — \`avatarConfig.earShape\` must be pricked, floppy or semi-pricked (this file says "${earShape}").`,
    };
  }

  return {
    ok: true,
    dog: {
      id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : undefined,
      name: rec.name.trim(),
      breed: rec.breed.trim(),
      metaverseTribe: typeof rec.metaverseTribe === 'string' ? rec.metaverseTribe : undefined,
      metaverseBio: typeof rec.metaverseBio === 'string' ? rec.metaverseBio : undefined,
      avatarConfig: {
        baseColor: (av.baseColor as string).trim(),
        secondaryColor: (av.secondaryColor as string).trim(),
        maskColor: (av.maskColor as string).trim(),
        earShape: earShape as DogRecord['avatarConfig']['earShape'],
      },
    },
  };
};

const clockNow = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* --------------------------------------------------------------- the panel */

export const CommonsPanel: React.FC<CommonsPanelProps> = ({ myDog }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<ParkMessage[]>(() => seedMessages(myDog));
  const [chatInput, setChatInput] = useState('');
  const [visitors, setVisitors] = useState<MetaverseNeighborDog[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mirrors of state the animation loop and the scene builder read directly.
  const selectedIdRef = useRef<string | null>(null);
  const visitorsRef = useRef<MetaverseNeighborDog[]>([]);

  // The scene's handles, so a visitor can be spawned (or removed) from a
  // handler that lives outside the effect that built the scene.
  const sceneApiRef = useRef<SceneApi | null>(null);
  const spawnedRef = useRef<Set<string>>(new Set());
  const neighborMeshesRef = useRef<NeighborEntry[]>([]);

  const myDogRowId = `you-${myDog.id}`;

  // Where your dog is, and where it is being sent. Read by the animation
  // loop, written by a click on the ground.
  const myDogPos = useRef<{ x: number; z: number; targetX: number; targetZ: number; angle: number }>(
    { x: 0, z: 0, targetX: 0, targetZ: 0, angle: 0 }
  );

  useEffect(() => {
    visitorsRef.current = visitors;
  }, [visitors]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Re-seed the feed when the dog changes: the park is about that dog.
  useEffect(() => {
    setChatLog(seedMessages(myDog));
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDog.id, myDog.name, myDog.breed]);

  /* ------------------------------------------------------------- the scene */

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      // No WebGL: a blocklisted GPU, software rendering refused, or a
      // headless browser. The park cannot be drawn, and the panel says so
      // instead of showing a black rectangle — the rest of the region still
      // works.
      setWebglError(
        'This browser cannot draw the 3D park — WebGL is unavailable. The park needs a ' +
          'GPU-backed browser; the visitor list and park comms below still work.'
      );
      return;
    }

    const gl = renderer;
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;

    setWebglError(null);

    const scene = new THREE.Scene();
    const stageColor=getComputedStyle(container.closest('.cockpit')||container).getPropertyValue('--stage-ground').trim()||'#e1e9d5';
    scene.background = new THREE.Color(stageColor);
    scene.fog = new THREE.FogExp2(stageColor, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    gl.setSize(width, height);
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(gl.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    const sun = new THREE.DirectionalLight(0xffedd5, 1.8);
    sun.position.set(20, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    scene.add(sun);

    // Terrain: the park ground
    const groundGeo = new THREE.PlaneGeometry(60, 60, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xc5d4b2, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid floor lines (Vignelli / architectural grid). Dim neutral on both
    // axes — a full-bleed amber grid decorates the floor and steals the accent.
    const grid = new THREE.GridHelper(60, 30, 0xa5b78e, 0xa5b78e);
    grid.position.y = 0.01;
    scene.add(grid);

    // Park furniture: agility ramp
    const rampGroup = new THREE.Group();
    rampGroup.position.set(-8, 0, -4);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x27272a });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 1.8), rampMat);
    ramp.rotation.z = 0.25;
    ramp.position.y = 0.5;
    rampGroup.add(ramp);
    scene.add(rampGroup);

    // Pavilion
    const houseGroup = new THREE.Group();
    houseGroup.position.set(12, 0, -10);
    const houseWallMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 3.5), houseWallMat);
    house.position.y = 1.1;
    house.castShadow = true;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.2, 4), roofMat);
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(house, roof);
    scene.add(houseGroup);

    // Water bowl station
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.2 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 0.3, 16), bowlMat);
    bowl.position.set(0, 0.15, -6);
    scene.add(bowl);

    // The selected dog, in its own coat.
    const myDogGroup = new THREE.Group();
    scene.add(myDogGroup);

    const coatMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(myDog.avatarConfig.baseColor || '#2b2623'),
    });
    const ruffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(myDog.avatarConfig.secondaryColor || '#f4ede6'),
    });

    const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), coatMat);
    dogBody.position.y = 0.65;
    dogBody.castShadow = true;
    myDogGroup.add(dogBody);

    const dogRuff = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.4), ruffMat);
    dogRuff.position.set(0, 0.75, 0.5);
    myDogGroup.add(dogRuff);

    const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), coatMat);
    dogHead.position.set(0, 1.15, 0.65);
    myDogGroup.add(dogHead);

    const earGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
    const earL = new THREE.Mesh(earGeo, coatMat);
    earL.position.set(-0.2, 1.5, 0.65);
    const earR = new THREE.Mesh(earGeo, coatMat);
    earR.position.set(0.2, 1.5, 0.65);
    myDogGroup.add(earL, earR);

    // Amber halo above your own dog — the accent marks the dog, nothing else.
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 16), haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 2.2, 0);
    myDogGroup.add(halo);

    /* ---------------------------------------------------- neighbour spawning */

    const disposeObject = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
    };

    const spawnNeighbor = (nbr: MetaverseNeighborDog) => {
      const group = new THREE.Group();
      group.position.set(nbr.position[0], 0, nbr.position[2]);

      const bodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(nbr.avatarColors.base),
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.0), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      group.add(body);

      const headMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(nbr.avatarColors.secondary ?? nbr.avatarColors.base),
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.45, 0.45), headMat);
      head.position.set(0, 0.95, 0.5);
      group.add(head);

      const nEarGeo = new THREE.ConeGeometry(0.1, 0.24, 8);
      const nEarL = new THREE.Mesh(nEarGeo, bodyMat);
      nEarL.position.set(-0.16, 1.25, 0.5);
      const nEarR = new THREE.Mesh(nEarGeo, bodyMat);
      nEarR.position.set(0.16, 1.25, 0.5);
      group.add(nEarL, nEarR);

      // Name beacon — neutral until the dog is selected, amber when it is.
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x71717a });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), beaconMat);
      beacon.position.set(0, 1.6, 0);
      group.add(beacon);

      scene.add(group);
      neighborMeshesRef.current.push({
        data: nbr,
        group,
        dir: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize(),
        beacon,
        beaconMat,
      });
    };

    // Removing a neighbour DISPOSES it: the mesh leaves the scene and its
    // geometry and materials are released. The old panel left the visitor's
    // body standing in the park after "clear" — a dog the list no longer
    // mentions.
    const removeNeighbor = (id: string) => {
      const index = neighborMeshesRef.current.findIndex((n) => n.data.id === id);
      if (index === -1) return;
      const entry = neighborMeshesRef.current[index];
      scene.remove(entry.group);
      disposeObject(entry.group);
      neighborMeshesRef.current.splice(index, 1);
    };

    METAVERSE_NEIGHBORS.forEach((nbr) => spawnNeighbor(nbr));

    // Visitors that were already imported survive a rebuild of the scene
    // (a dog change), because they belong to the park, not to the render.
    visitorsRef.current.forEach((v) => {
      spawnNeighbor(v);
      spawnedRef.current.add(v.id);
    });

    sceneApiRef.current = { spawnNeighbor, removeNeighbor };

    /* ---------------------------------------------------------- the pointer */

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // A neighbour: select it.
      for (const nbr of neighborMeshesRef.current) {
        if (raycaster.intersectObjects(nbr.group.children, true).length > 0) {
          setSelectedId(nbr.data.id);
          sound.bark();
          return;
        }
      }

      // Your own dog: select it.
      if (raycaster.intersectObject(myDogGroup, true).length > 0) {
        setSelectedId(`you-${myDog.id}`);
        sound.bark();
        return;
      }

      // The ground: run there.
      const groundHits = raycaster.intersectObject(ground);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        myDogPos.current.targetX = pt.x;
        myDogPos.current.targetZ = pt.z;
        sound.happyYip();
      }
    };

    gl.domElement.addEventListener('click', handleCanvasClick);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(
        'The GPU dropped the 3D park — the WebGL context was lost. The visitor list and ' +
          'park comms below still work; reloading the app brings the park back.'
      );
    };
    gl.domElement.addEventListener('webglcontextlost', handleContextLost);

    /* ------------------------------------------------------------- keyboard */

    const keysPressed: Record<string, boolean> = {};
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never steal a key from a field the reader is typing in.
      if (isTyping(e.target)) return;
      keysPressed[e.key.toLowerCase()] = true;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      keysPressed[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    /* ------------------------------------------------------------- the loop */

    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      let manualMove = false;
      const speed = 7.0 * delta;
      if (keysPressed['w'] || keysPressed['arrowup']) {
        myDogPos.current.z -= speed;
        myDogPos.current.targetZ = myDogPos.current.z;
        manualMove = true;
      }
      if (keysPressed['s'] || keysPressed['arrowdown']) {
        myDogPos.current.z += speed;
        myDogPos.current.targetZ = myDogPos.current.z;
        manualMove = true;
      }
      if (keysPressed['a'] || keysPressed['arrowleft']) {
        myDogPos.current.x -= speed;
        myDogPos.current.targetX = myDogPos.current.x;
        manualMove = true;
      }
      if (keysPressed['d'] || keysPressed['arrowright']) {
        myDogPos.current.x += speed;
        myDogPos.current.targetX = myDogPos.current.x;
        manualMove = true;
      }

      if (!manualMove) {
        const dx = myDogPos.current.targetX - myDogPos.current.x;
        const dz = myDogPos.current.targetZ - myDogPos.current.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.1) {
          myDogPos.current.x += (dx / dist) * Math.min(speed, dist);
          myDogPos.current.z += (dz / dist) * Math.min(speed, dist);
          myDogPos.current.angle = Math.atan2(dx, dz);
        }
      }

      myDogPos.current.x = Math.max(-28, Math.min(28, myDogPos.current.x));
      myDogPos.current.z = Math.max(-28, Math.min(28, myDogPos.current.z));

      myDogGroup.position.set(myDogPos.current.x, 0, myDogPos.current.z);
      myDogGroup.rotation.y = myDogPos.current.angle;

      const isMoving =
        Math.abs(myDogPos.current.targetX - myDogPos.current.x) > 0.1 || manualMove;
      dogBody.position.y = isMoving ? 0.65 + Math.abs(Math.sin(elapsed * 12)) * 0.1 : 0.65;

      camera.position.x += (myDogPos.current.x - camera.position.x) * 0.05;
      camera.position.z += (myDogPos.current.z + 18 - camera.position.z) * 0.05;
      camera.lookAt(myDogPos.current.x, 0.8, myDogPos.current.z);

      halo.rotation.z = elapsed * 1.5;

      const selected = selectedIdRef.current;
      neighborMeshesRef.current.forEach((nbr, i) => {
        if (nbr.data.action !== 'sitting') {
          nbr.group.position.addScaledVector(nbr.dir, nbr.data.speed);
          if (Math.abs(nbr.group.position.x) > 26) nbr.dir.x = -nbr.dir.x;
          if (Math.abs(nbr.group.position.z) > 26) nbr.dir.z = -nbr.dir.z;
          nbr.group.rotation.y = Math.atan2(nbr.dir.x, nbr.dir.z);
          nbr.group.position.y = Math.abs(Math.sin(elapsed * 8 + i)) * 0.05;
        }

        // The beacon is the selection: amber for the dog in hand, neutral for
        // the rest. One accent, one meaning.
        const isSelected = nbr.data.id === selected;
        const wanted = isSelected ? 0xf59e0b : 0x71717a;
        if (nbr.beaconMat.color.getHex() !== wanted) nbr.beaconMat.color.setHex(wanted);
        const scale = isSelected ? 1.8 : 1;
        if (nbr.beacon.scale.x !== scale) nbr.beacon.scale.setScalar(scale);
      });

      gl.render(scene, camera);
    };

    animate();

    /* --------------------------------------------------------------- resize */

    // The panel is sized by the frame around it, and the frame changes shape
    // (a narrow screen shows one region, a wide screen shows five). A
    // ResizeObserver is the honest instrument: the scene follows its box.
    const applySize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      gl.setSize(w, h);
    };
    applySize();

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    /* ------------------------------------------------------------- teardown */

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      gl.domElement.removeEventListener('click', handleCanvasClick);
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);

      sceneApiRef.current = null;
      spawnedRef.current.clear();
      neighborMeshesRef.current = [];

      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
      scene.clear();

      gl.dispose();
      if (gl.domElement.parentElement === container) {
        container.removeChild(gl.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDog.id, myDog.avatarConfig.baseColor, myDog.avatarConfig.secondaryColor]);

  /* ----------------------------------------------- visitors vs. the scene */

  // The list and the scene are kept in step: a visitor that arrives is
  // spawned, a visitor that is cleared is removed AND disposed.
  useEffect(() => {
    const api = sceneApiRef.current;
    if (!api) return;

    const wanted = new Set(visitors.map((v) => v.id));
    for (const id of Array.from(spawnedRef.current)) {
      if (!wanted.has(id)) {
        api.removeNeighbor(id);
        spawnedRef.current.delete(id);
      }
    }
    for (const visitor of visitors) {
      if (!spawnedRef.current.has(visitor.id)) {
        api.spawnNeighbor(visitor);
        spawnedRef.current.add(visitor.id);
      }
    }
  }, [visitors]);

  /* ------------------------------------------------------------- behaviour */

  const broadcast = (text?: string) => {
    const message =
      text || (chatInput.trim() ? chatInput.trim() : `Woof! (greetings from ${myDog.name})`);
    sound.bark();
    setChatLog((prev) => [
      ...prev.slice(-8),
      {
        sender: `${myDog.name} (${myDog.breed})`,
        text: message,
        time: clockNow(),
      },
    ]);
    setChatInput('');
  };

  const handleImportVisitor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // Let the same file be chosen again after a failure.
    input.value = '';
    if (!file) return;

    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setNote(`"${file.name}" could not be read.`);
      return;
    }

    const result = validateDogFile(raw);
    if (!result.ok) {
      // Nothing is added to the park, and the reader is told why.
      setNote(result.error);
      return;
    }

    const visitor = dogProfileToNeighbor(result.dog, `v-${Date.now()}`);
    setVisitors((prev) => [...prev, visitor]);
    setNote(null);
    sound.bark();

    setChatLog((prev) => [
      ...prev.slice(-8),
      {
        sender: 'Park',
        text: sceneApiRef.current
          ? `${visitor.name} the ${visitor.breed} has entered the park.`
          : `${visitor.name} the ${visitor.breed} joined the visitor list — the 3D park is unavailable on this browser.`,
        time: clockNow(),
      },
    ]);
  };

  const clearVisitors = () => {
    if (!visitors.length) return;
    const count = visitors.length;
    setVisitors([]);
    setSelectedId((current) => {
      if (current && current.startsWith('visitor-')) return null;
      return current;
    });
    sound.happyYip();
    setChatLog((prev) => [
      ...prev.slice(-8),
      {
        sender: 'Park',
        text:
          count === 1
            ? 'The visitor has left the park.'
            : `The ${count} visitors have left the park.`,
        time: clockNow(),
      },
    ]);
  };

  /* ---------------------------------------------------------------- rows */

  const rows = useMemo<ParkRow[]>(
    () => [
      {
        id: myDogRowId,
        name: myDog.name,
        breed: myDog.breed,
        action: 'with you',
        tribe: myDog.metaverseTribe || 'Your pack',
        kind: 'you',
      },
      ...METAVERSE_NEIGHBORS.map((n) => ({
        id: n.id,
        name: n.name,
        breed: n.breed,
        action: n.action,
        tribe: n.tribe,
        kind: 'neighbour' as VisitorKind,
      })),
      ...visitors.map((v) => ({
        id: v.id,
        name: v.name,
        breed: v.breed,
        action: v.action,
        tribe: v.tribe,
        kind: 'visitor' as VisitorKind,
      })),
    ],
    [myDog, myDogRowId, visitors]
  );

  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;
  const sceneCount = 1 + METAVERSE_NEIGHBORS.length + visitors.length;

  return (
    <section className="panel region-commons h-full" aria-label="Commons">
      {/* ---- the head: what this region is, and its two controls -------- */}
      <header className="panel-head">
        <h2 className="label text-zinc-300 truncate">Commons</h2>
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="btn btn-quiet min-h-0 px-1.5 py-1 text-[10px] cursor-pointer shrink-0">
            <Upload size={11} aria-hidden="true" />
            Import visitor
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportVisitor}
              className="hidden"
              aria-label="Import a friend's exported dog JSON"
            />
          </label>
          <button
            onClick={clearVisitors}
            disabled={visitors.length === 0}
            className="btn btn-quiet min-h-0 px-1.5 py-1 text-[10px] shrink-0"
            aria-label="Clear the visitors from the park"
          >
            Clear visitors
          </button>
        </div>
      </header>

      <div className="panel-body">
        {/* ---- 1. THE PARK ------------------------------------------------
            The scene holds a fixed aspect ratio, so the panel's height is
            decided before the WebGL context exists. It can shrink; it can
            never grow the region. */}
        <div className="relative w-full aspect-[16/10] max-h-[45%] min-h-[100px] overflow-hidden bg-black border-hairline-b">
          <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />

          {webglError && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="text-center max-w-[36ch]">
                <p className="label mb-1">Park scene unavailable</p>
                <p className="text-[11px] leading-relaxed text-zinc-400">{webglError}</p>
              </div>
            </div>
          )}

          {/* One readout rule across the top edge — the only overlay chrome. */}
          {!webglError && (
            <div className="absolute top-0 left-0 right-0 bg-black/90 border-hairline-b px-2 py-1 flex items-center gap-2 overflow-hidden pointer-events-none whitespace-nowrap">
              <span className="label">Dogs in scene</span>
              <span className="data text-[11px] text-zinc-200">{sceneCount}</span>
              <span className="h-3 w-px bg-zinc-700 shrink-0" aria-hidden="true" />
              <span className="label shrink-0">With</span>
              <span className="font-display text-[11px] text-accent truncate">{myDog.name}</span>
              <span className="label truncate ml-auto">
                click a dog to select, WASD to run
              </span>
            </div>
          )}

          {/* The dog in hand, as a slim bar over the stage it describes. */}
          {selectedRow && (
            <div className="bar" role="status" aria-live="polite">
              <span className="label shrink-0">
                {selectedRow.kind === 'you'
                  ? 'Your dog'
                  : selectedRow.kind === 'visitor'
                    ? 'Visitor'
                    : 'Neighbour'}
              </span>
              <span className="font-display text-[12px] text-accent truncate min-w-0 shrink-0">
                {selectedRow.name}
              </span>
              <span className="text-[11px] text-zinc-400 truncate min-w-0 flex-1">
                {selectedRow.breed} / {selectedRow.tribe}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                aria-label={`Close the details for ${selectedRow.name}`}
                className="btn btn-quiet w-5 h-5 min-h-0 p-0 shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ---- 2. WHO IS HERE --------------------------------------------
            One compact line per dog. It is not a scroll container: the law
            allows exactly one of those, and the chat log is the one that
            earns it. */}
        <div className="min-h-0 overflow-hidden border-hairline-b">
          <ul className="min-h-0 overflow-hidden">
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <li
                  key={row.id}
                  className={`border-hairline-b border-l-2 last:border-hairline-b-0 ${
                    isSelected ? 'border-l-accent' : 'border-l-transparent'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedId(isSelected ? null : row.id);
                      sound.bark();
                    }}
                    aria-pressed={isSelected}
                    className="w-full min-h-0 px-2 py-[3px] border-0 bg-transparent hover:bg-elevated flex items-center gap-2 justify-start text-left"
                  >
                    <span
                      className={`font-display text-[11px] truncate min-w-0 flex-1 ${
                        isSelected ? 'text-accent' : 'text-zinc-100'
                      }`}
                    >
                      {row.name}
                    </span>
                    <span title={row.breed} className="text-[10px] text-faint truncate min-w-0 flex-1">
                      {row.breed}
                    </span>
                    <span className="label shrink-0">{row.action}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---- 3. THE NOTE ------------------------------------------------
            What the import did, said once, in the panel, in a line. Nothing
            pops over the reader. */}
        {note && (
          <div
            className="bar--note shrink-0 flex items-start gap-2 border-hairline bg-elevated px-2 py-1.5"
            role="status"
            aria-live="polite"
          >
            <TriangleAlert size={12} className="text-accent shrink-0 mt-[1px]" aria-hidden="true" />
            <p className="text-[11px] leading-snug text-zinc-200 min-w-0 flex-1">{note}</p>
            <button
              onClick={() => setNote(null)}
              aria-label="Dismiss the note"
              className="btn btn-quiet w-5 h-5 min-h-0 p-0 shrink-0"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* ---- 4. THE PARK COMMS ------------------------------------------
            The one place in this panel where a list is honestly longer than
            the space it was given. */}
        <div className="panel-scroll px-2 py-1.5">
          {chatLog.map((message, index) => (
            <div
              key={index}
              className="border-hairline-b pb-1 mb-1 last:border-hairline-b-0 last:mb-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-[11px] font-semibold truncate min-w-0 ${
                    message.sender.startsWith(myDog.name) ? 'text-accent' : 'text-zinc-200'
                  }`}
                >
                  {message.sender}
                </span>
                {message.time && (
                  <span className="data text-[10px] text-faint shrink-0">{message.time}</span>
                )}
              </div>
              <p className="text-[11px] leading-snug text-zinc-400 line-clamp-2">{message.text}</p>
            </div>
          ))}
        </div>

        {/* ---- 5. SAY SOMETHING ------------------------------------------- */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            broadcast();
          }}
          className="shrink-0 flex items-center gap-1 border-hairline-t bg-black p-1"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            aria-label="Message to park comms"
            placeholder="Write to the park"
            className="flex-1 min-w-0 min-h-0 px-2 py-1 text-[12px]"
          />
          <button
            type="button"
            onClick={() => broadcast()}
            aria-label="Bark at the park"
            className="btn btn-quiet min-h-0 w-7 h-7 p-0 shrink-0"
          >
            <MessageSquare size={12} />
          </button>
          <button type="submit" className="btn btn-accent min-h-0 px-2 py-1 text-[11px] shrink-0">
            SEND
          </button>
        </form>
      </div>
    </section>
  );
};
