import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DogProfile } from '../types/dog';
import { sound } from '../utils/proceduralAudio';

interface DogAvatar3DProps {
  dog: DogProfile;
  interactionTrigger: 'pet' | 'feed' | 'play' | 'groom' | null;
  onInteractionEnd?: () => void;
}

export const DogAvatar3D: React.FC<DogAvatar3DProps> = ({
  dog,
  interactionTrigger,
  onInteractionEnd,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

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
    type: 'idle' | 'pet' | 'feed' | 'play' | 'groom';
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
    camera.position.set(0, 1.6, 4.2);
    camera.lookAt(0, 0.6, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    dirLight.position.set(4, 6, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Subtle amber rim light
    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
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

    const baseColor = new THREE.Color(dog.avatarConfig.baseColor || '#2b2623');
    const whiteFur = new THREE.Color(dog.avatarConfig.secondaryColor || '#f7f7f7');
    const maskColor = new THREE.Color(dog.avatarConfig.maskColor || '#1a1715');

    // Materials
    const darkFurMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.85,
      metalness: 0.05,
    });
    const whiteFurMat = new THREE.MeshStandardMaterial({
      color: whiteFur,
      roughness: 0.8,
      metalness: 0.05,
    });
    const maskMat = new THREE.MeshStandardMaterial({
      color: maskColor,
      roughness: 0.9,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.3,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1f160e,
      roughness: 0.1,
    });
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4,
    });

    // 1. Torso & Body
    const torso = new THREE.Group();
    torso.position.y = 0.65;

    // Saddle / Back (Dark Sable)
    const backGeo = new THREE.BoxGeometry(0.72, 0.58, 1.15);
    const backMesh = new THREE.Mesh(backGeo, darkFurMat);
    backMesh.castShadow = true;
    torso.add(backMesh);

    // Belly & Chest undercoat (White)
    const bellyGeo = new THREE.BoxGeometry(0.68, 0.3, 1.1);
    const bellyMesh = new THREE.Mesh(bellyGeo, whiteFurMat);
    bellyMesh.position.y = -0.22;
    bellyMesh.position.z = 0.02;
    torso.add(bellyMesh);

    // Bangkaew Signature: Lion Mane / Collar Ruff (แผงคอสิงโต)
    const ruffGroup = new THREE.Group();
    ruffGroup.position.set(0, 0.12, 0.55);

    const ruffCoreGeo = new THREE.BoxGeometry(0.86, 0.72, 0.42);
    const ruffCore = new THREE.Mesh(ruffCoreGeo, whiteFurMat);
    ruffGroup.add(ruffCore);

    // Fluffy side facets
    const ruffSideGeo = new THREE.ConeGeometry(0.32, 0.45, 5);
    const ruffL = new THREE.Mesh(ruffSideGeo, whiteFurMat);
    ruffL.rotation.z = Math.PI / 2.8;
    ruffL.position.set(-0.46, -0.05, 0);
    const ruffR = new THREE.Mesh(ruffSideGeo, whiteFurMat);
    ruffR.rotation.z = -Math.PI / 2.8;
    ruffR.position.set(0.46, -0.05, 0);
    ruffGroup.add(ruffL, ruffR);

    torso.add(ruffGroup);
    dogRoot.add(torso);

    // 2. Head Group
    const head = new THREE.Group();
    head.position.set(0, 1.05, 0.65);

    // Skull
    const skullGeo = new THREE.BoxGeometry(0.52, 0.44, 0.48);
    const skullMesh = new THREE.Mesh(skullGeo, maskMat);
    skullMesh.castShadow = true;
    head.add(skullMesh);

    // Cheeks (White fluff)
    const cheekGeo = new THREE.BoxGeometry(0.64, 0.28, 0.32);
    const cheekMesh = new THREE.Mesh(cheekGeo, whiteFurMat);
    cheekMesh.position.set(0, -0.08, -0.02);
    head.add(cheekMesh);

    // Snout / Muzzle
    const snoutGeo = new THREE.BoxGeometry(0.28, 0.22, 0.36);
    const snoutMesh = new THREE.Mesh(snoutGeo, whiteFurMat);
    snoutMesh.position.set(0, -0.08, 0.35);
    snoutMesh.castShadow = true;
    head.add(snoutMesh);

    // White blaze along nose ridge
    const blazeGeo = new THREE.BoxGeometry(0.08, 0.24, 0.36);
    const blazeMesh = new THREE.Mesh(blazeGeo, whiteFurMat);
    blazeMesh.position.set(0, 0.06, 0.24);
    head.add(blazeMesh);

    // Black Nose
    const noseGeo = new THREE.BoxGeometry(0.12, 0.08, 0.06);
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.position.set(0, -0.02, 0.54);
    head.add(noseMesh);

    // Eyes (with white specular gleam)
    const eyeGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 0.06, 0.24);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 0.06, 0.24);
    head.add(eyeL, eyeR);

    // Tiny pink tongue (Expo's adorable relaxed tongue peek!)
    const tongueGeo = new THREE.BoxGeometry(0.09, 0.03, 0.12);
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, -0.19, 0.44);
    tongue.rotation.x = 0.2;
    head.add(tongue);

    // Ears (Triangular pricked Bangkaew ears with dark tips)
    const leftEar = new THREE.Group();
    leftEar.position.set(-0.2, 0.24, -0.04);
    const earGeo = new THREE.ConeGeometry(0.13, 0.26, 4);
    const earLMesh = new THREE.Mesh(earGeo, maskMat);
    earLMesh.rotation.y = Math.PI / 4;
    leftEar.add(earLMesh);
    // Inner ear white fluff
    const earInnerGeo = new THREE.ConeGeometry(0.09, 0.2, 4);
    const earLInner = new THREE.Mesh(earInnerGeo, whiteFurMat);
    earLInner.position.set(0.01, -0.02, 0.04);
    earLInner.rotation.y = Math.PI / 4;
    leftEar.add(earLInner);

    const rightEar = new THREE.Group();
    rightEar.position.set(0.2, 0.24, -0.04);
    const earRMesh = new THREE.Mesh(earGeo, maskMat);
    earRMesh.rotation.y = Math.PI / 4;
    rightEar.add(earRMesh);
    const earRInner = new THREE.Mesh(earInnerGeo, whiteFurMat);
    earRInner.position.set(-0.01, -0.02, 0.04);
    earRInner.rotation.y = Math.PI / 4;
    rightEar.add(earRInner);

    head.add(leftEar, rightEar);
    dogRoot.add(head);

    // 3. Bangkaew Plumed Tail (Curled proudly over back)
    const tail = new THREE.Group();
    tail.position.set(0, 0.85, -0.58);

    const tailSeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), darkFurMat);
    tailSeg1.position.set(0, 0.12, -0.06);
    tailSeg1.rotation.x = -Math.PI / 3;

    const tailSeg2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), whiteFurMat);
    tailSeg2.position.set(0, 0.32, 0.08);
    tailSeg2.rotation.x = Math.PI / 2.5;

    tail.add(tailSeg1, tailSeg2);
    dogRoot.add(tail);

    // 4. Legs & Paws (White front stockings/socks)
    const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    const pawGeo = new THREE.BoxGeometry(0.18, 0.1, 0.22);

    const createLeg = (x: number, z: number, isFront: boolean) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.35, z);

      const upperMat = isFront ? whiteFurMat : darkFurMat;
      const legMesh = new THREE.Mesh(legGeo, upperMat);
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      const pawMesh = new THREE.Mesh(pawGeo, whiteFurMat);
      pawMesh.position.set(0, -0.25, 0.03);
      pawMesh.castShadow = true;
      legGroup.add(pawMesh);

      dogRoot.add(legGroup);
      return legGroup;
    };

    const frontLeftLeg = createLeg(-0.25, 0.4, true);
    const frontRightLeg = createLeg(0.25, 0.4, true);
    const backLeftLeg = createLeg(-0.25, -0.38, false);
    const backRightLeg = createLeg(0.25, -0.38, false);

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

      // Smooth camera / podium orbit interpolation
      dogRoot.rotation.y += (targetRotationY - dogRoot.rotation.y) * 0.1;
      dogRoot.rotation.x += (targetRotationX - dogRoot.rotation.x) * 0.1;

      // 1. Idle breathing
      const breath = Math.sin(elapsed * 2.8) * 0.02;
      torso.scale.set(1 + breath, 1 + breath * 0.8, 1);

      // 2. Tail Wagging dynamics
      let wagFreq = 4.0;
      let wagAmp = 0.25;

      if (interactionState.current.type === 'pet' || interactionState.current.type === 'feed') {
        wagFreq = 14.0;
        wagAmp = 0.55;
      } else if (interactionState.current.type === 'play') {
        wagFreq = 18.0;
        wagAmp = 0.7;
      }
      tail.rotation.y = Math.sin(elapsed * wagFreq) * wagAmp;
      tail.rotation.z = Math.cos(elapsed * wagFreq * 0.5) * 0.1;

      // 3. Head & ear listening twitches
      head.rotation.y = Math.sin(elapsed * 0.8) * 0.08;
      head.rotation.z = Math.sin(elapsed * 1.4) * 0.04;
      leftEar.rotation.z = Math.sin(elapsed * 3.5) * 0.06;
      rightEar.rotation.z = -Math.cos(elapsed * 3.2) * 0.06;

      // 4. Tongue peek bob
      tongue.position.y = -0.19 + Math.sin(elapsed * 2.8) * 0.01;

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
    <div
      className="relative w-full h-full min-h-[300px] bg-black border-hairline overflow-hidden select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Viewport HUD Overlays (Dieter Rams / Vignelli style) */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-mono text-[10px] text-zinc-400 tracking-wider uppercase">
          LIVE 3D AVATAR // {dog.breed}
        </span>
      </div>

      <div className="absolute top-2 right-2 pointer-events-none">
        <span className="font-mono text-[10px] text-zinc-500 border-hairline px-1.5 py-0.5 bg-black/80">
          DRAG TO ORBIT · CLICK TO PET
        </span>
      </div>

      {/* Floating prompt when hovered */}
      {isHovered && (
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <span className="font-mono text-[10px] text-amber-500 bg-black/90 border border-amber-500/40 px-2 py-0.5">
            EXPO · 5Y // THAI BANGKAEW
          </span>
        </div>
      )}
    </div>
  );
};
