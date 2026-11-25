export type ToolType =
  | 'select'
  | 'pen'
  | 'brush'
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'polygon';

export type ElementKind = 'freehand' | 'circle' | 'ellipse' | 'rect' | 'polygon';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface CanvasElement {
  id: string;
  kind: ElementKind;
  /** Center or origin x in logical scene coordinates */
  x: number;
  /** Center or origin y in logical scene coordinates */
  y: number;
  /** Bounding width (for circle, ellipse, rect) */
  width: number;
  /** Bounding height (for circle, ellipse, rect) */
  height: number;
  /** Rotation in radians around element center */
  rotation: number;
  /** Points relative to (0, 0) center for freehand/polygon elements */
  points: Point[];
  /** Whether freehand stroke should be closed and filled */
  closed: boolean;
  /** Fill color (used when !isHole and filled) */
  fillColor: string;
  /** Whether the shape has fill (for freehand pen strokes vs brush/shapes) */
  filled: boolean;
  /** Stroke color */
  strokeColor: string;
  /** Stroke width in logical px */
  strokeWidth: number;
  /** Element opacity (0..1) */
  opacity: number;
  /** Corner radius for rectangles */
  cornerRadius?: number;
  /** If true, this element cuts a real transparent hole out of its layer */
  isHole: boolean;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  /** Base color of this layer */
  color: string;
  /** When true, the layer renders a full-bleed colored sheet that can be punched with holes */
  hasBaseFill: boolean;
  /** Drop shadow onto layers underneath */
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  /** Individual depth multiplier for parallax (0 = static far background, 1+ = foreground) */
  depth: number;
  elements: CanvasElement[];
}

export interface ParallaxSettings {
  enabled: boolean;
  /** Maximum shift in pixels for depth = 1.0 */
  intensity: number;
  /** Smoothing/responsiveness factor (0.04 = dreamy slow, 0.35 = snappy) */
  sensitivity: number;
}

export interface ParallaxOffset {
  x: number;
  y: number;
}

export type HandleType =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate'
  | 'body';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}
