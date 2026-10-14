import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { poseAt } from './pose.js';
import { pixelRatio } from './detect.js';

const HEAD = new THREE.Vector3(0, 0.28, 0.02);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bustGeometry() {
  const profile = [
    [0.0, -1.42],
    [0.92, -1.36],
    [0.7, -1.22],
    [0.42, -1.05],
    [0.3, -0.84],
    [0.26, -0.64],
    [0.3, -0.46],
    [0.4, -0.3],
    [0.5, -0.12],
    [0.52, 0.04],
    [0.5, 0.2],
    [0.51, 0.38],
    [0.5, 0.56],
    [0.46, 0.76],
    [0.36, 0.96],
    [0.22, 1.1],
    [0.0, 1.2],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(profile, 72);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    x *= 0.9;
    if (z < 0 && y > -0.3) z *= 0.93;

    if (y < 0.12 && y > -0.38) {
      const k = 1 - Math.abs(y + 0.1) / 0.42;
      x *= 1 + Math.max(0, k) * 0.07;
    }

    if (z > 0.05) {
      const noseX = Math.exp(-(x ** 2) / 0.012);
      const bridge = Math.exp(-((y - 0.1) ** 2) / 0.03) * noseX;
      const tip = Math.exp(-((y + 0.02) ** 2) / 0.006) * Math.exp(-(x ** 2) / 0.008);
      const nostrils = Math.exp(-((y + 0.08) ** 2) / 0.004) * Math.exp(-((Math.abs(x) - 0.07) ** 2) / 0.0015);
      z += bridge * 0.22 + tip * 0.2 - nostrils * 0.07;

      const brow = Math.exp(-((y - 0.34) ** 2) / 0.012) * Math.exp(-((Math.abs(x) - 0.16) ** 2) / 0.02);
      z += brow * 0.09;

      for (const ex of [-0.17, 0.17]) {
        const dx = (x - ex) / 0.11;
        const dy = (y - 0.2) / 0.07;
        const d = dx * dx + dy * dy;
        if (d < 1) z -= (1 - d) * 0.13;
      }

      const mouth = Math.exp(-((y + 0.2) ** 2) / 0.004) * Math.exp(-(x ** 2) / 0.012);
      const lip = Math.exp(-((y + 0.26) ** 2) / 0.003) * Math.exp(-(x ** 2) / 0.01);
      z += lip * 0.06 - mouth * 0.045;

      if (y < -0.28 && y > -0.48) {
        const chin = Math.exp(-((y + 0.38) ** 2) / 0.01) * Math.exp(-(x ** 2) / 0.02);
        z += chin * 0.1;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function earGeometry() {
  const geo = new THREE.SphereGeometry(0.15, 18, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    x *= 0.36;
    y *= 1.2;
    z *= 0.55;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function placeGeometry(geo, position, mirror = false) {
  const next = geo.clone();
  const matrix = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion(),
    new THREE.Vector3(mirror ? -1 : 1, 1, 1),
  );
  next.applyMatrix4(matrix);
  return next;
}

function buildPlaster() {
  const head = bustGeometry();
  const ear = earGeometry();
  const left = placeGeometry(ear, new THREE.Vector3(-0.5, 0.08, 0));
  const right = placeGeometry(ear, new THREE.Vector3(0.5, 0.08, 0), true);
  const merged = mergeGeometries([head, left, right]);
  head.dispose();
  ear.dispose();
  left.dispose();
  right.dispose();
  merged.computeVertexNormals();
  const pos = merged.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    let shade = 1;
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z > 0.15) {
      for (const ex of [-0.17, 0.17]) {
        const d = ((x - ex) / 0.1) ** 2 + ((y - 0.2) / 0.06) ** 2;
        if (d < 1) shade = Math.min(shade, 0.45 + d * 0.4);
      }
      const mouth = Math.exp(-((y + 0.22) ** 2) / 0.0025) * Math.exp(-(x ** 2) / 0.01);
      shade = Math.min(shade, 1 - mouth * 0.35);
    }
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

function onHead(phi, theta, lift) {
  const rx = 0.5;
  const ry = 0.58;
  const rz = 0.52;
  const sp = Math.sin(phi);
  const p = new THREE.Vector3(
    sp * Math.cos(theta) * rx,
    Math.cos(phi) * ry + 0.34,
    sp * Math.sin(theta) * rz,
  );
  const n = p.clone().sub(HEAD).normalize();
  p.addScaledVector(n, lift);
  return p;
}

function createCard(length, width, bend) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 5);
  geo.translate(0, length / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const t = y / length;
    pos.setZ(i, Math.sin(t * Math.PI) * bend);
    pos.setX(i, pos.getX(i) * (1 - t * 0.7));
  }
  geo.computeVertexNormals();
  return geo;
}

function orientCard(geo, direction, normalHint, twist = 0) {
  const y = direction.clone().normalize();
  const z = normalHint.clone();
  z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 1e-6) z.set(0, 0, 1);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  if (twist) {
    const spin = new THREE.Quaternion().setFromAxisAngle(y, twist);
    x.applyQuaternion(spin);
    z.applyQuaternion(spin);
  }
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z));
}

function cardAt(origin, direction, length, width, bend, noise, mode, normalHint, twist = 0) {
  const geo = createCard(length, width, bend);
  orientCard(geo, direction, normalHint, twist);
  geo.translate(origin.x, origin.y, origin.z);
  const count = geo.attributes.position.count;
  const noises = new Float32Array(count).fill(noise);
  const modes = new Float32Array(count).fill(mode);
  geo.setAttribute('aNoise', new THREE.BufferAttribute(noises, 1));
  geo.setAttribute('aMode', new THREE.BufferAttribute(modes, 1));
  return geo;
}

function buildHair(mobile) {
  const rng = mulberry32(20261014);
  const geos = [];
  const messyCount = mobile ? 64 : 110;
  const topCount = mobile ? 36 : 60;
  const fadeCount = mobile ? 50 : 86;

  const clumps = Array.from({ length: Math.ceil(messyCount / 4) }, () => ({
    phi: 0.28 + rng() * 1.05,
    theta: Math.PI * 0.5 + (rng() - 0.5) * 2.6,
    len: 0.2 + rng() * 0.22,
    width: 0.02 + rng() * 0.018,
    bend: (rng() - 0.35) * 0.2,
    flop: rng(),
  }));

  for (let i = 0; i < messyCount; i += 1) {
    const clump = clumps[i % clumps.length];
    const phi = clump.phi + (rng() - 0.5) * 0.14;
    const theta = clump.theta + (rng() - 0.5) * 0.16;
    const origin = onHead(phi, theta, 0.015);
    const radial = origin.clone().sub(HEAD).normalize();
    const dir = radial.clone();
    dir.y = dir.y * 0.2 - 0.15;
    dir.x += (rng() - 0.5) * 0.35;
    dir.z += (rng() - 0.5) * 0.25;
    if (clump.flop > 0.58) dir.z += 0.85;
    const facing = radial.clone().add(new THREE.Vector3(0, 0.15, 0.85)).normalize();
    geos.push(cardAt(
      origin,
      dir,
      clump.len * (0.85 + rng() * 0.3),
      clump.width,
      clump.bend,
      rng(),
      0,
      facing,
      (rng() - 0.5) * 0.4,
    ));
  }

  for (let i = 0; i < topCount; i += 1) {
    const phi = 0.12 + rng() * 0.78;
    const theta = Math.PI * 0.2 + rng() * Math.PI * 0.6;
    const origin = onHead(phi, theta, 0.02);
    const radial = origin.clone().sub(HEAD).normalize();
    const dir = radial.clone();
    dir.z -= 1.05;
    dir.x += 0.4;
    dir.y += 0.12;
    const facing = radial.clone().add(new THREE.Vector3(0, 0.2, 0.5)).normalize();
    geos.push(cardAt(origin, dir, 0.12 + rng() * 0.1, 0.022, 0.05, rng(), 1, facing, (rng() - 0.5) * 0.2));
  }

  for (let i = 0; i < fadeCount; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const origin = new THREE.Vector3(
      side * (0.44 + rng() * 0.08),
      -0.28 + rng() * 1.12,
      -0.4 + rng() * 0.82,
    );
    const radial = origin.clone().sub(HEAD).normalize();
    const dir = radial.clone();
    dir.y = -0.45;
    geos.push(cardAt(origin, dir, 0.03 + rng() * 0.028, 0.016, 0.004, rng(), 1, radial, rng() * 0.4));
  }

  const merged = mergeGeometries(geos);
  for (const geo of geos) geo.dispose();
  if (!merged) throw new Error('Nie udało się złożyć włosów.');

  const pos = merged.attributes.position;
  const height = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i += 1) {
    height[i] = THREE.MathUtils.clamp((pos.getY(i) + 0.35) / 1.55, 0, 1);
  }
  merged.setAttribute('aH', new THREE.BufferAttribute(height, 1));
  return merged;
}

function hairMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const uniforms = { uCut: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = uniforms.uCut;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       attribute float aNoise;
       attribute float aMode;
       attribute float aH;
       varying float vNoise;
       varying float vMode;
       varying float vH;`,
    ).replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
       vNoise = aNoise;
       vMode = aMode;
       vH = aH;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uCut;
       varying float vNoise;
       varying float vMode;
       varying float vH;`,
    ).replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
       float along = 1.0 - vH;
       float field = along + (vNoise - 0.5) * 0.16;
       if (vMode < 0.5) {
         if (field < uCut) discard;
       } else if (field > uCut + 0.012) {
         discard;
       }`,
    ).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 hairTint = mix(vec3(0.24, 0.16, 0.12), vec3(0.075, 0.065, 0.058), step(0.5, vMode));
       diffuseColor.rgb *= hairTint * mix(0.8, 1.08, vNoise);`,
    ).replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float edge = abs(field - uCut);
       if (uCut > 0.025 && uCut < 0.97 && edge < 0.045) {
         totalEmissiveRadiance += vec3(1.15, 0.88, 0.46) * (1.0 - edge / 0.045);
       }`,
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'atelier-hair-v1';
  material.userData.uniforms = uniforms;
  return material;
}

function strandGeometry() {
  const geo = new THREE.PlaneGeometry(0.008, 0.17, 1, 4);
  geo.translate(0, -0.085, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = THREE.MathUtils.clamp(-pos.getY(i) / 0.17, 0, 1);
    pos.setX(i, pos.getX(i) * (1 - t * 0.7));
    pos.setZ(i, Math.sin(t * Math.PI) * 0.018);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildStrands(mobile) {
  const count = mobile ? 180 : 380;
  const rng = mulberry32(481516);
  const geo = strandGeometry();
  const seeds = new Float32Array(count);
  const spawns = new Float32Array(count);
  const base = new Float32Array(count * 3);
  const yaw = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const phi = 0.2 + rng() * 1.35;
    const theta = rng() * Math.PI * 2;
    const p = onHead(phi, theta, 0.04);
    if (rng() > 0.55) {
      p.y = -0.2 + rng() * 1.15;
      p.x = (rng() > 0.5 ? 1 : -1) * (0.4 + rng() * 0.12);
      p.z = -0.25 + rng() * 0.7;
    }
    base[i * 3] = p.x;
    base[i * 3 + 1] = p.y;
    base[i * 3 + 2] = p.z;
    const h = THREE.MathUtils.clamp((p.y + 0.2) / 1.3, 0, 1);
    spawns[i] = THREE.MathUtils.clamp((1 - h) * 0.9 + (rng() - 0.5) * 0.06, 0.02, 0.96);
    seeds[i] = rng();
    yaw[i] = rng() * Math.PI;
  }

  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.setAttribute('aSpawn', new THREE.InstancedBufferAttribute(spawns, 1));

  const material = new THREE.MeshStandardMaterial({
    color: 0x2a211b,
    roughness: 0.68,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const uniforms = { uCut: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = uniforms.uCut;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       attribute float aSeed;
       attribute float aSpawn;
       uniform float uCut;
       varying float vFade;`,
    ).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float life = clamp((uCut - aSpawn) * 3.7, 0.0, 1.0);
       vFade = smoothstep(0.0, 0.045, life) * (1.0 - smoothstep(0.72, 0.96, life));
       float spin = life * (aSeed - 0.5) * 2.6;
       float cs = cos(spin);
       float sn = sin(spin);
       transformed.x += sin(aSeed * 6.28318) * life * life * 0.34;
       transformed.z += cos(aSeed * 4.1) * life * life * 0.24;
       vec2 xz = transformed.xz;
       transformed.x = cs * xz.x - sn * xz.y;
       transformed.z = sn * xz.x + cs * xz.y;
       transformed.y -= life * life * 1.65;
       if (vFade < 0.02) transformed.y -= 30.0;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying float vFade;`,
    ).replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
       if (vFade < 0.02) discard;
       float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
       if (dither > vFade) discard;`,
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'atelier-strand-v1';
  material.userData.uniforms = uniforms;

  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return { mesh, base, yaw, count, uniforms };
}

function compatibleGeometry(geo) {
  const source = geo.index ? geo.toNonIndexed() : geo;
  const clean = new THREE.BufferGeometry();
  clean.setAttribute('position', source.getAttribute('position').clone());
  if (source.getAttribute('normal')) clean.setAttribute('normal', source.getAttribute('normal').clone());
  else clean.computeVertexNormals();
  const uv = source.getAttribute('uv');
  if (uv) clean.setAttribute('uv', uv.clone());
  else {
    const count = clean.getAttribute('position').count;
    clean.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return clean;
}

function bladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.02, 0.16, 0.028, 0.48, 0.008, 0.78);
  shape.lineTo(0, 0.86);
  shape.lineTo(-0.012, 0.7);
  shape.bezierCurveTo(-0.012, 0.4, -0.006, 0.12, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -0.007);
  return geo;
}

function createScissors(metal) {
  const blade = compatibleGeometry(bladeGeometry());
  const ring = new THREE.TorusGeometry(0.058, 0.011, 8, 18);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, -0.075, 0);
  const upperGeo = mergeGeometries([blade, compatibleGeometry(ring)]);
  if (!upperGeo) throw new Error('Nie udało się złożyć nożyczek.');
  const lowerGeo = upperGeo.clone();
  lowerGeo.scale(-1, 1, 1);
  lowerGeo.computeVertexNormals();

  const upper = new THREE.Group();
  const lower = new THREE.Group();
  upper.add(new THREE.Mesh(upperGeo, metal));
  lower.add(new THREE.Mesh(lowerGeo, metal));

  const root = new THREE.Group();
  root.add(upper, lower);
  const screw = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 12), metal);
  root.add(screw);
  root.userData.upper = upper;
  root.userData.lower = lower;
  root.scale.setScalar(1.02);
  return root;
}

function razorBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.02, 0.08);
  shape.lineTo(0.11, 0.14);
  shape.lineTo(0.13, 0.55);
  shape.lineTo(0.02, 0.62);
  shape.lineTo(0, 0.5);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.translate(0, 0, -0.006);
  return geo;
}

function createRazor(metal, horn) {
  const handle = new THREE.BoxGeometry(0.045, 0.48, 0.026);
  handle.translate(0, -0.16, 0);
  const bladeGeo = compatibleGeometry(razorBladeGeometry());
  const root = new THREE.Group();
  root.add(new THREE.Mesh(handle, horn));
  root.add(new THREE.Mesh(bladeGeo, metal));
  root.scale.setScalar(1.15);
  return root;
}

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const basis = new THREE.Matrix4();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const toward = new THREE.Vector3();

function alignTool(object, pos, tangent) {
  yAxis.copy(tangent).normalize();
  toward.copy(HEAD).sub(pos);
  if (toward.lengthSq() < 1e-4) toward.set(0, 0, 1);
  toward.normalize();
  xAxis.copy(toward).addScaledVector(yAxis, -toward.dot(yAxis));
  if (xAxis.lengthSq() < 1e-5) xAxis.set(1, 0, 0);
  xAxis.normalize();
  zAxis.crossVectors(xAxis, yAxis).normalize();
  xAxis.crossVectors(yAxis, zAxis).normalize();
  basis.makeBasis(xAxis, yAxis, zAxis);
  object.quaternion.setFromRotationMatrix(basis);
  object.position.copy(pos);
}

function fitCamera(camera, cam, look, aspect) {
  const fit = aspect < 0.85 ? THREE.MathUtils.lerp(1.38, 1.08, aspect / 0.85) : 1;
  const target = new THREE.Vector3(look[0], look[1], look[2]);
  const position = new THREE.Vector3(cam[0], cam[1], cam[2]);
  const offset = position.sub(target);
  offset.x *= fit;
  offset.z *= fit;
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
}

export function createHeroScene(canvas, { capture = false, mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: capture,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.setClearColor(0x101114, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101114);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.72;
  env.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose?.();
  });
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xf4efe6, 0x2a241e, 0.18));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.5);
  key.position.set(1.4, 1.5, 2.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d0dc, 0.28);
  fill.position.set(-2.4, 0.8, 1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf0d7a4, 0.4);
  rim.position.set(-1.4, 1.6, -2.4);
  scene.add(rim);
  const glint = new THREE.PointLight(0xfff8ee, 0, 3.2, 1.6);
  scene.add(glint);

  const plaster = new THREE.MeshStandardMaterial({
    color: 0xcbbba6,
    roughness: 0.94,
    metalness: 0.02,
    vertexColors: true,
  });
  const bust = new THREE.Group();
  bust.add(new THREE.Mesh(buildPlaster(), plaster));
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.84, 0.14, 40),
    new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.58, metalness: 0.22 }),
  );
  plinth.position.y = -1.48;
  bust.add(plinth);
  const hair = new THREE.Mesh(buildHair(mobile), hairMaterial());
  bust.add(hair);
  scene.add(bust);

  const strands = buildStrands(mobile);
  scene.add(strands.mesh);

  const metal = new THREE.MeshStandardMaterial({
    color: 0xd5dae0,
    metalness: 1,
    roughness: 0.16,
    side: THREE.DoubleSide,
    envMapIntensity: 1.15,
  });
  const horn = new THREE.MeshStandardMaterial({
    color: 0x3a3128,
    metalness: 0.35,
    roughness: 0.48,
  });
  const scissors = createScissors(metal);
  const razor = createRazor(metal, horn);
  scene.add(scissors, razor);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.56;
  scene.add(shadow);

  const scissorPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 1.95, 0.5),
    new THREE.Vector3(0.95, 1.05, 0.62),
    new THREE.Vector3(0.82, 0.62, 0.02),
    new THREE.Vector3(0.2, 0.98, -0.5),
    new THREE.Vector3(-0.7, 0.68, 0.02),
    new THREE.Vector3(-0.15, 1.08, 0.58),
  ], false, 'catmullrom', 0.35);
  const razorPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.85, 2.05, 0.35),
    new THREE.Vector3(0.78, 0.9, 0.5),
    new THREE.Vector3(0.66, 0.38, 0.42),
    new THREE.Vector3(0.5, -0.02, 0.28),
    new THREE.Vector3(0.3, -0.38, 0.02),
  ], false, 'catmullrom', 0.4);

  const crossScissors = new THREE.Vector3(1.35, 0.05, 1.05);
  const crossRazor = new THREE.Vector3(1.15, -0.15, 1.2);
  const crossQuatS = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -0.4, 0.7));
  const crossQuatR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.5, -0.85));
  const dummy = new THREE.Object3D();
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  let progress = 0;
  let elapsed = 0;
  let lastCalls = 0;
  let raf = 0;
  let lastTime = 0;
  let running = false;

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const ratio = capture ? 1 : pixelRatio();
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function updateStrands(rotY) {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    for (let i = 0; i < strands.count; i += 1) {
      const x = strands.base[i * 3];
      const y = strands.base[i * 3 + 1];
      const z = strands.base[i * 3 + 2];
      dummy.position.set(x * c + z * s, y, -x * s + z * c);
      dummy.rotation.set(0, strands.yaw[i], 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      strands.mesh.setMatrixAt(i, dummy.matrix);
    }
    strands.mesh.instanceMatrix.needsUpdate = true;
  }

  function sync(p, time) {
    progress = p;
    const pose = poseAt(p);
    const idle = 1 - THREE.MathUtils.smoothstep(p, 0.05, 0.2);
    bust.rotation.set(
      Math.sin(time * 0.45) * 0.008 * idle,
      pose.rot + Math.sin(time * 0.55) * 0.012 * idle,
      Math.sin(time * 0.7) * 0.012 * idle,
    );

    const cut = pose.cut;
    if (hair.material.userData.uniforms) hair.material.userData.uniforms.uCut.value = cut;
    strands.uniforms.uCut.value = cut;
    updateStrands(bust.rotation.y);

    const st = THREE.MathUtils.clamp(pose.sc, 0, 1);
    const rt = THREE.MathUtils.clamp(pose.rz, 0, 1);
    scissorPath.getPointAt(st, point);
    scissorPath.getTangentAt(st, tangent);
    point.y += pose.lift * 1.4;
    alignTool(scissors, point, tangent);
    scissors.position.lerp(crossScissors, pose.cross);
    scissors.quaternion.slerp(crossQuatS, pose.cross);
    scissors.userData.upper.rotation.z = pose.open;
    scissors.userData.lower.rotation.z = -pose.open;

    razorPath.getPointAt(rt, point);
    razorPath.getTangentAt(rt, tangent);
    point.y += pose.lift * 1.25;
    alignTool(razor, point, tangent);
    razor.position.lerp(crossRazor, pose.cross);
    razor.quaternion.slerp(crossQuatR, pose.cross);

    glint.position.copy(scissors.position).add(new THREE.Vector3(0.2, 0.3, 0.4));
    glint.intensity = pose.glint;
    rim.intensity = pose.rim;

    fitCamera(camera, pose.cam, pose.look, camera.aspect);
  }

  function render(dt = 0) {
    elapsed += dt;
    sync(progress, elapsed);
    renderer.render(scene, camera);
    lastCalls = renderer.info.render.calls;
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    render(dt);
  }

  const observer = new ResizeObserver(() => {
    resize();
    render(0);
  });
  observer.observe(canvas.parentElement || canvas);
  resize();
  render(0);

  return {
    applyProgress(p) {
      progress = p;
      if (!running) render(0);
    },
    render,
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    getDrawCalls: () => lastCalls,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
    },
  };
}
