import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { cleanNodeName } from './nodeNames';

describe('kit node names as three.js sees them (v2.10)', () => {
  it('strips the characters GLTFLoader strips', () => {
    expect(cleanNodeName('foot.l')).toBe('footl'); expect(cleanNodeName('handslot.r')).toBe('handslotr'); expect(cleanNodeName('head')).toBe('head'); expect(cleanNodeName('a b')).toBe('a_b');
  });
  it('every bone the rig looks up by name exists in the kit under its cleaned name', async () => {
    await MeshoptDecoder.ready;
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read('public/assets/chibi/chibi_kit.glb');
    const names = new Set(doc.getRoot().listNodes().map(n => cleanNodeName(n.getName())));
    for (const wanted of ['head', 'handslot.l', 'handslot.r', 'foot.l', 'foot.r', 'toes.l', 'toes.r']) expect(names.has(cleanNodeName(wanted)), wanted).toBe(true);
  });
});
