declare module "sharp" {
  export type ResizeOptions = {
    width?: number | undefined;
    height?: number | undefined;
    fit?: string;
    withoutEnlargement?: boolean;
  };

  export type Region = {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  export type SharpMetadata = {
    width?: number;
    height?: number;
    format?: string;
  };

  export type SharpOutputInfo = {
    size: number;
    width: number;
    height: number;
  };

  export type SharpCreateInput = {
    create: {
      width: number;
      height: number;
      channels: number;
      background: {
        r: number;
        g: number;
        b: number;
        alpha?: number;
      };
    };
  };

  export interface Sharp {
    rotate(): Sharp;
    resize(options: ResizeOptions): Sharp;
    extract(region: Region): Sharp;
    jpeg(options?: { quality?: number; mozjpeg?: boolean }): Sharp;
    png(options?: { quality?: number }): Sharp;
    webp(options?: { quality?: number }): Sharp;
    metadata(): Promise<SharpMetadata>;
    toFile(filePath: string): Promise<SharpOutputInfo>;
    toBuffer(): Promise<Buffer>;
  }

  export type SharpInput = string | Buffer | SharpCreateInput;

  const sharp: (input?: SharpInput) => Sharp;
  export default sharp;
}
