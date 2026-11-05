import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyGreenCoverage } from './green-coverage.mjs';
const hash = (body) => createHash('sha256').update(body).digest('hex');
const bytes = Buffer.from('approved source');
const audit = { schema: 1, models: [{ modelId: 'base', status: 'region', views: [{ viewId: 'main', sourceSHA256: hash(bytes) }] }] };
test('approval binds exact model and bytes; base references inherit no approval', async () => {
  const data = { models: [{ id: 'base', framePath: 'image' }, { id: 'special', baseVehicleReference: { vehicleId: 'base' } }] };
  assert.deepEqual(await applyGreenCoverage(data, audit, async () => bytes, hash), { region: 1, point: 0, pending: 1 });
  assert.equal(data.models[1].greenCoverage.status, 'pending');
  await applyGreenCoverage(data, audit, async () => Buffer.from('changed'), hash);
  assert.equal(data.models[0].greenCoverage.status, 'pending');
  assert.deepEqual(data.models[0].greenCoverage.viewIds, []);
});
test('auxiliary view must still belong to the same model and exist', async () => {
  const auxiliaryAudit = { schema: 1, models: [{ modelId: 'base', status: 'point', views: [{ viewId: 'aux', sourceSHA256: hash(bytes) }] }] };
  const data = { models: [{ id: 'base', protectionEvidence: [{ id: 'aux', framePath: 'aux-image' }] }] };
  await applyGreenCoverage(data, auxiliaryAudit, async () => bytes, hash);
  assert.equal(data.models[0].greenCoverage.status, 'point');
  data.models[0].protectionEvidence = [];
  await applyGreenCoverage(data, auxiliaryAudit, async () => bytes, hash);
  assert.equal(data.models[0].greenCoverage.status, 'pending');
});
test('preview metadata classifies single point without making any region approval', async () => {
  const data = { models: [
    { id: 'preview', framePath: 'a', mainViewKind: 'protection-preview' },
    { id: 'aux', framePath: 'b', protectionEvidence: [{ id: 'point', framePath: 'c', label: '单点预测' }] },
    { id: 'exterior', framePath: 'd', mainViewKind: 'exterior' },
    { id: 'missing' },
    { id: 'unknown', framePath: 'e' },
  ] };
  await applyGreenCoverage(data, { schema: 1, models: [] }, async () => bytes, hash);
  assert.deepEqual(data.models.map((model) => model.greenCoverage.label), ['仅单点', '仅单点', '无绿区', '待补图', '待核实']);
  assert.equal(data.models.some((model) => model.greenCoverage.status === 'region'), false);
});
test('changed positive image never falls back to a point preview label', async () => {
  const data = { models: [{ id: 'base', framePath: 'a', mainViewKind: 'protection-preview' }] };
  await applyGreenCoverage(data, audit, async () => Buffer.from('changed'), hash);
  assert.equal(data.models[0].greenCoverage.status, 'pending');
  assert.equal(data.models[0].greenCoverage.reason, 'stale-review');
});
