import { openDB } from "idb";

const DB_NAME = "lifeengine";
const STORE = "kv";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE);
  },
});

export async function kvGet(key) {
  try {
    return await (await dbPromise).get(STORE, key);
  } catch (e) {
    console.error("kvGet", e);
    return undefined;
  }
}

export async function kvSet(key, value) {
  try {
    await (await dbPromise).put(STORE, value, key);
  } catch (e) {
    console.error("kvSet", e);
  }
}

export const STATE_KEY = "state-v1";
