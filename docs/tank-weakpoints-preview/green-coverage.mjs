// An approval belongs to an exact vehicle, displayed view and source bytes.
export async function applyGreenCoverage(data, audit, readSource, hash) {
  if (audit.schema !== 1) throw Error('Unknown green coverage schema');
  const records = new Map();
  for (const record of audit.models) {
    if (records.has(record.modelId) || !['region', 'point'].includes(record.status) || !record.views?.length) throw Error('Invalid green coverage approval');
    records.set(record.modelId, record);
  }
  const counts = { region: 0, point: 0, pending: 0 };
  for (const model of data.models) {
    const record = records.get(model.id);
    let valid = !!record;
    for (const view of record?.views || []) {
      const evidence = view.viewId === 'main' ? null : model.protectionEvidence?.find((entry) => entry.id === view.viewId);
      const file = view.viewId === 'main' ? model.framePath || model.frame : evidence?.framePath;
      try {
        if (!file || !/^[a-f0-9]{64}$/.test(view.sourceSHA256) || hash(await readSource(file, model, view)) !== view.sourceSHA256) valid = false;
      } catch (error) { if (error.code !== 'ENOENT') throw error; valid = false; }
    }
    const hasMainImage = !!(model.framePath || model.frame || model.imageUrl);
    const pointViews = (model.protectionEvidence || []).filter((entry) =>
      (entry.framePath || entry.imageUrl) && (
        /single-cursor|single.point|单点|单准星/i.test([entry.viewKind, entry.kind, entry.label, entry.caption, entry.description, entry.conditionNote].filter(Boolean).join(' '))
        || entry.pins?.some((pin) => pin.evidence?.singlePointPrediction === true)
      ));
    const mainPoint = hasMainImage && model.mainViewKind === 'protection-preview';
    // A stale explicit approval never falls back to metadata, even for point views.
    const status = valid ? record.status : !record && (mainPoint || pointViews.length) ? 'point' : 'pending';
    const knownNonRegion = hasMainImage && ['frontal-position-reference', 'armor-layout', 'exterior', 'external', 'author-diagram'].includes(model.mainViewKind);
    const reason = status === 'region' ? 'region' : status === 'point' ? 'single-point' : record ? 'stale-review' : !hasMainImage && !(model.protectionEvidence || []).some((entry) => entry.framePath || entry.imageUrl) ? 'missing-image' : knownNonRegion ? 'no-region' : 'unverified';
    model.greenCoverage = {
      status, reason,
      label: status === 'region' ? '绿区·局部' : status === 'point' ? '仅单点' : reason === 'no-region' ? '无绿区' : reason === 'missing-image' ? '待补图' : '待核实',
      viewIds: valid ? record.views.map((view) => view.viewId) : status === 'point' ? [...(mainPoint ? ['main'] : []), ...pointViews.map((entry) => entry.id)] : [], partial: status === 'region',
      note: status === 'region' ? '当前车型展示图中已核对真实绿色装甲分区，仅适用于对应来源条件；不代表整面可击穿或完整攻略。' : status === 'point' ? '当前展示包含单点防护预测；不声称准星为绿色，不代表绿色装甲分区、整面可穿或实射结果。' : reason === 'stale-review' ? '审核图像已变化或缺失，绿区待重新核实。' : reason === 'no-region' ? '当前展示为外观、位置参考、装甲布局或作者图解，未确认绿色装甲分区；基础车型参考不计入。' : reason === 'missing-image' ? '当前车型缺少可展示证据图，待补正面图与绿色装甲分区。' : '当前车型展示证据尚未完成绿区核实；基础车型参考不计入。',
    };
    counts[status]++;
  }
  return counts;
}
