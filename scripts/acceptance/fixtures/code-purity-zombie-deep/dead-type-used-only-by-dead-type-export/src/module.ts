export type LiveShape = UsedShape;
export type DeadExport = DeadShape;

type UsedShape = {
  live: string;
};

type DeadShape = {
  dead: string;
};