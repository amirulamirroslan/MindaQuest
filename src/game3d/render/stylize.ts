import { Color, Material as ThreeMaterial, MeshLambertMaterial, MeshStandardMaterial, type Material } from 'three';

/**
 * Adds a soft rim light and an optional height-based "bounce" tint to a standard or Lambert material (one cheap term in the
 * fragment shader). It gives the stylised, painted look: edges pick up the sky colour and the silhouette separates from the
 * background without any post-processing.
 */
export interface RimUniforms { rimColor: { value: Color }; rimStrength: { value: number } }

const shared: RimUniforms = { rimColor: { value: new Color(0xbfe0ff) }, rimStrength: { value: 0.35 } };
/** The look system updates this with the sky colour so rims match the time of day. */
export const rimLight = shared;

export function withRim<M extends MeshStandardMaterial | MeshLambertMaterial>(mat: M, strength = 1, power = 2.6): M {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.rimColor = shared.rimColor;
    shader.uniforms.rimStrength = shared.rimStrength;
    shader.uniforms.rimMul = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimMul;')
      .replace('#include <opaque_fragment>', `
        {
          float rimF = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(1)});
          outgoingLight += rimColor * rimF * rimStrength * rimMul * (0.35 + 0.65 * max(outgoingLight.g, 0.2));
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `rim${strength}_${power}`;
  return mat;
}

export const isMaterial = (m: unknown): m is Material => typeof m === 'object' && m !== null && 'isMaterial' in m;

/**
 * v2.13 hand-painted world lighting. The chibi hero is flat colour with a clean outline; the world used to be smooth realistic shading,
 * so the two did not match. This adds, to any Lambert material, one cheap fragment step: the amount of light on each pixel is eased
 * into soft bands (like painted cel shading), shadows are pulled towards a cool blue-violet (warm sun, cool shade, the classic painterly
 * pairing) and colours get a little extra saturation. Everything is soft-edged, so nothing shimmers. `paintLook` is updated by the
 * time-of-day system.
 */
export interface PaintUniforms { shadowTint: { value: Color }; bands: { value: number }; bandMix: { value: number }; saturation: { value: number } }
export const paintLook: PaintUniforms = { shadowTint: { value: new Color(0.86, 0.93, 1.1) }, bands: { value: 4 }, bandMix: { value: 0.42 }, saturation: { value: 0.16 } };

export function withPaint<M extends MeshLambertMaterial>(mat: M): M {
  const prev = mat.onBeforeCompile; const prevKeyFn = mat.customProgramCacheKey;
  const prevKey = prevKeyFn === ThreeMaterial.prototype.customProgramCacheKey ? prev.toString() : prevKeyFn.call(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.paintTint = paintLook.shadowTint; shader.uniforms.paintBands = paintLook.bands; shader.uniforms.paintMix = paintLook.bandMix; shader.uniforms.paintSat = paintLook.saturation;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 paintTint;\nuniform float paintBands;\nuniform float paintMix;\nuniform float paintSat;')
      .replace('#include <opaque_fragment>', `
        {
          const vec3 lw = vec3(0.299, 0.587, 0.114);
          vec3 lit = outgoingLight - totalEmissiveRadiance;
          float shade = dot(lit, lw) / max(dot(diffuseColor.rgb, lw), 0.03);
          float x = shade * paintBands;
          float banded = (floor(x) + smoothstep(0.28, 0.72, fract(x))) / paintBands;
          float s2 = mix(shade, banded, paintMix);
          vec3 col = lit * (s2 / max(shade, 0.001));
          float inShade = 1.0 - smoothstep(0.3, 0.95, s2);
          col *= mix(vec3(1.0), paintTint, inShade);
          col += diffuseColor.rgb * vec3(0.03, 0.06, 0.1) * inShade; // painted shadows are never dead black: a little colour glows in them
          col = mix(vec3(dot(col, lw)), col, 1.0 + paintSat);
          outgoingLight = col + totalEmissiveRadiance;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `${prevKey}|paint`;
  return mat;
}
