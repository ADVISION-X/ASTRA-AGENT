export const DEFAULT_VISUAL_MISSION_GRID_ROW_COUNT = 12;
export const DEFAULT_VISUAL_MISSION_GRID_COLUMN_COUNT = 50;
export const MIN_VISUAL_MISSION_GRID_CELL_WIDTH_PX = 32;
export const MIN_VISUAL_MISSION_GRID_CELL_HEIGHT_PX = 32;
export const VISUAL_MISSION_GRID_VERSION = "visual-grid.v1" as const;
export const VISUAL_MISSION_AXIS_MODE = "y_letters_x_numbers" as const;
export const VISUAL_MISSION_COORDINATE_INSTRUCTION = "Use grid cells only. Y axis is letters. X axis is numbers. Example: A30, C50. Never output raw x/y.";