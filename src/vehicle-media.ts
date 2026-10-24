import settings from "../data/catalog-settings.json";
type Override = { imageUrl: string; thumbnailUrl: string };
const overrides: Record<string, Override> = settings.vehicleMediaOverrides;
/** Preserve vehicle identity; only explicitly verified image fallbacks are substituted. */
export function vehicleMedia(id: string, image?: string, thumbnail?: string) {
  return (
    overrides[id] || {
      imageUrl: image || settings.vehicleImageTemplate.replace("{id}", encodeURIComponent(id)),
      thumbnailUrl:
        thumbnail || settings.vehicleThumbnailTemplate.replace("{id}", encodeURIComponent(id)),
    }
  );
}
