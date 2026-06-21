import {
  type CurrentUserdata,
  matchCurrentUserdata,
  resolveCurrentUserdataRoot,
} from "./detect";
import type { Registry } from "./registry";

export interface EditorHostSessionInput {
  globalStoragePath: string;
  defaultUserdataRoot: string;
  storeRoot: string;
}

export class EditorHostSession {
  constructor(private readonly input: EditorHostSessionInput) {}

  currentUserdata(registry: Registry): CurrentUserdata {
    return matchCurrentUserdata({
      globalStoragePath: this.input.globalStoragePath,
      defaultUserdataRoot: this.input.defaultUserdataRoot,
      storeRoot: this.input.storeRoot,
      registry,
    });
  }

  currentUserdataRoot(current: CurrentUserdata): string | null {
    return resolveCurrentUserdataRoot({
      current,
      globalStoragePath: this.input.globalStoragePath,
      defaultUserdataRoot: this.input.defaultUserdataRoot,
      storeRoot: this.input.storeRoot,
    });
  }
}
