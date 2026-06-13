import {
  ensureDefaultUserdata,
  loadRegistry,
  type Registry,
  saveRegistry,
} from "./registry";

interface RegistryUpdateResult<T> {
  registry: Registry;
  result: T;
}

export class UserdataRegistryStore {
  constructor(private readonly registryFile: string) {}

  ensureInitialized(): Registry {
    return this.update((latest) => latest);
  }

  read(): Registry {
    return ensureDefaultUserdata(loadRegistry(this.registryFile));
  }

  update(update: (latest: Registry) => Registry): Registry {
    return this.updateWithResult((latest) => {
      const registry = update(latest);
      return { registry, result: registry };
    });
  }

  updateWithResult<T>(
    update: (latest: Registry) => RegistryUpdateResult<T>,
  ): T {
    const updated = update(this.read());
    saveRegistry(this.registryFile, updated.registry);
    return updated.result;
  }
}
