import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

test('distributed HDR environments are valid CC0 Radiance assets', async () => {
  for (const name of ['studio.hdr', 'day.hdr', 'arid.hdr', 'night.hdr']) {
    const file = new URL(`../public/env/${name}`, import.meta.url);
    const bytes = await readFile(file);
    assert.ok(bytes.length > 100_000, `${name} is unexpectedly small`);
    assert.match(bytes.subarray(0, 16).toString('ascii'), /#\?RADIANCE|#\?RGBE/, `${name} is not Radiance HDR`);
  }
});

test('car GLBs carry baked Khronos clearcoat, IOR and specular extensions', async () => {
  for (const id of ['golf', 'mercedes', 'audi', 'mustang', 'ferrari', 'r8', 'challenger']) {
    const doc = await io.read(new URL(`../public/models/${id}.glb`, import.meta.url).pathname);
    const used = doc.getRoot().listExtensionsUsed().map(ext => ext.extensionName);
    for (const name of ['KHR_materials_clearcoat', 'KHR_materials_ior', 'KHR_materials_specular']) {
      assert.ok(used.includes(name), `${id}.glb is missing ${name}`);
    }
    const paint = doc.getRoot().listMaterials().find(m => m.getName().startsWith('paint__'));
    assert.ok(paint, `${id}.glb has no paint material`);
    const clearcoat = paint.getExtension('KHR_materials_clearcoat');
    assert.equal(clearcoat.getClearcoatFactor(), .9);
    assert.equal(clearcoat.getClearcoatRoughnessFactor(), .075);
    assert.equal(paint.getMetallicFactor(), .55);
    assert.equal(paint.getRoughnessFactor(), .28);
  }
});

test('model manifest byte counts match the upgraded GLBs', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/models/manifest.json', import.meta.url), 'utf8'));
  for (const [id, info] of Object.entries(manifest)) {
    const bytes = (await stat(new URL(`../public/models/${id}.glb`, import.meta.url))).size;
    assert.equal(info.bytes, bytes, `${id}.glb manifest byte count`);
  }
});
