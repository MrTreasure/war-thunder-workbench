// Explicit references only: never derive inheritance from names or families.
export async function validateBaseReferences(data, registry, candidates, readHTML, hash) {
  const models = new Map(data.models.map((model) => [model.id, model]));
  for (const model of data.models) {
    const ref = model.baseVehicleReference;
    if (!ref) continue;
    const base = models.get(ref.vehicleId);
    if (!base || base.id === model.id || !registry?.models?.[base.id]?.photo) throw Error(`Invalid base vehicle photo reference: ${model.id}`);
    const seen = new Set([model.id]);
    for (let next = base; next; next = models.get(next.baseVehicleReference?.vehicleId)) {
      if (seen.has(next.id)) throw Error(`Cyclic base vehicle reference: ${model.id}`);
      seen.add(next.id);
    }
    const proof = candidates.find((entry) => entry.targetUnitId === model.id && entry.baseUnitId === base.id);
    if (!proof || ref.targetWikiURL !== model.wikiUrl || ref.targetWikiURL !== proof.targetWikiURL
      || ref.sourceHTMLSHA !== proof.htmlSha256 || ref.sourceHTMLSHA !== proof.recordedHtmlSha256
      || ref.actualcheckedAt !== proof.actualcheckedAt || ref.gameVersion !== proof.wikiGameVersion
      || !ref.note || !['official-wiki-protection-equivalence', 'official-wiki-identical-except-appearance'].includes(ref.basis)
      || hash(await readHTML(proof.htmlPath)) !== ref.sourceHTMLSHA) throw Error(`Unverified base vehicle relationship: ${model.id}`);
  }
}
