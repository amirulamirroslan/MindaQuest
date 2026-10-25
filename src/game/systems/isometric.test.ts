import { describe, expect, it } from 'vitest';
import { projectIsometricPoint, screenDirectionToWorld } from './isometric';

describe('isometric world projection', () => {
  it('projects adjacent map axes into the angled screen plane', () => {
    const origin = projectIsometricPoint(0, 0);
    expect(projectIsometricPoint(32, 0)).toEqual({ x: origin.x + 16, y: origin.y + 8 });
    expect(projectIsometricPoint(0, 32)).toEqual({ x: origin.x - 16, y: origin.y + 8 });
  });

  it('maps keyboard directions back into the existing world coordinates', () => {
    const right = screenDirectionToWorld(1, 0);
    const down = screenDirectionToWorld(0, 1);
    const origin = projectIsometricPoint(0, 0);
    const rightPoint = projectIsometricPoint(right.x, right.y);
    const downPoint = projectIsometricPoint(down.x, down.y);
    expect({ x: rightPoint.x - origin.x, y: rightPoint.y - origin.y }).toEqual({ x: 1, y: 0 });
    expect({ x: downPoint.x - origin.x, y: downPoint.y - origin.y }).toEqual({ x: 0, y: 1 });
  });
});

import { worldVelocityToScreen } from './isometric';
describe('worldVelocityToScreen', () => {
  it('is the derivative of the projection', () => {
    const a = projectIsometricPoint(100, 200), b = projectIsometricPoint(100 + 3, 200 - 5);
    const v = worldVelocityToScreen(3, -5);
    expect(b.x - a.x).toBeCloseTo(v.x);
    expect(b.y - a.y).toBeCloseTo(v.y);
  });
  it('foreshortens vertical screen motion to half of horizontal for equal ground speed', () => {
    const horizontal = worldVelocityToScreen(Math.SQRT1_2, -Math.SQRT1_2);
    const vertical = worldVelocityToScreen(Math.SQRT1_2, Math.SQRT1_2);
    expect(Math.abs(vertical.y) / Math.abs(horizontal.x)).toBeCloseTo(0.5);
  });
});
