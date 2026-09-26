// PS1-style render pass. The scene is drawn into a small render target (~240 lines), then blown up
// to the canvas with nearest-neighbour sampling, ordered dithering and 15-bit colour.
// Vertex snapping (the PS1 "wobble") is patched into three.js's shared vertex chunk, so it covers
// every material, including models loaded later.
// Off switch: ?psx=0 in the URL restores the original smooth renderer (needs a reload).
import * as THREE from 'three';

export const PSX = {
  lines: 240,       // internal vertical resolution
  snap: [320, 240], // vertex-snap grid in screen space (coarser = more wobble)
  levels: 31,       // colour levels per channel (31 = PS1 15-bit colour)
};

export function psxEnabled() {
  return new URLSearchParams(location.search).get('psx') !== '0';
}

// Must run before any material compiles.
export function installVertexSnap() {
  const chunk = THREE.ShaderChunk.project_vertex;
  if (chunk.includes('psxClip')) return;
  const [w, h] = PSX.snap;
  THREE.ShaderChunk.project_vertex = chunk.replace(
    'gl_Position = projectionMatrix * mvPosition;',
    `vec4 psxClip = projectionMatrix * mvPosition;
if ( psxClip.w > 0.0 ) {
  vec2 psxGrid = vec2( ${(w / 2).toFixed(1)}, ${(h / 2).toFixed(1)} );
  psxClip.xy = floor( psxClip.xy / psxClip.w * psxGrid + 0.5 ) / psxGrid * psxClip.w;
}
gl_Position = psxClip;`,
  );
}

export function createPsxPass(renderer) {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType,           // keep HDR so tone mapping still happens once, at the end
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: target.texture }, uLevels: { value: PSX.levels } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene;
      uniform float uLevels;
      varying vec2 vUv;
      float bayer4( vec2 p ) {
        int x = int( mod( p.x, 4.0 ) ), y = int( mod( p.y, 4.0 ) );
        int i = x + y * 4;
        int m[16] = int[16]( 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 );
        return ( float( m[i] ) + 0.5 ) / 16.0;
      }
      void main() {
        gl_FragColor = vec4( texture2D( tScene, vUv ).rgb, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // dither + quantise in display space, on the low-res pixel grid
        vec2 px = floor( vUv * vec2( textureSize( tScene, 0 ) ) );
        vec3 c = gl_FragColor.rgb + ( bayer4( px ) - 0.5 ) / uLevels;
        gl_FragColor.rgb = floor( clamp( c, 0.0, 1.0 ) * uLevels + 0.5 ) / uLevels;
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    target,
    resize(w, h) {
      const lines = Math.min(PSX.lines, h);
      target.setSize(Math.max(1, Math.round(lines * w / h)), lines);
    },
    render(scene, camera) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
  };
}
