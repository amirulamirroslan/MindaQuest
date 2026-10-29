import type { Scene } from 'three';
import { Enemy, type EnemyKind } from '../systems/enemies';
import { CrabView, GullView, HeronView } from './ShoreViews';
import { MossbackView, ShardlingView, SproutView, TelegraphMarker, WardenView, type EnemyView } from './Characters';

export interface EnemyEntry { enemy: Enemy; view: EnemyView; marker: TelegraphMarker; /** the defeat finale (the big poof) has been played */ finale?: boolean }

/** Owns every live enemy: the logic object, its model and its ground warning. */
export class EnemyManager {
  private entries: EnemyEntry[] = [];
  /** Cartoon outlines on the sprouts (the boss always has one); the scene turns them off on the lowest quality. */
  constructor(private readonly scene: Scene, private readonly outlines = true) {}

  /** `tag` is the scene's own id for this creature (a Hollow Shardling's nest number), kept on the enemy and used to pick its crystal colour. */
  spawn(kind: EnemyKind, at: { x: number; z: number }, tag: number | null = null): EnemyEntry {
    const enemy = new Enemy(kind, at); enemy.tag = tag;
    const view = kind === 'crab' ? new CrabView(enemy, this.outlines) : kind === 'gull' ? new GullView(enemy, this.outlines) : kind === 'heron' ? new HeronView(enemy) : kind === 'mossback' ? new MossbackView(enemy) : kind === 'warden' ? new WardenView(enemy) : kind === 'shardling' ? new ShardlingView(enemy, this.outlines) : new SproutView(enemy, this.outlines);
    const marker = new TelegraphMarker();
    this.scene.add(view.root, marker.root);
    const entry = { enemy, view, marker };
    this.entries.push(entry);
    return entry;
  }
  has(kind: EnemyKind): boolean { return this.entries.some(e => e.enemy.def.kind === kind); }
  all(): readonly EnemyEntry[] { return this.entries; }
  alive(): EnemyEntry[] { return this.entries.filter(e => !e.enemy.defeated); }
  /** Removes enemies whose "poof" has finished. */
  prune(): void {
    this.entries = this.entries.filter(e => {
      if (e.enemy.defeated && e.enemy.poof > e.enemy.def.deathTime + 0.25) { this.scene.remove(e.view.root, e.marker.root); return false; }
      return true;
    });
  }
  clear(): void { for (const e of this.entries) this.scene.remove(e.view.root, e.marker.root); this.entries = []; }
}
