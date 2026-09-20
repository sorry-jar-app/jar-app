/**
 * Ids are generated at the edge — in the dispatch wrapper, never inside the
 * reducer. The reducer has to stay pure: React 19 double-invokes reducers in
 * development, and an id minted in there would differ between the two runs.
 *
 * A client-generated uuid also lets an optimistic insert carry the same id the
 * database will store, so the realtime echo reconciles instead of duplicating.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Older WebViews. Not cryptographically strong, but ids only need to be
  // unique, and the database is the authority on conflicts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
