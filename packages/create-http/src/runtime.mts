export const isNode = typeof process !== "undefined" && !!process.versions?.node;
export const hasIndexedDB = typeof indexedDB !== "undefined";
