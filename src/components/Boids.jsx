import { useAnimations, useGLTF } from "@react-three/drei";

import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import { randFloat, randInt } from "three/src/math/MathUtils.js";
import { themeAtom, THEMES } from "./UI";

function remap(value, low1, high1, low2, high2) {
  return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}

const limits = new Vector3();
const wander = new Vector3();
const horizontalWander = new Vector3();
const alignment = new Vector3();
const avoidance = new Vector3();
const cohesion = new Vector3();

const steering = new Vector3();

export const Boids = ({ boundaries }) => {
  const [theme] = useAtom(themeAtom);

  const { NB_BOIDS, MIN_SCALE, MAX_SCALE, MIN_SPEED, MAX_SPEED, MAX_STEERING } =
    useControls(
      "General settings",
      {
        NB_BOIDS: { value: 100, min: 1, max: 200 },
        MIN_SCALE: { value: 0.7, min: 0.1, max: 2, step: 0.1 },
        MAX_SCALE: { value: 1.3, min: 0.1, max: 2, step: 0.1 },
        MIN_SPEED: { value: 0.9, min: 0, max: 10, step: 0.1 },
        MAX_SPEED: { value: 3.6, min: 0, max: 10, step: 0.1 },
        MAX_STEERING: { value: 0.1, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: true }
    );

  const { threeD, ALIGNEMENT, AVOIDANCE, COHESION } = useControls(
    "Boid Rules",
    {
      threeD: { value: true },
      ALIGNEMENT: { value: true },
      AVOIDANCE: { value: true },
      COHESION: { value: true },
    },
    { collapsed: true }
  );

  const { WANDER_RADIUS, WANDER_STRENGTH, WANDER_CIRCLE } = useControls(
    "Wander",
    {
      WANDER_CIRCLE: false,
      WANDER_RADIUS: { value: 5, min: 1, max: 10, step: 1 },
      WANDER_STRENGTH: { value: 2, min: 0, max: 10, step: 1 },
    },
    { collapsed: true }
  );

  const { ALIGN_RADIUS, ALIGN_STRENGTH, ALIGN_CIRCLE } = useControls(
    "Alignment",
    {
      ALIGN_CIRCLE: false,
      ALIGN_RADIUS: { value: 1.2, min: 0, max: 10, step: 0.1 },
      ALIGN_STRENGTH: { value: 4, min: 0, max: 10, step: 1 },
    },
    { collapsed: true }
  );

  const { AVOID_RADIUS, AVOID_STRENGTH, AVOID_CIRCLE } = useControls(
    "Avoidance",
    {
      AVOID_CIRCLE: false,
      AVOID_RADIUS: { value: 0.8, min: 0, max: 2 },
      AVOID_STRENGTH: { value: 2, min: 0, max: 10, step: 1 },
    },
    { collapsed: true }
  );

  const { COHESION_RADIUS, COHESION_STRENGTH, COHESION_CIRCLE } = useControls(
    "Cohesion",
    {
      COHESION_CIRCLE: false,
      COHESION_RADIUS: { value: 1.22, min: 0, max: 2 },
      COHESION_STRENGTH: { value: 4, min: 0, max: 10, step: 1 },
    },
    { collapsed: true }
  );

  const boids = useMemo(() => {
    return new Array(NB_BOIDS).fill().map((_, i) => ({
      model: THEMES[theme].models[randInt(0, THEMES[theme].models.length - 1)],
      position: new Vector3(
        randFloat(-boundaries.x / 2, boundaries.x / 2),
        randFloat(-boundaries.y / 2, boundaries.y / 2),
        threeD ? randFloat(-boundaries.z / 2, boundaries.z / 2) : 0
      ),
      velocity: new Vector3(0, 0, 0),
      wander: randFloat(0, Math.PI * 2),
      scale: randFloat(MIN_SCALE, MAX_SCALE),
    }));
  }, [NB_BOIDS, boundaries, theme, MIN_SCALE, MAX_SCALE, threeD]);

  useFrame((_, delta) => {
    for (let i = 0; i < boids.length; i++) {
      const boid = boids[i];

      // WANDER
      boid.wander += randFloat(-0.05, 0.05);

      wander.set(
        Math.cos(boid.wander) * WANDER_RADIUS,
        Math.sin(boid.wander) * WANDER_RADIUS,
        0
      );

      wander.normalize();
      wander.multiplyScalar(WANDER_STRENGTH);

      horizontalWander.set(
        Math.cos(boid.wander) * WANDER_RADIUS,
        0,
        Math.sin(boid.wander) * WANDER_RADIUS
      );

      horizontalWander.normalize();
      horizontalWander.multiplyScalar(WANDER_STRENGTH);

      // RESET FORCES
      limits.multiplyScalar(0);
      steering.multiplyScalar(0);
      alignment.multiplyScalar(0);
      avoidance.multiplyScalar(0);
      cohesion.multiplyScalar(0);

      // LIMITS
      if (Math.abs(boid.position.x) + 1 > boundaries.x / 2) {
        limits.x = -boid.position.x;
        boid.wander += Math.PI;
      }
      if (Math.abs(boid.position.y) + 1 > boundaries.y / 2) {
        limits.y = -boid.position.y;
        boid.wander += Math.PI;
      }
      if (Math.abs(boid.position.z) + 1 > boundaries.z / 2) {
        limits.z = -boid.position.z;
        boid.wander += Math.PI;
      }
      limits.normalize();
      limits.multiplyScalar(50);

      let totalCohesion = 0;

      // Loop through all boids
      for (let b = 0; b < boids.length; b++) {
        if (b === i) {
          // skip to get only other boids
          continue;
        }
        const other = boids[b];
        let d = boid.position.distanceTo(other.position);
        // ALIGNEMENT
        if (d > 0 && d < ALIGN_RADIUS) {
          const copy = other.velocity.clone();
          copy.normalize();
          copy.divideScalar(d);
          alignment.add(copy);
        }

        // AVOID
        if (d > 0 && d < AVOID_RADIUS) {
          const diff = boid.position.clone().sub(other.position);
          diff.normalize();
          diff.divideScalar(d);
        }

        // COHESION
        if (d > 0 && d < COHESION_RADIUS) {
          cohesion.add(other.position);
          totalCohesion++;
        }
      }

      // APPLY FORCES

      steering.add(limits);
      steering.add(wander);
      if (threeD) {
        steering.add(horizontalWander);
      }

      if (ALIGNEMENT) {
        alignment.normalize();
        alignment.multiplyScalar(ALIGN_STRENGTH);
        steering.add(alignment);
      }

      if (AVOIDANCE) {
        avoidance.normalize();
        avoidance.multiplyScalar(AVOID_STRENGTH);
        steering.add(avoidance);
      }

      if (COHESION && totalCohesion > 0) {
        cohesion.divideScalar(totalCohesion);
        cohesion.sub(boid.position);
        cohesion.normalize();
        cohesion.multiplyScalar(COHESION_STRENGTH);
        steering.add(cohesion);
      }

      steering.clampLength(0, MAX_STEERING * delta);
      boid.velocity.add(steering);
      boid.velocity.clampLength(
        0,
        remap(boid.scale, MIN_SCALE, MAX_SCALE, MAX_SPEED, MIN_SPEED) * delta
      );

      // APPLY VELOCITY
      boid.position.add(boid.velocity);
    }
  });

  return boids.map((boid, index) => (
    <Boid
      key={index + boid.model}
      position={boid.position}
      model={boid.model}
      scale={boid.scale}
      velocity={boid.velocity}
      animation={"Fish_Armature|Swimming_Fast"}
      wanderCircle={WANDER_CIRCLE}
      wanderRadius={WANDER_RADIUS / boid.scale}
      alignCircle={ALIGN_CIRCLE}
      alignRadius={ALIGN_RADIUS / boid.scale}
      avoidCircle={AVOID_CIRCLE}
      avoidRadius={AVOID_RADIUS / boid.scale}
      cohesionCircle={COHESION_CIRCLE}
      cohesionRadius={COHESION_RADIUS / boid.scale}
    />
  ));
};

const Boid = ({
  position,
  velocity,
  model,
  animation,
  wanderCircle,
  wanderRadius,
  alignCircle,
  alignRadius,
  avoidCircle,
  avoidRadius,
  cohesionCircle,
  cohesionRadius,
  ...props
}) => {
  const { scene, animations } = useGLTF(`/models/${model}.glb`);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const group = useRef();
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
  }, []);

  useEffect(() => {
    actions[animation]?.play();
    return () => {
      actions[animation]?.stop();
    };
  }, [animation]);

  useFrame(() => {
    const target = group.current.clone(false);
    target.lookAt(group.current.position.clone().add(velocity));
    group.current.quaternion.slerp(target.quaternion, 0.1);

    group.current.position.copy(position);
  });

  return (
    <group {...props} ref={group} position={position}>
      <primitive object={clone} rotation-y={Math.PI / 2} />
      <mesh visible={wanderCircle}>
        <sphereGeometry args={[wanderRadius, 32]} />
        <meshBasicMaterial color={"red"} wireframe />
      </mesh>

      <mesh visible={alignCircle}>
        <sphereGeometry args={[alignRadius, 32]} />
        <meshBasicMaterial color={"green"} wireframe />
      </mesh>

      <mesh visible={avoidCircle}>
        <sphereGeometry args={[avoidRadius, 32]} />
        <meshBasicMaterial color={"blue"} wireframe />
      </mesh>

      <mesh visible={cohesionCircle}>
        <sphereGeometry args={[cohesionRadius, 32]} />
        <meshBasicMaterial color={"yellow"} wireframe />
      </mesh>
    </group>
  );
};
