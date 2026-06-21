/** 件数集計用。truncate しないよう常に collect() を使う。 */
export async function countQueryDocs<T>(query: { collect?: () => Promise<T[]> }) {
  if (typeof query.collect === "function") {
    return await query.collect();
  }
  throw new Error("countQueryDocs requires a query with collect()");
}

export async function readQueryDocs<T>(query: {
  collect?: () => Promise<T[]>;
  take?: (count: number) => Promise<T[]>;
  unique?: () => Promise<T | null>;
}) {
  if (typeof query.collect === "function") {
    return await query.collect();
  }
  if (typeof query.take === "function") {
    return await query.take(100);
  }
  if (typeof query.unique === "function") {
    const doc = await query.unique();
    return doc === null ? [] : [doc];
  }
  return [];
}

export async function readQueryDoc<T>(query: {
  unique?: () => Promise<T | null>;
  collect?: () => Promise<T[]>;
  take?: (count: number) => Promise<T[]>;
}) {
  if (typeof query.unique === "function") {
    return await query.unique();
  }
  const docs = await readQueryDocs(query);
  return docs[0] ?? null;
}
