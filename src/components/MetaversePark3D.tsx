import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DogProfile, MetaverseNeighborDog } from '../types/dog';
import { METAVERSE_NEIGHBORS } from '../data/defaultDogs';
import { sound } from '../utils/proceduralAudio';
import { ShieldCheck, Sparkles, MessageSquare, Compass, Eye } from 'lucide-react';

interface MetaversePark3DProps {
  myDog: DogProfile;
}

export const MetaversePark3D: React.FC<MetaversePark3DProps> = ({ myDog }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  const [selectedDog, setSelectedDog] = useState<MetaverseNeighborDog | null>(null);
  const [activeTribeFilter, setActiveTribeFilter] = useState<string>('ALL');
  const [chatLog, setChatLog] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'Somtum (Thai Ridgeback)', text: 'Just finished 5 laps around the agility ramp! 🐾', time: '04:15' },
    { sender: 'Waffles (Corgi)', text: 'Anyone dropping cheese at the water fountain?', time: '04:22' },
    { sender: 'Expo (Bangkaew)', text: 'Perimeter secured. Bolster resting station established.', time: '04:28' },
  ]);
  const [chatInput, setChatInput] = useState('');

  const myDogPos = useRef<{ x: number; z: number; targetX: number; targetZ: number; angle: number }>({
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    angle: 0,
  });

  const broadcastBark = (text?: string) => {
    const msg = text || (chatInput.trim() ? chatInput.trim() : 'Woof! (Greetings from Expo)');
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

    // Terrain: The Canine Commons Park Ground
    const groundGeo = new THREE.PlaneGeometry(60, 60, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x141416, // Dark slate turf
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid Floor lines (Vignelli / architectural grid)
    const grid = new THREE.GridHelper(60, 30, 0xf59e0b, 0x27272a);
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
    // SPAWN MY DOG (EXPO)
    // ==========================================
    const myDogGroup = new THREE.Group();
    scene.add(myDogGroup);

    // Expo low-poly mesh for metaverse
    const expoBodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const expoBodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2623 });
    const expoBody = new THREE.Mesh(expoBodyGeo, expoBodyMat);
    expoBody.position.y = 0.65;
    expoBody.castShadow = true;
    myDogGroup.add(expoBody);

    // White ruff
    const expoRuffGeo = new THREE.BoxGeometry(0.9, 0.7, 0.4);
    const expoRuffMat = new THREE.MeshStandardMaterial({ color: 0xf4ede6 });
    const expoRuff = new THREE.Mesh(expoRuffGeo, expoRuffMat);
    expoRuff.position.set(0, 0.75, 0.5);
    myDogGroup.add(expoRuff);

    // Head
    const expoHeadGeo = new THREE.BoxGeometry(0.55, 0.5, 0.5);
    const expoHead = new THREE.Mesh(expoHeadGeo, expoBodyMat);
    expoHead.position.set(0, 1.15, 0.65);
    myDogGroup.add(expoHead);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
    const earL = new THREE.Mesh(earGeo, expoBodyMat);
    earL.position.set(-0.2, 1.5, 0.65);
    const earR = new THREE.Mesh(earGeo, expoBodyMat);
    earR.position.set(0.2, 1.5, 0.65);
    myDogGroup.add(earL, earR);

    // Amber halo marker above my dog
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

      // Check hit on ground to command Expo to run there
      const groundHits = raycaster.intersectObject(ground);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        myDogPos.current.targetX = pt.x;
        myDogPos.current.targetZ = pt.z;
        sound.happyYip();
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Keyboard WASD Controls for Expo
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
        expoBody.position.y = 0.65 + Math.abs(Math.sin(elapsed * 12)) * 0.1;
      } else {
        expoBody.position.y = 0.65;
      }

      // Smooth camera follows Expo with gentle offset
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

  return (
    <div className="relative w-full h-[520px] bg-black border-hairline overflow-hidden flex flex-col md:flex-row">
      {/* 3D WebGL Canvas for the Metaverse Park */}
      <div className="relative flex-1 h-full min-h-[340px]">
        <div ref={mountRef} className="w-full h-full cursor-crosshair" />

        {/* Metaverse HUD Header */}
        <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none bg-black/80 px-2 py-1 border-hairline">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-mono text-[10px] text-zinc-300 tracking-wider">
            CANINE COMMONS // BARK PARK SECTOR 01
          </span>
          <span className="text-[10px] text-amber-500 font-mono">
            [ONLINE: {METAVERSE_NEIGHBORS.length + 1} DOGS]
          </span>
        </div>

        {/* Navigation Instructions */}
        <div className="absolute bottom-2 left-2 pointer-events-none bg-black/85 px-2 py-1 border-hairline">
          <span className="font-mono text-[10px] text-zinc-400">
            CONTROLS: <span className="text-amber-500 font-bold">WASD</span> / CLICK TO RUN · CLICK DOG TO INSPECT PASSPORT
          </span>
        </div>

        {/* Quick Bark Action */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <button
            onClick={() => broadcastBark()}
            className="btn btn-accent text-[10px] py-1 px-2.5 h-7"
          >
            <MessageSquare size={12} /> BARK / GREET PARK
          </button>
        </div>

        {/* Selected Neighbor Dog Detail Card Modal / Overlay */}
        {selectedDog && (
          <div className="absolute top-10 left-2 right-2 md:left-auto md:right-4 md:w-80 bg-zinc-950/95 border border-amber-500/50 p-3.5 z-20 backdrop-blur-md">
            <div className="flex items-start justify-between border-hairline-b pb-2 mb-2">
              <div>
                <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest block">
                  METAVERSE PASSPORT // ENCOUNTER
                </span>
                <h4 className="font-display text-base text-zinc-100">{selectedDog.name}</h4>
                <p className="text-[11px] text-zinc-400">{selectedDog.breed}</p>
              </div>
              <button
                onClick={() => setSelectedDog(null)}
                className="text-zinc-500 hover:text-zinc-100 text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-hairline-b">
                <span className="text-zinc-500 font-mono text-[10px]">TRIBE</span>
                <span className="text-amber-400 font-mono text-[11px] font-semibold">{selectedDog.tribe}</span>
              </div>
              <div className="flex justify-between py-1 border-hairline-b">
                <span className="text-zinc-500 font-mono text-[10px]">OWNER</span>
                <span className="text-zinc-200 font-mono text-[11px]">{selectedDog.ownerName}</span>
              </div>
              <div className="flex justify-between py-1 border-hairline-b">
                <span className="text-zinc-500 font-mono text-[10px]">VACCINES</span>
                <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                  <ShieldCheck size={11} /> VERIFIED CURRENT
                </span>
              </div>
              <div className="pt-1 text-[11px] text-zinc-300 italic">
                "{selectedDog.personality}"
              </div>

              <div className="pt-2 flex gap-1.5">
                <button
                  onClick={() => {
                    broadcastBark(`*sniffs ${selectedDog.name} respectfully*`);
                    sound.happyYip();
                  }}
                  className="btn btn-accent flex-1 text-[10px] py-1"
                >
                  <Sparkles size={11} /> SNIFF & GREET
                </button>
                <button
                  onClick={() => {
                    broadcastBark(`Invited ${selectedDog.name} to race around agility ramp!`);
                    sound.bark();
                  }}
                  className="btn flex-1 text-[10px] py-1"
                >
                  PLAY CHASE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar: Live Bark Feed & Tribe Rosters */}
      <div className="w-full md:w-72 bg-zinc-950 border-hairline-t md:border-hairline-t-0 md:border-hairline-l flex flex-col h-[200px] md:h-full">
        <div className="p-2 border-hairline-b bg-zinc-900/50 flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Compass size={12} className="text-amber-500" /> LIVE PARK COMMS
          </span>
          <span className="font-mono text-[9px] text-zinc-500">REALTIME</span>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
          {chatLog.map((c, idx) => (
            <div key={idx} className="border-hairline-b pb-1.5">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-0.5">
                <span className="text-amber-400/90 font-semibold">{c.sender}</span>
                <span>{c.time}</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        {/* Comms Input */}
        <div className="p-2 border-hairline-t bg-black flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && broadcastBark()}
            placeholder="Type a bark or message..."
            className="flex-1 text-xs py-1 px-2 min-h-[30px]"
          />
          <button
            onClick={() => broadcastBark()}
            className="btn btn-accent text-[10px] py-1 px-2.5 min-h-[30px]"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};
