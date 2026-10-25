/**
 * Builds public/assets/chibi/chibi_kit.glb from the KayKit "Character Pack: Adventurers" (Kay Lousberg, CC0).
 *
 *   node tools/chibi-kit/build-chibi-kit.mjs <path-to-kaykit-pack-root> [out.glb]
 *
 * <root> is the folder that contains `Characters/gltf/Knight.glb` (the pack's `addons/kaykit_character_pack_adventures`).
 * All five characters share one skeleton and bind pose (verified below), so every skinned part (head, body, arms, legs) and every
 * rigid part (helmet, hat, cape, weapons, shields) of every character can sit on ONE skeleton. The kit keeps each part as its own
 * named mesh so the game can show/hide/swap them. Only the animation clips the game uses are kept.
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import path from 'node:path';

const root = process.argv[2]; const out = process.argv[3] ?? 'public/assets/chibi/chibi_kit.glb';
if (!root) { console.error('usage: build-chibi-kit.mjs <kaykit pack root> [out.glb]'); process.exit(1); }
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const CHARS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
const docs = {};
for (const c of CHARS) docs[c] = await io.read(path.join(root, 'Characters/gltf', `${c}.glb`));

// ---- which parts to take from which character (source node name -> kit node name)
const SKINNED = ['Head', 'Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'];
const take = []; // [character, sourceNodeName, kitName]
for (const c of ['Knight', 'Barbarian', 'Mage', 'Rogue']) for (const p of SKINNED) take.push([c, `${c}_${p}`, `${c}_${p}`]);
take.push(['Rogue_Hooded', 'Rogue_Head_Hooded', 'Rogue_Head_Hooded']);
const RIGID = {
  Knight: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', '2H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'],
  Barbarian: ['Barbarian_Hat', 'Barbarian_Cape', '1H_Axe', '2H_Axe', '1H_Axe_Offhand', 'Barbarian_Round_Shield'],
  Mage: ['Mage_Hat', 'Mage_Cape', '1H_Wand', '2H_Staff', 'Spellbook'],
  Rogue: ['Rogue_Cape', 'Knife', 'Knife_Offhand'],
};
for (const [c, names] of Object.entries(RIGID)) for (const n of names) take.push([c, n, n]);

const CLIPS = [
  'Idle', 'Unarmed_Idle', '2H_Melee_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Running_A', 'Running_B', 'Walking_Backwards',
  'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Throw',
  'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Block', 'Block_Hit',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Stab',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick', 'Sit_Floor_Idle', 'Lie_Idle',
];

// ---- verify the skeleton really is shared
const sig = d => d.getRoot().listSkins()[0].listJoints().map(j => `${j.getName()}:${j.getTranslation().map(x => x.toFixed(4))}|${j.getRotation().map(x => x.toFixed(4))}`).join(';');
for (const c of CHARS) if (sig(docs[c]) !== sig(docs.Knight)) throw new Error(`skeleton of ${c} differs from Knight: parts cannot share a rig`);

// ---- start from Knight, drop its own parts we do not take, then merge parts of the others in
const base = docs.Knight;
const baseRoot = base.getRoot();
const baseSkin = baseRoot.listSkins()[0];
const byName = (doc, n) => doc.getRoot().listNodes().find(x => x.getName() === n);
const keepNames = new Set(take.filter(t => t[0] === 'Knight').map(t => t[2]));
for (const n of baseRoot.listNodes()) if (n.getMesh() && !keepNames.has(n.getName())) n.dispose();

const taken = new Set(); for (const n of baseRoot.listNodes()) if (n.getMesh() && keepNames.has(n.getName())) taken.add(n);
const killAnim = a => { a.listSamplers().forEach(x => x.dispose()); a.listChannels().forEach(x => x.dispose()); a.dispose(); };
const rigParent = base.getRoot().listNodes().find(n => n.getName() === 'Rig');
const boneNamed = n => baseRoot.listNodes().find(x => x.getName() === n);
for (const c of ['Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded']) {
  const src = docs[c];
  const wanted = take.filter(t => t[0] === c);
  // map source mesh/material/skin objects into the base document
  const map = mergeDocuments(base, src); // Map of source property -> merged property
  for (const [, srcName, kitName] of wanted) {
    const srcNode = byName(src, srcName); if (!srcNode) throw new Error(`missing ${srcName} in ${c}`);
    const node = map.get(srcNode);
    node.setName(kitName); taken.add(node);
    const parentName = srcNode.getParentNode()?.getName();
    if (srcNode.getSkin()) { node.setSkin(baseSkin); rigParent ? rigParent.addChild(node) : null; }
    else { const bone = boneNamed(parentName); if (!bone) throw new Error(`no bone ${parentName} for ${kitName}`); bone.addChild(node); }
  }
  // anything else that came with the merged document (its scene, its duplicate skeleton, its other meshes) is pruned below
  map.get(src.getRoot().listScenes()[0]).dispose();
  for (const a of src.getRoot().listAnimations()) killAnim(map.get(a)); // every character carries the same 76 clips; keep only Knight's copy
}
// remove all nodes that are not part of the kit: unneeded merged meshes
for (const n of baseRoot.listNodes()) if (n.getMesh() && !taken.has(n)) n.dispose();

// ---- animations: keep only the clips the game uses (from Knight)
for (const a of baseRoot.listAnimations()) if (!CLIPS.includes(a.getName())) killAnim(a);
const have = new Set(baseRoot.listAnimations().map(a => a.getName()));
for (const c of CLIPS) if (!have.has(c)) throw new Error(`missing clip ${c}`);

// ---- drop channels that cannot affect the picture: IK/control helper bones and constant scale tracks
for (const a of baseRoot.listAnimations()) for (const ch of a.listChannels()) {
  const t = ch.getTargetNode()?.getName() ?? '';
  if (/IK|control-/.test(t) || ch.getTargetPath() === 'scale') { const sm = ch.getSampler(); ch.dispose(); sm?.dispose(); }
}
// ---- name the materials after their atlas so the game can find them
for (const m of baseRoot.listMaterials()) {
  const t = m.getBaseColorTexture();
  m.setName(t ? `atlas:${t.getURI() || t.getName() || 'tex'}` : m.getName());
}
await base.transform(prune(), dedup(), unpartition(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
for (const acc of baseRoot.listAccessors()) if (acc.listParents().every(p => p.propertyType === 'Root')) acc.dispose();
{ const c = {}; for (const a of baseRoot.listAccessors()) for (const p of a.listParents()) c[p.propertyType] = (c[p.propertyType] ?? 0) + 1; console.log('accessor parents', c, 'samplers', baseRoot.listAnimations().reduce((n, a) => n + a.listSamplers().length, 0)); }
console.log('accessors kept', baseRoot.listAccessors().length);
io.registerExtensions([EXTMeshoptCompression]);
await io.write(out, base);
const final = await io.read(out);
const r = final.getRoot();
console.log('wrote', out, '| meshes', r.listNodes().filter(n => n.getMesh()).length, '| clips', r.listAnimations().length, '| materials', r.listMaterials().map(m => m.getName()).join(','), '| textures', r.listTextures().length);
