import {describe,expect,it} from 'vitest';
import {normalizeDirection} from './movement';
describe('normalizeDirection',()=>{it('returns zero for no input',()=>expect(normalizeDirection(0,0)).toEqual({x:0,y:0}));it('keeps straight input at unit length',()=>expect(normalizeDirection(0,-1)).toEqual({x:0,y:-1}));it('normalizes diagonal input',()=>{const d=normalizeDirection(1,1);expect(Math.hypot(d.x,d.y)).toBeCloseTo(1);expect(d.x).toBeCloseTo(Math.SQRT1_2);expect(d.y).toBeCloseTo(Math.SQRT1_2);});});
