import { decodeCountryResource } from "./country-csv-decode";
self.onmessage = (event) => {
  const { id, csv, entry } = event.data;
  try {
    self.postMessage({ id, value: decodeCountryResource(csv, entry) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "CSV decode failed" });
  }
};
