export type ForensicsArtifactRef = {
  artifactType: "file" | "image" | "packet" | "snapshot" | "log" | "record";
  artifactId: string;
  storageRef: string | null;
  integrityHash?: string | null;
};