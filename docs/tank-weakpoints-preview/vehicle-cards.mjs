import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

/** Render the actual tree tile at build time; the preview needs no country loader or React runtime. */
export async function buildVehicleCards(project, models, vehicleNames) {
  const server = await createServer({
    root: project,
    configFile: false,
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { VehicleTile } = await server.ssrLoadModule("/src/VehicleTile.tsx");
    const { vehicleMedia } = await server.ssrLoadModule("/src/vehicle-media.ts");
    for (const model of models) {
      const entry = vehicleNames.get(model.id);
      if (!entry?.unit) throw Error("Missing tree card: " + model.id);
      const unit = { ...entry.unit, name: entry.name, rank: entry.rankLabel };
      const media = vehicleMedia(unit.id, unit.imageUrl, unit.thumbnailUrl);
      model.vehicleCard = {
        html: renderToStaticMarkup(createElement(VehicleTile, {
          unit, mode: "rb", href: model.wikiUrl,
          showRank: true, showAcquisition: false,
        })),
        imageFallback: media.imageUrl,
      };
    }
  } finally {
    await server.close();
  }
}
