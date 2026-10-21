export type CareTransport = (path: string, init?: RequestInit) => Promise<Response>;
export const liveTransport: CareTransport = (path, init) => fetch(path, init);
