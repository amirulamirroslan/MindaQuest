export interface Direction { x:number; y:number }
/** Normalizes input so diagonal movement is not faster than straight movement. */
export function normalizeDirection(x:number,y:number):Direction { const length=Math.hypot(x,y); return length===0?{x:0,y:0}:{x:x/length,y:y/length}; }
