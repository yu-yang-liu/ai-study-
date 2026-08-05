import type { AIProvider, Capability } from './types';

const registry = new Map<string, AIProvider>();

export function registerProvider(provider: AIProvider) {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): AIProvider | undefined {
  return registry.get(id);
}

/** Pick the best provider for the given capability, falling back to a secondary
 *  capability if the primary isn't available. */
export function pick(capability: Capability, fallback?: Capability): AIProvider {
  for (const p of registry.values()) {
    if (p.supports.includes(capability)) return p;
  }
  if (fallback) {
    for (const p of registry.values()) {
      if (p.supports.includes(fallback)) return p;
    }
  }
  throw new Error(`No provider found for capability=${capability} fallback=${fallback ?? 'none'}`);
}

export function listProviders(): AIProvider[] {
  return [...registry.values()];
}
