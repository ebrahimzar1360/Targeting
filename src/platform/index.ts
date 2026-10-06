/**
 * Where the app runs. The same code ships to two places:
 * - the web build (GitHub Pages / any static host): localStorage, normal downloads, print,
 *   the Claude API with the user's own key;
 * - the claude.ai artifact build (`vite build --mode artifact`): the viewer's frame blocks
 *   downloads, printing and outside network calls, so those go through the runtime
 *   capabilities `downloads`, `db`/`user` and `sample` instead.
 * `IS_ARTIFACT` is a build-time constant, so the unused branch is dropped from each bundle.
 */
export const IS_ARTIFACT = import.meta.env.MODE === "artifact";

// Minimal shapes of the capabilities this app uses (full contracts are served by the platform).
export interface DocSnap { exists: boolean; data(): Record<string, unknown> | undefined }
export interface DocRef { get(): Promise<DocSnap>; set(data: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
export interface ArtifactDb { doc(path: string): DocRef }
export interface ArtifactUser { id(): Promise<string | null> }
export interface ArtifactDownloads { save(req: { filename: string; data: string | Blob | ArrayBuffer }): Promise<{ status: string }> }
export interface ArtifactSample { json<T = unknown>(input: string, options?: { modelTier?: "quick" | "default" | "complex" }): Promise<T> }
export interface CapabilityError { code: string; message?: string }

interface CapabilityMap { db: ArtifactDb; user: ArtifactUser; downloads: ArtifactDownloads; sample: ArtifactSample }

declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

const cache = new Map<string, Promise<unknown>>();

/** Resolves a capability namespace, or null outside claude.ai or when this view cannot run it. */
export function capability<K extends keyof CapabilityMap>(name: K): Promise<CapabilityMap[K] | null> {
  if (!IS_ARTIFACT || typeof window === "undefined" || !window.claude?.use) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, window.claude.use(name).catch(() => null));
  return cache.get(name) as Promise<CapabilityMap[K] | null>;
}

export const errorCode = (e: unknown) => (e && typeof e === "object" && "code" in e ? String((e as CapabilityError).code) : "");
