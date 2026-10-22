import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "./core";
/** Subscribe without remounting pages or discarding calculator/editor drafts. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
