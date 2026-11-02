import { apiUrl } from "./config";

/** Enciende o apaga la traída de datos en tiempo real en el server. */
export async function setFeed(on: boolean): Promise<void> {
  await fetch(apiUrl(on ? "/api/feed/start" : "/api/feed/stop"), {
    method: "POST",
  });
}
