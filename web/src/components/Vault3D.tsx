// The escrow vault: one ring segment per milestone, sized by its amount. Where the money is decides
// the pose (held sits in the vault, paid lifts out, returned drops). Geometry knows nothing of the
// rules; it reads Segment + Pose from lib/escrow. Rendered on demand: frames are drawn only while a
// segment is still moving or the camera is dragged.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { poseTarget, type Pose, type Segment } from '../lib/escrow';

const R_IN = 1.02;
const R_OUT = 1.62;
const HEIGHT = 0.26;

// Data hues from the style sheet: ink for paid, the accent for held, red for returned, amber for a failed check.
const POSE_COLOR: Record<Pose, string> = {
  held: '#4a8ad6',
  checking: '#7fb0ea',
  failed: '#d9a441',
  released: '#f2f2f3',
  returned: '#e5566f',
  unfunded: '#3a3a3e',
};

function sectorGeometry(start: number, end: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R_OUT, start, end, false);
  shape.absarc(0, 0, R_IN, end, start, true);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: HEIGHT, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48,
  });
  g.rotateX(-Math.PI / 2); // lie flat: the shape's XY becomes the ground plane, extrusion goes up
  return g;
}

/** Critically damped spring (Apple's damping 1.0), response in seconds. Pure step of (value, velocity). */
function springStep(x: number, v: number, target: number, dt: number, response = 0.5) {
  const w = (2 * Math.PI) / response;
  const a = -w * w * (x - target) - 2 * w * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv] as const;
}

interface SegProps {
  seg: Segment;
  selected: boolean;
  hovered: boolean;
  reduced: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function SegmentMesh({ seg, selected, hovered, reduced, onSelect, onHover }: SegProps) {
  const geometry = useMemo(() => sectorGeometry(seg.start, seg.end), [seg.start, seg.end]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const state = useRef({ lift: 0, push: 0, op: 1, vl: 0, vp: 0, vo: 0 });
  const invalidate = useThree((s) => s.invalidate);
  const mid = (seg.start + seg.end) / 2;
  const dir = useMemo(() => new THREE.Vector2(Math.cos(mid), -Math.sin(mid)), [mid]);

  // Wake the loop whenever the pose (or hover) changes; useFrame keeps invalidating until settled.
  useEffect(() => { invalidate(); }, [seg.pose, hovered, selected, invalidate]);

  useFrame((_, delta) => {
    const g = ref.current, m = mat.current;
    if (!g || !m) return;
    const t = poseTarget(seg.pose);
    const targetLift = t.lift + (hovered ? 0.06 : 0);
    const s = state.current;
    if (reduced) {
      Object.assign(s, { lift: targetLift, push: t.push, op: t.opacity, vl: 0, vp: 0, vo: 0 });
    } else {
      const dt = Math.min(delta, 1 / 30);
      [s.lift, s.vl] = springStep(s.lift, s.vl, targetLift, dt);
      [s.push, s.vp] = springStep(s.push, s.vp, t.push, dt);
      [s.op, s.vo] = springStep(s.op, s.vo, t.opacity, dt, 0.35);
    }
    g.position.set(dir.x * s.push, s.lift, dir.y * s.push);
    m.opacity = s.op;
    m.transparent = s.op < 0.999;
    const moving = Math.abs(s.lift - targetLift) + Math.abs(s.push - t.push) + Math.abs(s.op - t.opacity) > 1e-3
      || Math.abs(s.vl) + Math.abs(s.vp) + Math.abs(s.vo) > 1e-3;
    if (moving) invalidate();
  });

  return (
    <group ref={ref}>
      <mesh
        geometry={geometry}
        onClick={(e) => { e.stopPropagation(); onSelect(seg.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(seg.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
      >
        <meshStandardMaterial ref={mat} color={POSE_COLOR[seg.pose]} roughness={0.55} metalness={0.15} />
        {(selected || hovered) && <Edges threshold={20} color={selected ? '#4a8ad6' : '#8a8c92'} />}
      </mesh>
    </group>
  );
}

function VaultBody() {
  const ring = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 1.82, 0.001, Math.sin(a) * 1.82);
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <group>
      {/* the vault floor the held segments rest in */}
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[1.9, 1.95, 0.18, 96]} />
        <meshStandardMaterial color="#1d1c21" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.0, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.92, 64]} />
        <meshStandardMaterial color="#131217" roughness={1} />
      </mesh>
      <lineLoop geometry={ring}>
        <lineBasicMaterial color="#3a3a3e" />
      </lineLoop>
    </group>
  );
}

export interface VaultProps {
  segments: Segment[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  reduced: boolean;
}

export default function Vault3D({ segments, selectedId, hoveredId, onSelect, onHover, reduced }: VaultProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 3.5, 5.1], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
      aria-hidden="true"
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#131217', 0.6]} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
      <group rotation-y={0}>
        <VaultBody />
        {segments.map((s) => (
          <SegmentMesh
            key={s.id}
            seg={s}
            selected={s.id === selectedId}
            hovered={s.id === hoveredId}
            reduced={reduced}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </group>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        target={[0, 0.1, 0]}
        enableDamping={!reduced}
      />
    </Canvas>
  );
}
