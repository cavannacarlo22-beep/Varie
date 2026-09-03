/* ============================================================
   Sfondo animato WebGL — nebulosa/aurora fluida
   Degrada in silenzio sul gradiente CSS se WebGL non c'è.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('bgCanvas');
  if (!canvas || reduce) return;

  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, depth: false, powerPreference: 'low-power' })
        || canvas.getContext('experimental-webgl');
  if (!gl) return;

  var VERT = [
    'attribute vec2 p;',
    'void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform vec2  u_mouse;',
    '',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);',
    '  for (int i = 0; i < 5; i++){',
    '    v += a * noise(p);',
    '    p = rot * p * 2.02;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);',
    '  float t  = u_time * 0.035;',
    '',
    '  // parallasse morbida legata al mouse',
    '  vec2 m = (u_mouse - 0.5) * 0.34;',
    '  uv += m;',
    '',
    '  // due strati di flusso a velocità diverse',
    '  vec2 q = uv * 1.35;',
    '  float f1 = fbm(q + vec2(t * 1.6, -t * 1.1));',
    '  float f2 = fbm(q * 1.7 + vec2(-t * 1.2, t * 1.5) + f1 * 1.4);',
    '  float f3 = fbm(q * 0.7 + f2 * 0.9 - vec2(t * 0.6));',
    '',
    '  // palette: viola -> ciano -> rosa',
    '  vec3 violet = vec3(0.545, 0.361, 0.965);',
    '  vec3 cyan   = vec3(0.133, 0.827, 0.933);',
    '  vec3 pink    = vec3(0.957, 0.447, 0.714);',
    '  vec3 deep   = vec3(0.020, 0.020, 0.043);',
    '',
    '  vec3 col = deep;',
    '  col = mix(col, violet, smoothstep(0.28, 0.95, f2) * 0.62);',
    '  col = mix(col, cyan,   smoothstep(0.42, 1.0,  f1) * 0.34);',
    '  col = mix(col, pink,   smoothstep(0.58, 1.05, f3) * 0.22);',
    '',
    '  // filamenti luminosi',
    '  float veins = smoothstep(0.72, 0.78, f2) - smoothstep(0.80, 0.9, f2);',
    '  col += veins * vec3(0.42, 0.62, 0.95) * 0.55;',
    '',
    '  // vignettatura radiale, tiene il centro leggibile',
    '  float d = length(uv);',
    '  col *= 1.0 - smoothstep(0.35, 1.25, d) * 0.85;',
    '  col *= 0.92 - smoothstep(0.0, 0.5, d) * 0.18;',
    '',
    '  // grana fine anti-banding',
    '  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.018;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uMouse = gl.getUniformLocation(prog, 'u_mouse');

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    var w = Math.floor(window.innerWidth * dpr);
    var h = Math.floor(window.innerHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  var mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5;
  window.addEventListener('pointermove', function (e) {
    tx = e.clientX / window.innerWidth;
    ty = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  var visible = true;
  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    if (visible) { last = performance.now(); requestAnimationFrame(frame); }
  });

  var start = performance.now(), last = start, clock = 0;
  function frame(now) {
    if (!visible) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;

    mx += (tx - mx) * 0.045;
    my += (ty - my) * 0.045;

    gl.uniform1f(uTime, clock);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.classList.add('is-on');
})();
