import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DogProfile, MetaverseNeighborDog } from '../types/dog';
import { METAVERSE_NEIGHBORS } from '../data/defaultDogs';
import { sound } from '../utils/proceduralAudio';
import { Sparkles, MessageSquare, Compass, X } from 'lucide-react';

interface MetaversePark3DProps {
  myDog: DogProfile;
}

interface ParkMessage {
  sender: string;
  text: string;
  /** Only real messages carry a clock time. Seeded lines are older than the session. */
  time?: string;
}

// The park is local: three lines of scene furniture, and the selected dog
// already in the scene. No clock times — these did not happen at 04:15.
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

export const MetaversePark3D: React.FC<MetaversePark3DProps> = ({ myDog }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  const [selectedDog, setSelectedDog] = useState<MetaverseNeighborDog | null>(null);
  const [chatLog, setChatLog] = useState<ParkMessage[]>(() => seedMessages(myDog));
  const [chatInput, setChatInput] = useState('');

  const myDogPos = useRef<{ x: number; z: number; targetX: number; targetZ: number; angle: number }>({
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    angle: 0,
  });

  // Re-seed the feed when the selected dog changes: the park is about that dog.
  useEffect(() => {
    setChatLog(seedMessages(myDog));
  }, [myDog.id]);

  const broadcastBark = (text?: string) => {
    const msg = text || (chatInput.trim() ? chatInput.trim() : `Woof! (greetings from ${myDog.name})`);
    sound.bark();
    setChatLog((prev) => [
      ...prev.slice(-8),
      {
        sender: `${myDog.name} (${myDog.breed})`,
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b);
    scene.fog = new THREE.FogExp2(0x09090b, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

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
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x141416, // Dark slate turf
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid floor lines (Vignelli / architectural grid). Dim neutral on both
    // axes — a full-bleed amber grid decorates the floor and steals the accent.
    const grid = new THREE.GridHelper(60, 30, 0x27272a, 0x27272a);
    grid.position.y = 0.01;
    scene.add(grid);

    // Park Architecture: Agility Ramps, Dog House, Boundary Posts
    const rampGroup = new THREE.Group();
    rampGroup.position.set(-8, 0, -4);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x27272a });
    const rampGeo = new THREE.BoxGeometry(4, 0.3, 1.8);
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.rotation.z = 0.25;
    ramp.position.y = 0.5;
    rampGroup.add(ramp);
    scene.add(rampGroup);

    // Minimalist Dog House Pavilion
    const houseGroup = new THREE.Group();
    houseGroup.position.set(12, 0, -10);
    const houseWallMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
    const wallGeo = new THREE.BoxGeometry(3.5, 2.2, 3.5);
    const house = new THREE.Mesh(wallGeo, houseWallMat);
    house.position.y = 1.1;
    house.castShadow = true;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const roofGeo = new THREE.ConeGeometry(3, 1.2, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(house, roof);
    scene.add(houseGroup);

    // Water Bowl Station
    const bowlGeo = new THREE.CylinderGeometry(0.8, 0.6, 0.3, 16);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.2 });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.set(0, 0.15, -6);
    scene.add(bowl);

    // ==========================================
    // SPAWN THE SELECTED DOG
    // ==========================================
    const myDogGroup = new THREE.Group();
    scene.add(myDogGroup);

    // The coat comes from the dog's own avatar config, so the mesh in the
    // park is the dog the operator selected — not a fixed pet.
    const coatMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(myDog.avatarConfig.baseColor || '#2b2623'),
    });
    const ruffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(myDog.avatarConfig.secondaryColor || '#f4ede6'),
    });

    const dogBodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const dogBody = new THREE.Mesh(dogBodyGeo, coatMat);
    dogBody.position.y = 0.65;
    dogBody.castShadow = true;
    myDogGroup.add(dogBody);

    // Light ruff
    const dogRuffGeo = new THREE.BoxGeometry(0.9, 0.7, 0.4);
    const dogRuff = new THREE.Mesh(dogRuffGeo, ruffMat);
    dogRuff.position.set(0, 0.75, 0.5);
    myDogGroup.add(dogRuff);

    // Head
    const dogHeadGeo = new THREE.BoxGeometry(0.55, 0.5, 0.5);
    const dogHead = new THREE.Mesh(dogHeadGeo, coatMat);
    dogHead.position.set(0, 1.15, 0.65);
    myDogGroup.add(dogHead);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
    const earL = new THREE.Mesh(earGeo, coatMat);
    earL.position.set(-0.2, 1.5, 0.65);
    const earR = new THREE.Mesh(earGeo, coatMat);
    earR.position.set(0.2, 1.5, 0.65);
    myDogGroup.add(earL, earR);

    // Amber halo marker above my dog — the accent marks the dog, nothing else
    const haloGeo = new THREE.RingGeometry(0.5, 0.6, 16);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 2.2, 0);
    myDogGroup.add(halo);

    // ==========================================
    // SPAWN NEIGHBOR DOGS FROM TRIBES
    // ==========================================
    const neighborMeshes: Array<{
      data: MetaverseNeighborDog;
      group: THREE.Group;
      dir: THREE.Vector3;
    }> = [];

    METAVERSE_NEIGHBORS.forEach((nbr) => {
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
        color: new THREE.Color(nbr.avatarColors.secondary),
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.45, 0.45), headMat);
      head.position.set(0, 0.95, 0.5);
      group.add(head);

      const nEarGeo = new THREE.ConeGeometry(0.1, 0.24, 4);
      const nEarL = new THREE.Mesh(nEarGeo, bodyMat);
      nEarL.position.set(-0.16, 1.25, 0.5);
      const nEarR = new THREE.Mesh(nEarGeo, bodyMat);
      nEarR.position.set(0.16, 1.25, 0.5);
      group.add(nEarL, nEarR);

      // Name tag beacon
      const beaconGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x71717a });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 1.6, 0);
      group.add(beacon);

      scene.add(group);
      neighborMeshes.push({
        data: nbr,
        group,
        dir: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize(),
      });
    });

    // Raycasting for clicking ground or dogs
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Check hit on neighbor dogs
      for (const nbr of neighborMeshes) {
        const hits = raycaster.intersectObjects(nbr.group.children, true);
        if (hits.length > 0) {
          setSelectedDog(nbr.data);
          sound.bark();
          return;
        }
      }

      // Check hit on ground to command the dog to run there
      const groundHits = raycaster.intersectObject(ground);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        myDogPos.current.targetX = pt.x;
        myDogPos.current.targetZ = pt.z;
        sound.happyYip();
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Keyboard WASD controls for the selected dog
    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ==========================================
    // METAVERSE SIMULATION LOOP
    // ==========================================
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Keyboard drive
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

      // Click-to-move interpolation
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

      // Boundaries
      myDogPos.current.x = Math.max(-28, Math.min(28, myDogPos.current.x));
      myDogPos.current.z = Math.max(-28, Math.min(28, myDogPos.current.z));

      myDogGroup.position.set(myDogPos.current.x, 0, myDogPos.current.z);
      myDogGroup.rotation.y = myDogPos.current.angle;

      // Trotting bounce animation
      const isMoving = Math.abs(myDogPos.current.targetX - myDogPos.current.x) > 0.1 || manualMove;
      if (isMoving) {
        dogBody.position.y = 0.65 + Math.abs(Math.sin(elapsed * 12)) * 0.1;
      } else {
        dogBody.position.y = 0.65;
      }

      // Smooth camera follows the dog with gentle offset
      camera.position.x += (myDogPos.current.x - camera.position.x) * 0.05;
      camera.position.z += (myDogPos.current.z + 18 - camera.position.z) * 0.05;
      camera.lookAt(myDogPos.current.x, 0.8, myDogPos.current.z);

      // Halo rotation
      halo.rotation.z = elapsed * 1.5;

      // Animate neighbor dogs wandering
      neighborMeshes.forEach((nbr, i) => {
        if (nbr.data.action === 'sitting') return;

        // Roam
        nbr.group.position.addScaledVector(nbr.dir, nbr.data.speed);

        // Bounce back from boundaries
        if (Math.abs(nbr.group.position.x) > 26) {
          nbr.dir.x = -nbr.dir.x;
        }
        if (Math.abs(nbr.group.position.z) > 26) {
          nbr.dir.z = -nbr.dir.z;
        }

        // Rotate face toward direction
        nbr.group.rotation.y = Math.atan2(nbr.dir.x, nbr.dir.z);

        // Subtle leg/body gait bob
        nbr.group.position.y = Math.abs(Math.sin(elapsed * 8 + i)) * 0.05;
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.dispose();
    };
  }, [myDog]);

  const dogCount = METAVERSE_NEIGHBORS.length + 1;

  return (
    <div className="relative w-full h-[520px] bg-black border-hairline overflow-hidden flex flex-col md:flex-row">
      {/* 3D WebGL Canvas for the park scene */}
      <div className="relative flex-1 h-full min-h-[340px]">
        <div ref={mountRef} className="w-full h-full cursor-crosshair" />

        {/* One readout strip across the top edge — the only overlay chrome.
            Identity, scene size and the control hint live on one rule. */}
        <div className="absolute top-0 left-0 right-0 bg-black/90 border-hairline-b px-3 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pointer-events-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-[11px] uppercase tracking-[0.14em] text-zinc-100">
              Canine Commons
            </span>
            {/* The scene note and its divider collapse on narrow screens so the
                strip stays two tidy rows instead of orphaning a rule. */}
            <span className="hidden h-3.5 w-px bg-zinc-700 sm:block" aria-hidden="true" />
            <span className="label hidden sm:inline">Local park scene</span>
            <span className="h-3.5 w-px bg-zinc-700" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="label">Dogs in scene</span>
              <span className="data text-[11px] text-zinc-200">{dogCount}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="label">With</span>
              <span className="font-display text-[11px] text-accent">{myDog.name}</span>
            </span>
          </div>
          <span className="label">WASD / click to run</span>
        </div>

        {/* Neighbour inspection card — one hairline, the same surfaces as the
            rest of the console, anchored to the stage it describes. */}
        {selectedDog && (
          <div
            role="dialog"
            aria-label={`${selectedDog.name} details`}
            className="absolute left-3 right-3 bottom-3 md:left-auto md:right-4 md:w-80 bg-zinc-950 border-hairline p-3.5 z-20"
          >
            <div className="flex items-start justify-between gap-2 border-hairline-b pb-2 mb-2">
              <div className="min-w-0">
                <span className="label block">Park neighbour</span>
                <h4 className="font-display text-base text-zinc-100">{selectedDog.name}</h4>
                <p className="text-[11px] text-zinc-400">{selectedDog.breed}</p>
              </div>
              <button
                onClick={() => setSelectedDog(null)}
                aria-label={`Close details for ${selectedDog.name}`}
                className="btn btn-quiet w-7 h-7 min-h-0 p-0 shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline gap-3 py-1 border-hairline-b">
                <span className="label">Tribe</span>
                <span className="text-[12px] text-zinc-200 text-right">{selectedDog.tribe}</span>
              </div>
              <div className="flex justify-between items-baseline gap-3 py-1 border-hairline-b">
                <span className="label">Owner</span>
                <span className="text-[12px] text-zinc-200">{selectedDog.ownerName}</span>
              </div>
              <div className="flex justify-between items-baseline gap-3 py-1 border-hairline-b">
                <span className="label">Vaccines</span>
                <span className="text-[11px] text-faint">Not on record</span>
              </div>
              <div className="pt-1 text-[11px] text-zinc-400 italic">
                &ldquo;{selectedDog.personality}&rdquo;
              </div>

              <div className="pt-2 flex gap-1.5">
                <button
                  onClick={() => {
                    broadcastBark(`*sniffs ${selectedDog.name} respectfully*`);
                    sound.happyYip();
                  }}
                  className="btn btn-accent flex-1 text-[11px]"
                >
                  <Sparkles size={12} /> SNIFF &amp; GREET
                </button>
                <button
                  onClick={() => {
                    broadcastBark(`Invited ${selectedDog.name} to race around the agility ramp!`);
                    sound.bark();
                  }}
                  className="btn flex-1 text-[11px]"
                >
                  PLAY CHASE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar: the park's comms. Stacked under the stage on narrow
          screens (top rule), a column beside it from md up (left rule). */}
      <div className="w-full md:w-72 bg-zinc-950 border-hairline-t md:border-hairline-t-0 md:border-hairline-l flex flex-col h-[200px] md:h-full">
        <div className="px-2 py-1.5 border-hairline-b bg-zinc-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="label flex items-center gap-1.5">
              <Compass size={12} className="text-accent" /> Park comms
            </span>
            <span className="label">Local only</span>
          </div>
          <button
            onClick={() => broadcastBark()}
            aria-label="Bark at the park"
            className="btn btn-accent text-[10px] py-1 px-2 min-h-0 shrink-0"
          >
            <MessageSquare size={12} /> BARK
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
          {chatLog.map((c, idx) => (
            <div key={idx} className="border-hairline-b pb-1.5 last:border-hairline-b-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span
                  className={`text-[11px] font-semibold truncate ${
                    c.sender.startsWith(myDog.name) ? 'text-accent' : 'text-zinc-200'
                  }`}
                >
                  {c.sender}
                </span>
                {c.time && <span className="data text-[10px] text-faint shrink-0">{c.time}</span>}
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">{c.text}</p>
            </div>
          ))}
        </div>

        {/* Comms Input — one control: field and send share a single edge. */}
        <div className="p-2 border-hairline-t bg-black">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              broadcastBark();
            }}
          >
            <div className="flex">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                aria-label="Message to park comms"
                placeholder="Write a message to the park"
                className="flex-1 min-w-0 text-xs px-2 min-h-[34px] border-r-0"
              />
              <button type="submit" className="btn btn-accent text-[11px] px-3 shrink-0">
                SEND
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
