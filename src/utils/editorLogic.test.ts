import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasElement, Layer } from '../types/editor';
import {
  hitTestElement,
  hitTestHandle,
  normalizePointsToCenter,
  resizeElementWithHandle,
  simplifyPoints,
} from './geometry';
import {
  createLayer,
  deleteLayerById,
  duplicateLayer,
  moveLayerBackward,
  moveLayerForward,
  reorderLayer,
} from './layers';
import {
  computeTargetOffsetForLayer,
  displayToScenePoint,
  normalizePointerPosition,
  stepParallaxOffsets,
} from './parallax';
import { exportSceneToSVG } from './renderer';

test('geometry: hitTestElement detects circles, rotated rects, polygons, and holes', () => {
  const circleHole: CanvasElement = {
    id: 'c1',
    kind: 'circle',
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    rotation: 0,
    points: [],
    closed: true,
    fillColor: '#000',
    filled: true,
    strokeColor: '#000',
    strokeWidth: 0,
    opacity: 1,
    isHole: true,
  };
  assert.equal(hitTestElement({ x: 200, y: 200 }, circleHole), true);
  assert.equal(hitTestElement({ x: 245, y: 200 }, circleHole), true);
  assert.equal(hitTestElement({ x: 280, y: 200 }, circleHole), false);

  const polygon: CanvasElement = {
    id: 'p1',
    kind: 'polygon',
    x: 400,
    y: 300,
    width: 100,
    height: 100,
    rotation: 0,
    points: [
      { x: 0, y: -50 },
      { x: 50, y: 50 },
      { x: -50, y: 50 },
    ],
    closed: true,
    fillColor: '#fff',
    filled: true,
    strokeColor: '#000',
    strokeWidth: 2,
    opacity: 1,
    isHole: false,
  };
  assert.equal(hitTestElement({ x: 400, y: 310 }, polygon), true);
  assert.equal(hitTestElement({ x: 400, y: 220 }, polygon), false);
});

test('geometry: resizeElementWithHandle scales width/height and freehand points', () => {
  const rect: CanvasElement = {
    id: 'r1',
    kind: 'rect',
    x: 100,
    y: 100,
    width: 100,
    height: 60,
    rotation: 0,
    points: [],
    closed: true,
    fillColor: '#111',
    filled: true,
    strokeColor: '#111',
    strokeWidth: 0,
    opacity: 1,
    isHole: false,
  };
  const resized = resizeElementWithHandle(rect, 'se', { x: 200, y: 180 });
  assert.equal(Math.round(resized.width), 150);
  assert.equal(Math.round(resized.height), 110);

  const handle = hitTestHandle({ x: 150, y: 130 }, rect);
  assert.equal(handle, 'se');
});

test('geometry: normalizePointsToCenter and simplifyPoints behave deterministically', () => {
  const norm = normalizePointsToCenter([
    { x: 100, y: 100 },
    { x: 200, y: 200 },
  ]);
  assert.equal(norm.x, 150);
  assert.equal(norm.y, 150);
  assert.equal(norm.width, 100);
  assert.equal(norm.height, 100);
  assert.deepEqual(
    norm.points.map((p) => ({ x: p.x, y: p.y })),
    [
      { x: -50, y: -50 },
      { x: 50, y: 50 },
    ]
  );

  const simplified = simplifyPoints(
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ],
    4
  );
  assert.equal(simplified.length, 3);
});

test('layers: forward, backward, reorder, duplicate, and delete maintain stack integrity', () => {
  const l1 = createLayer('Fond', '#111', { depth: 0.2 });
  const l2 = createLayer('Milieu', '#222', { depth: 0.6 });
  const l3 = createLayer('Avant', '#333', { depth: 1.0 });
  let stack: Layer[] = [l1, l2, l3];

  stack = moveLayerBackward(stack, l3.id);
  assert.deepEqual(
    stack.map((l) => l.id),
    [l1.id, l3.id, l2.id]
  );

  stack = moveLayerForward(stack, l1.id);
  assert.deepEqual(
    stack.map((l) => l.id),
    [l3.id, l1.id, l2.id]
  );

  stack = reorderLayer(stack, 0, 2);
  assert.deepEqual(
    stack.map((l) => l.id),
    [l1.id, l2.id, l3.id]
  );

  const dup = duplicateLayer(stack, l2.id);
  assert.equal(dup.layers.length, 4);
  assert.equal(dup.layers[2].name, 'Milieu (copie)');
  assert.notEqual(dup.layers[2].id, l2.id);

  const del = deleteLayerById(dup.layers, dup.duplicatedId!, dup.duplicatedId!);
  assert.equal(del.layers.length, 3);
  assert.notEqual(del.nextActiveId, dup.duplicatedId);
});

test('parallax: foreground layers move more than background layers and smoothly return to zero on leave', () => {
  const bg = createLayer('BG', '#000', { depth: 0.2 });
  const fg = createLayer('FG', '#fff', { depth: 1.2 });
  const layers = [bg, fg];
  const settings = { enabled: true, intensity: 40, sensitivity: 0.2 };

  const norm = normalizePointerPosition(900, 300, {
    left: 0,
    top: 0,
    width: 1200,
    height: 600,
  });
  assert.equal(norm.x, 0.5);
  assert.equal(norm.y, 0);

  const bgTarget = computeTargetOffsetForLayer(norm, true, bg.depth, settings);
  const fgTarget = computeTargetOffsetForLayer(norm, true, fg.depth, settings);
  assert.ok(Math.abs(fgTarget.x) > Math.abs(bgTarget.x));

  // Step interpolation toward target
  let offsets = { [bg.id]: { x: 0, y: 0 }, [fg.id]: { x: 0, y: 0 } };
  for (let i = 0; i < 15; i++) {
    offsets = stepParallaxOffsets(layers, offsets, norm, true, settings).nextOffsets;
  }
  assert.ok(offsets[fg.id].x > offsets[bg.id].x);
  assert.ok(offsets[fg.id].x > 15 && offsets[fg.id].x <= fgTarget.x);

  // Leave canvas -> converges back toward (0,0)
  for (let i = 0; i < 60; i++) {
    offsets = stepParallaxOffsets(layers, offsets, norm, false, settings).nextOffsets;
  }
  assert.equal(offsets[bg.id].x, 0);
  assert.equal(offsets[fg.id].x, 0);

  // Inverse coordinate mapping preserves exact scene alignment under parallax offset
  const scenePt = displayToScenePoint(620, 375, 1200, 750, 1200, 750, { x: 20, y: 0 });
  assert.equal(scenePt.x, 600);
  assert.equal(scenePt.y, 375);
});

test('renderer: SVG export creates mask elements for holes', () => {
  const holeLayer = createLayer('Trou', '#3D5A80', {
    hasBaseFill: true,
    elements: [
      {
        id: 'h1',
        kind: 'circle',
        x: 600,
        y: 375,
        width: 200,
        height: 200,
        rotation: 0,
        points: [],
        closed: true,
        fillColor: '#000',
        filled: true,
        strokeColor: '#000',
        strokeWidth: 0,
        opacity: 1,
        isHole: true,
      },
    ],
  });
  const svg = exportSceneToSVG([holeLayer]);
  assert.ok(svg.includes('<mask id="cutout-mask-0">'));
  assert.ok(svg.includes('mask="url(#cutout-mask-0)"'));
  assert.ok(svg.includes('<ellipse'));
});
