import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TABLE } from '@flipper/contracts';
import { createElectricity, type SparkEffect } from '../effects/electricity';

interface BumperInstance {
  id: string;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  hitAction: THREE.AnimationAction | null;
  // Fallback animation state when the GLB has no clips
  basePosY: number;
  baseScale: number;
  hitFallback: number; // remaining time of the procedural punch (seconds), 0 = idle
}

export interface JellyfishBumpers {
  hit: (id: string) => void;
  tick: (dt: number) => void;
}

// Visual tuning — jellyfish stand a bit taller than the squat bumper they replace.
const SCALE_MULT = 1.25;
const Y_OFFSET = 0.4;
const HIT_FALLBACK_DURATION = 0.35;

function pickClip(
  clips: THREE.AnimationClip[],
  patterns: RegExp[],
  fallbackIndex: number,
): THREE.AnimationClip | null {
  for (const pat of patterns) {
    const found = clips.find((c) => pat.test(c.name));
    if (found) return found;
  }
  return clips[fallbackIndex] ?? null;
}

export function createJellyfishBumpers(scene: THREE.Scene): JellyfishBumpers {
  const instances: BumperInstance[] = [];
  const sparks: SparkEffect[] = [];

  const loader = new GLTFLoader();
  loader.load(
    '/models/JellyFish.glb',
    (gltf) => {
      const template = gltf.scene;
      const clips = gltf.animations;

      const idleClip = pickClip(clips, [/idle/i, /float/i, /loop/i], 0);
      const hitClip = pickClip(clips, [/hit/i, /impact/i, /touch/i, /punch/i], 1);

      const tplBox = new THREE.Box3().setFromObject(template);
      const tplSize = tplBox.getSize(new THREE.Vector3());
      const tplRadius = Math.max(tplSize.x, tplSize.z) / 2 || 1;

      for (const b of TABLE.bumpers) {
        // SkeletonUtils.clone keeps skinned meshes hooked to a fresh skeleton
        // — required so each instance can run its own AnimationMixer.
        const root = cloneSkeleton(template);
        const normalize = b.radius / tplRadius;
        const finalScale = normalize * b.scale * SCALE_MULT;
        root.scale.setScalar(finalScale);
        root.position.set(b.x, Y_OFFSET, b.z);
        scene.add(root);

        const mixer = new THREE.AnimationMixer(root);
        let idleAction: THREE.AnimationAction | null = null;
        let hitAction: THREE.AnimationAction | null = null;

        if (idleClip) {
          idleAction = mixer.clipAction(idleClip);
          idleAction.loop = THREE.LoopRepeat;
          idleAction.timeScale = 1;
          // Offset start time so the three jellyfish don't tick in unison
          idleAction.time = Math.random() * idleClip.duration;
          idleAction.play();
        }
        if (hitClip && hitClip !== idleClip) {
          hitAction = mixer.clipAction(hitClip);
          hitAction.loop = THREE.LoopOnce;
          hitAction.clampWhenFinished = true;
        }

        instances.push({
          id: b.id,
          root,
          mixer,
          idleAction,
          hitAction,
          basePosY: root.position.y,
          baseScale: finalScale,
          hitFallback: 0,
        });
      }
    },
    undefined,
    (err) => {
      console.error('[jellyfish-bumpers] failed to load JellyFish.glb', err);
    },
  );

  function triggerHit(inst: BumperInstance): void {
    if (inst.hitAction) {
      inst.hitAction.stop();
      inst.hitAction.reset();
      inst.hitAction.play();
      // After hit animation, idle keeps running (we never stopped it)
    } else {
      // Procedural fallback: squash + slight upward kick
      inst.hitFallback = HIT_FALLBACK_DURATION;
    }
  }

  return {
    hit(id: string): void {
      const inst = instances.find((i) => i.id === id);
      if (!inst) return;
      triggerHit(inst);
      sparks.push(createElectricity(scene, inst.root.position));
    },
    tick(dt: number): void {
      for (const inst of instances) {
        inst.mixer.update(dt);

        // Procedural idle bob (only kicks in if no idleAction was loaded)
        if (!inst.idleAction) {
          const t = performance.now() * 0.002 + inst.basePosY;
          inst.root.position.y = inst.basePosY + Math.sin(t) * 0.06;
        }

        // Procedural hit punch (only kicks in if no hitAction was loaded)
        if (inst.hitFallback > 0) {
          inst.hitFallback = Math.max(0, inst.hitFallback - dt);
          const k = inst.hitFallback / HIT_FALLBACK_DURATION; // 1 → 0
          const punch = Math.sin(k * Math.PI); // 0 → 1 → 0
          inst.root.scale.setScalar(inst.baseScale * (1 + punch * 0.25));
        } else if (!inst.hitAction) {
          inst.root.scale.setScalar(inst.baseScale);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        if (!spark) continue;
        if (!spark.tick(dt)) {
          spark.dispose();
          sparks.splice(i, 1);
        }
      }
    },
  };
}
