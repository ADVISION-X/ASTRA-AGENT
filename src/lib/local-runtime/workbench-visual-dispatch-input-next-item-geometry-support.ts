const DEFAULT_LOCAL_RUNTIME_CLICK_SAFETY_MARGIN_PX = 4;
const NEXT_VIDEO_ARROW_WIDTH = 72;
const NEXT_VIDEO_ARROW_HEIGHT = 108;
const NEXT_VIDEO_ARROW_RIGHT_INSET = 28;
const NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO = 0.72;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export const clampViewportGeometry = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const minimumSafeDimension = DEFAULT_LOCAL_RUNTIME_CLICK_SAFETY_MARGIN_PX * 2 + 1;
  const width = clamp(Math.max(input.bbox.width, minimumSafeDimension), 1, Math.max(input.viewportWidth, 1));
  const height = clamp(Math.max(input.bbox.height, minimumSafeDimension), 1, Math.max(input.viewportHeight, 1));
  const x = clamp(input.bbox.x, 0, Math.max(input.viewportWidth - width, 0));
  const y = clamp(input.bbox.y, 0, Math.max(input.viewportHeight - height, 0));
  const safeInsetX = Math.min(DEFAULT_LOCAL_RUNTIME_CLICK_SAFETY_MARGIN_PX, Math.floor(width / 2));
  const safeInsetY = Math.min(DEFAULT_LOCAL_RUNTIME_CLICK_SAFETY_MARGIN_PX, Math.floor(height / 2));

  return {
    bbox: { x, y, width, height },
    clickPoint: {
      x: clamp(input.clickPoint.x, x + safeInsetX, x + width - safeInsetX),
      y: clamp(input.clickPoint.y, y + safeInsetY, y + height - safeInsetY),
    },
  };
};

const isSourceGeometryOutsideViewport = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
}) => input.bbox.x < 0
  || input.bbox.y < 0
  || input.bbox.x + input.bbox.width > input.viewportWidth
  || input.bbox.y + input.bbox.height > input.viewportHeight
  || input.clickPoint.x < 0
  || input.clickPoint.y < 0
  || input.clickPoint.x > input.viewportWidth
  || input.clickPoint.y > input.viewportHeight;

export const shouldProjectSourceGeometryToViewport = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  coordinateSpace: string | null;
}) => input.coordinateSpace !== null && input.coordinateSpace !== "browserViewport"
  ? true
  : isSourceGeometryOutsideViewport(input);

export const projectSourceGeometryToViewport = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const scaleX = input.viewportWidth / Math.max(input.sourceWidth, 1);
  const scaleY = input.viewportHeight / Math.max(input.sourceHeight, 1);

  return {
    bbox: {
      x: Math.round(input.bbox.x * scaleX),
      y: Math.round(input.bbox.y * scaleY),
      width: Math.max(1, Math.round(input.bbox.width * scaleX)),
      height: Math.max(1, Math.round(input.bbox.height * scaleY)),
    },
    clickPoint: {
      x: Math.round(input.clickPoint.x * scaleX),
      y: Math.round(input.clickPoint.y * scaleY),
    },
  };
};

export const buildNextVideoArrowGeometry = (input: {
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const bboxWidth = clamp(NEXT_VIDEO_ARROW_WIDTH, 48, input.viewportWidth);
  const bboxHeight = clamp(NEXT_VIDEO_ARROW_HEIGHT, 64, input.viewportHeight);
  const bboxX = clamp(
    input.viewportWidth - NEXT_VIDEO_ARROW_RIGHT_INSET - bboxWidth,
    0,
    Math.max(input.viewportWidth - bboxWidth, 0),
  );
  const bboxY = clamp(
    Math.round(input.viewportHeight / 2) - Math.round(bboxHeight / 2),
    0,
    Math.max(input.viewportHeight - bboxHeight, 0),
  );

  return {
    bbox: {
      x: bboxX,
      y: bboxY,
      width: bboxWidth,
      height: bboxHeight,
    },
    clickPoint: {
      x: bboxX + Math.round(bboxWidth / 2),
      y: clamp(
        bboxY + Math.round(bboxHeight * NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO),
        bboxY + 1,
        bboxY + bboxHeight - 1,
      ),
    },
  };
};