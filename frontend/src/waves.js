// Fundo em ondas (issue #92): o shader "Waves" feito no Shader Builder do 21st.dev, em WebGL1 puro, sem biblioteca.
// Os uniforms são os que o Shader Builder exporta para esta receita, com o cursor desligado. Carregado à parte (ui.jsx,
// Waves), só no layout de computador.

// u_scene.z = segundos × 0,86 (velocidade 40/100).
export const SPEED = 0.86;
// Densidade de pixels limitada a 2: acima disso o custo sobe e o fundo não fica mais nítido.
export const MAX_DPR = 2;
// No máximo 30 quadros por segundo: as ondas são lentas, e a GPU faz metade do trabalho de 60 Hz. A folga de 2 ms
// absorve a oscilação da hora de cada quadro: a 60 Hz sai um quadro sim, um não, sem cair para 20 por segundo.
export const FRAME_MS = 1000 / 30;
const FRAME_SLACK_MS = 2;
// Depois de um quadro desenhado, o pedido do próximo espera este tempo num temporizador: pedir um quadro a cada quadro
// da tela acordava a thread principal 240 vezes por segundo numa tela de 240 Hz para desenhar 30. Os 4 ms a menos dão
// tempo de o pedido sair antes do quadro da tela em que as ondas desenham de novo.
export const FRAME_WAIT_MS = FRAME_MS - FRAME_SLACK_MS - 4;
// Um quadro anda no máximo 100 ms do tempo das ondas: uma trava da página não vira um salto delas.
export const MAX_STEP_MS = 100;
// Depois de uma hora o tempo volta a zero quando a aba reaparece: em float, um número grande perde precisão.
export const RESTART_S = 3600;
// O contexto não sai antes de 1,5 s da abertura da página, nem de 1 s depois de pedido (o JS do app pode chegar tarde):
// até lá a GPU ainda cuida dos primeiros quadros, e o getContext esperava por ela de 0,1 a 0,7 s na thread principal
// (Chromium com GPU de verdade, sem cache); depois, ~3 ms.
const SETTLE_MS = 1500;
// Canvas que já têm contexto: neles o getContext só devolve o que existe, sem esperar a GPU (menos de 1 ms), e o
// começo novo (a troca do "Fundo animado", a janela alargada de novo) sai na própria chamada. Pelo requestIdleCallback
// ele às vezes ficava para o prazo de 2 s, com a janela do perfil fechando logo depois do clique.
const warm = new WeakSet();

export const UNIFORMS = {
  // Cores do mais escuro ao mais claro: #031C26, #1B6CA8, #5AD2F4 e #EAF9FF. O shader tem 8 vagas; só 4 são usadas.
  colors: [
    0.012, 0.110, 0.149,
    0.106, 0.424, 0.659,
    0.353, 0.824, 0.957,
    0.918, 0.976, 1.000,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  colorCount: 4,
  shape: [1.08, 0.62, 0.50, 0.24],
  surface: [2.91, 1.16, 0.00, 1.00],
  finish: [0.00, 0.00, 0.000, 0.04],
  transform: [1.0, 4.08, 0.00, 0.0],
  // Ponteiro em 0 e presença 0: o cursor fica desligado.
  space: [0.00, 0.00, 0, 0],
  cursor: [0, 2.0, 0.65, 0.46],
};

// Tamanho do buffer em pixels do aparelho para um canvas de width × height em pixels CSS.
export function canvasSize(width, height, ratio) {
  const r = Math.min(ratio || 1, MAX_DPR);
  return [Math.max(1, Math.round(width * r)), Math.max(1, Math.round(height * r))];
}

// Um passo do relógio das ondas, que conta só o tempo animado. seconds é o tempo até aqui; last, a hora (ms) do último
// quadro desenhado, ou null logo depois de o laço tocar (aí o relógio não anda); now, a hora deste quadro. Devolve o
// tempo novo, ou null quando ainda não deu o tempo de um quadro.
export function tick(seconds, last, now) {
  if (last === null) return seconds;
  const step = now - last;
  return step < FRAME_MS - FRAME_SLACK_MS ? null : seconds + Math.min(step, MAX_STEP_MS) / 1000;
}

// Retângulos do scissor (x, y, largura e altura em pixels do aparelho, com y de baixo para cima, como no WebGL) que
// cobrem o canvas fora do palco. stage é o retângulo do palco em px CSS (getBoundingClientRect), radius o raio das
// quinas, scale os pixels do aparelho por px CSS, scroll a rolagem da página e end a rolagem no fim dela (px CSS).
// O buraco só cobre o que o palco cobre em qualquer ponto da rolagem: do topo dele com a rolagem em zero ao pé dele no
// fim da rolagem. Assim a página pode rolar quanto for entre dois quadros (a troca de página volta ao topo num salto)
// sem mostrar canvas sem desenho. O buraco perde o raio em volta: dos lados, para as quinas redondas ficarem com ondas;
// em cima e embaixo, porque a rolagem tem fração de px e o fim dela vem arredondado. Palco pequeno demais para ter
// buraco: o canvas inteiro.
export function bands(stage, radius, width, height, scale, scroll = 0, end = 0) {
  const fit = (v, max) => Math.min(max, Math.max(0, v));
  // A rolagem elástica passa de zero e do fim: lá vale o retângulo de agora.
  const y = fit(scroll, end);
  const left = fit(Math.ceil((stage.left + radius) * scale), width);
  const right = fit(Math.floor((stage.right - radius) * scale), width);
  const top = fit(Math.ceil((stage.top + y + radius) * scale), height);
  const bottom = fit(Math.floor((stage.bottom + y - end - radius) * scale), height);
  if (right <= left || bottom <= top) return [[0, 0, width, height]];
  return [
    [0, 0, left, height],
    [right, 0, width - right, height],
    [left, height - top, right - left, top],
    [left, 0, right - left, height - bottom],
  ].filter(([, , w, h]) => w > 0 && h > 0);
}

// Um triângulo que cobre a tela inteira: três vértices em vez dos seis de um retângulo.
const VERT = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const FRAG = `// "Waves" — made with the 21st.dev Shader Builder
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
// Seven packed vectors + eight colour vectors = 15 fragment uniform vectors,
// one below WebGL1's guaranteed minimum. Macros preserve the public u_* API.
uniform vec4 u_scene;      // resolution.xy, time, colour count
uniform vec4 u_shape;      // scale, intensity, paramA, warp
uniform vec4 u_surface;    // detail, contrast, brightness, saturation
uniform vec4 u_finish;     // hue, vignette, blur, grain
uniform vec4 u_transform;  // seed, rotation, drift, OKLab toggle
uniform vec4 u_space;      // offset.xy, pointer.xy
uniform vec4 u_cursor;

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
// Keep hash inputs inside mediump's guaranteed ±2^14 range.
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w

float hash21(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Even, un-structured white noise for film grain (Dave Hoskins hash12). The
// multiply hash above is fine for value noise but shows a faint axis-aligned
// mesh at integer fragment coords, which reads as a net over flat areas.
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(15731.743, 7892.321) * n);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

// --- OKLab colour mixing (perceptual), gated by u_oklab -----------------------
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  // max() guards the sRGB branch: out-of-gamut OKLab interpolations can send a
  // channel negative, and pow(negative, …) is NaN which mix()/step() would
  // then propagate. The linear branch clips such channels to 0 downstream.
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, c));
}
vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixColour(vec3 a, vec3 b, float t) {
  if (u_oklab > 0.5) {
    vec3 la = linToOklab(srgbToLinear(a));
    vec3 lb = linToOklab(srgbToLinear(b));
    return clamp(linearToSrgb(oklabToLin(mix(la, lb, t))), 0.0, 1.0);
  }
  return mix(a, b, t);
}

// Mix through the recipe colours; x is clamped to 0..1. WebGL1 forbids
// dynamic uniform indexing in fragment shaders, hence the constant loop.
vec3 palette(float x) {
  float n = max(u_colorCount - 1.0, 1.0);
  float f = clamp(x, 0.0, 1.0) * n;
  vec3 col = u_colors[0];
  for (int i = 0; i < 7; i++) {
    if (float(i) < n)
      col = mixColour(col, u_colors[i + 1],
        smoothstep(0.0, 1.0, clamp(f - float(i), 0.0, 1.0)));
  }
  return col;
}

vec3 hueRotate(vec3 col, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}

vec3 shade(vec2 uv, vec2 p, float t) {
  float y = uv.y
    + sin(uv.x * (3.0 + u_intensity * 9.0) + t * 0.8) * 0.08
    + (fbm(p * 2.0 + t * 0.1) - 0.5) * u_intensity * 0.6;
  return palette(y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);
  float cursorMask = 0.0;

  // Cursor modes 1–3 are local distortions. Push shifts the same screen-space
  // coordinates before field transforms, so Zoom/Rotate don't change its feel.
  if (u_cursorPresence > 0.001) {
    // u_mouse is normalized to -1..1 in canvas space. Convert it to the same
    // aspect-corrected screen space as p so effects stay under the cursor.
    vec2 cursor = (0.5 * u_mouse * u_resolution.xy)
      / min(u_resolution.x, u_resolution.y);
    vec2 cursorDelta = p - cursor;
    if (u_cursorEffect < 0.5) {
      p += cursor * u_cursorPresence * u_cursorStrength * 0.55;
    } else {
      float cursorDistance = length(cursorDelta);
      vec2 cursorDirection = cursorDelta / max(cursorDistance, 0.0001);
      cursorMask = u_cursorPresence
        * (1.0 - smoothstep(0.0, u_cursorRadius, cursorDistance));
      if (u_cursorEffect < 1.5) {
        p -= cursorDirection * cursorMask * u_cursorStrength * 0.24;
      } else if (u_cursorEffect < 2.5) {
        float cursorAngle = cursorMask * u_cursorStrength * 2.2;
        float cc = cos(cursorAngle), cs = sin(cursorAngle);
        p = cursor + mat2(cc, -cs, cs, cc) * cursorDelta;
      } else if (u_cursorEffect < 3.5) {
        float ripple = sin(
          cursorDistance / max(u_cursorRadius, 0.001) * 18.0 - u_time * 5.0);
        p -= cursorDirection * ripple * cursorMask * u_cursorStrength * 0.07;
      }
    }
  }

  // Keep presets that read uv (rather than p) in the same warped space.
  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;
  // Field transform: rotate, pan, pointer push, slow drift.
  if (abs(u_rotate) > 0.0001) {
    float cr = cos(u_rotate), sr = sin(u_rotate);
    p = mat2(cr, -sr, sr, cr) * p;
  }
  p += u_offset;
  if (u_drift > 0.0001)
    p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  // Organic domain warp.
  if (u_warp > 0.0) {
    p += u_warp * (vec2(
      fbm(p * u_detail + u_seed),
      fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
  }
  // Shade, with an optional soft 5-tap blur.
  vec3 col;
  if (u_blur > 0.0) {
    float e = u_blur;
    float pe = e * u_scale;
    vec2 uvE = vec2(e) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
    col  = shade(uv, p, u_time) * 0.36;
    col += shade(uv + vec2(uvE.x, 0.0), p + vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv - vec2(uvE.x, 0.0), p - vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv + vec2(0.0, uvE.y), p + vec2(0.0, pe), u_time) * 0.16;
    col += shade(uv - vec2(0.0, uvE.y), p - vec2(0.0, pe), u_time) * 0.16;
  } else {
    col = shade(uv, p, u_time);
  }
  // Post: contrast, saturation, hue, brightness, vignette, grain.
  if (abs(u_contrast - 1.0) > 0.0001)
    col = (col - 0.5) * u_contrast + 0.5;
  if (abs(u_saturation - 1.0) > 0.0001) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, u_saturation);
  }
  if (abs(u_hue) > 0.0001)
    col = hueRotate(col, u_hue);
  if (abs(u_brightness) > 0.0001)
    col += u_brightness;
  if (u_vignette > 0.0001) {
    float vd = length(screenUv - 0.5) * 1.41421356;
    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
  }
  if (u_cursorPresence > 0.001 && u_cursorEffect > 3.5)
    col += (vec3(0.18) + col * 0.12) * cursorMask * u_cursorStrength;
  if (u_grain > 0.0001)
    col += (grainHash(
      gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// Liga o fundo ao canvas e devolve a função que o desliga, que também cancela o que ainda está esperando (só o shader
// que ainda está ligando espera a ligação acabar para ser apagado). A primeira vez num canvas, o trabalho começa quando
// a página fica livre (requestIdleCallback; sem ele, na hora marcada), não antes de SETTLE_MS da abertura nem de 1 s
// depois da chamada; no canvas que já tem contexto (warm), começa na própria chamada. Só roda com WebGL na GPU: com
// failIfMajorPerformanceCaveat, o renderizador por software não dá contexto, e fica o fundo de CSS. Com
// KHR_parallel_shader_compile o driver compila e liga o shader fora da thread principal, e cada quadro só pergunta se
// acabou; sem ela, a ligação trava a página até acabar, como antes.
// onActive(true) sai junto com o primeiro quadro, também quando o contexto volta; onActive(false), quando falta WebGL,
// o shader é recusado ou o contexto se perde (ou já chega perdido).
// animate verdadeiro: o laço, a no máximo 30 quadros por segundo, desenha só as faixas em volta do palco (bands), e o
// buraco atrás dele fica no tom do palco.
// animate falso (movimento reduzido ou "Fundo animado" desligado): um quadro parado da tela inteira, redesenhado quando o
// tamanho ou a densidade de pixels mudam.
export function startWaves(canvas, { animate = true, onActive = () => {} } = {}) {
  let gl = null;
  let ext = null;
  let program = null;
  let buffer = null;
  let scene = null;
  let ready = false;
  let scale = 1;
  let seconds = 0;
  let last = null;
  let raf = 0;
  let wait = 0;
  let poll = 0;
  let stopped = false;
  let density = null;

  // u_resolution é sempre o canvas inteiro: o scissor só escolhe que pixels saem, e o desenho não muda.
  function paint(full) {
    const stage = full ? null : document.querySelector('main');
    const root = document.documentElement;
    const parts = stage
      ? bands(stage.getBoundingClientRect(), parseFloat(getComputedStyle(stage).borderTopLeftRadius) || 0,
        canvas.width, canvas.height, scale, window.scrollY, root.scrollHeight - root.clientHeight)
      : [[0, 0, canvas.width, canvas.height]];
    // O buraco das faixas fica no tom do palco (o clearColor do setup), não no preto em que o navegador deixa o buffer
    // depois de cada quadro mostrado (o contexto não pede preserveDrawingBuffer): num salto da rolagem, a parte do palco
    // que o navegador ainda não desenhou deixa o canvas à vista por um quadro. O clear respeita o scissor, por isso ele
    // sai desligado.
    if (stage) {
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
    }
    gl.uniform4f(scene, canvas.width, canvas.height, seconds * SPEED, UNIFORMS.colorCount);
    for (const part of parts) {
      gl.scissor(...part);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function size() {
    const width = canvas.clientWidth || window.innerWidth;
    const [w, h] = canvasSize(width, canvas.clientHeight || window.innerHeight, window.devicePixelRatio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    scale = w / width;
    gl.viewport(0, 0, w, h);
  }

  function setup() {
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const at = name => gl.getUniformLocation(program, name);
    gl.uniform3fv(at('u_colors'), new Float32Array(UNIFORMS.colors));
    gl.uniform4fv(at('u_shape'), UNIFORMS.shape);
    gl.uniform4fv(at('u_surface'), UNIFORMS.surface);
    gl.uniform4fv(at('u_finish'), UNIFORMS.finish);
    gl.uniform4fv(at('u_transform'), UNIFORMS.transform);
    gl.uniform4fv(at('u_space'), UNIFORMS.space);
    gl.uniform4fv(at('u_cursor'), UNIFORMS.cursor);
    scene = at('u_scene');
    gl.enable(gl.SCISSOR_TEST);
    // O tom do palco com as ondas ligadas: o --glass de :root[data-waves], em styles.css. Mudou lá, mude aqui.
    gl.clearColor(8 / 255, 8 / 255, 8 / 255, 1);
  }

  // Compila e liga sem perguntar o estado: a pergunta trava até o driver acabar. A extensão é pedida de novo a cada
  // vez, porque a de um contexto perdido não vale no que volta. Contexto já perdido (o canvas é o mesmo da vez
  // anterior, e ele se perdeu com as ondas desligadas; quem ouviu a perda foi o ouvinte fixo do Waves, em ui.jsx):
  // fica o fundo de CSS, e o webglcontextrestored chama de novo quando ele voltar.
  function link() {
    if (gl.isContextLost()) return onActive(false);
    ext = gl.getExtension('KHR_parallel_shader_compile');
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    check();
  }

  // Com a extensão, só lê LINK_STATUS quando COMPLETION_STATUS_KHR diz que a ligação acabou (=== false: um erro, que
  // devolve null, cai na leitura direta em vez de esperar para sempre). poll tem valor enquanto a ligação está em
  // andamento. Desligado no meio dela (stopped), o fundo só apaga o programa aqui, com a ligação acabada.
  function check() {
    poll = 0;
    if (ext && gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR) === false) {
      poll = requestAnimationFrame(check);
      return;
    }
    if (stopped) {
      gl.deleteProgram(program);
      return;
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      onActive(false);
      return;
    }
    setup();
    ready = true;
    render();
    onActive(true);
  }

  // Depois de um quadro desenhado, o pedido do próximo espera no temporizador; o quadro que chega cedo pede o seguinte
  // direto. O laço está tocando enquanto raf ou wait têm valor, e nunca há dois.
  function frame(now) {
    const next = tick(seconds, last, now);
    if (next === null) {
      raf = requestAnimationFrame(frame);
      return;
    }
    seconds = next;
    last = now;
    paint(false);
    raf = 0;
    wait = setTimeout(() => {
      wait = 0;
      raf = requestAnimationFrame(frame);
    }, FRAME_WAIT_MS);
  }
  // Ao voltar a tocar, a referência do relógio zera: o tempo parado não conta.
  function play() {
    if (raf || wait || !ready || document.hidden) return;
    last = null;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    cancelAnimationFrame(raf);
    clearTimeout(wait);
    raf = wait = 0;
  }
  // Mudar o tamanho do canvas apaga o que estava nele: redesenha na hora, sem esperar o próximo quadro do laço.
  function render() {
    if (!ready) return;
    size();
    paint(!animate);
    if (animate) play();
  }
  // Aba escondida: o laço para. De volta, ele continua de onde estava, ou do zero depois de uma hora.
  function onVisibility() {
    if (document.hidden) return pause();
    if (seconds > RESTART_S) seconds = 0;
    if (animate) play();
  }
  // A janela foi para uma tela de outra densidade, ou o zoom mudou: a consulta vale só para a densidade de agora.
  function onDensity() {
    watchDensity();
    render();
  }
  function watchDensity() {
    density?.removeEventListener('change', onDensity);
    density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    density.addEventListener('change', onDensity);
  }
  function onLost(e) {
    e.preventDefault();
    ready = false;
    pause();
    cancelAnimationFrame(poll);
    onActive(false);
  }

  function begin() {
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true,
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      onActive(false);
      return;
    }
    warm.add(canvas);
    window.addEventListener('resize', render);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    // O contexto voltou: só desenha de novo se o shader ligar outra vez (check).
    canvas.addEventListener('webglcontextrestored', link);
    watchDensity();
    link();
  }

  let idle = 0;
  let timer = 0;
  if (warm.has(canvas)) begin();
  else {
    timer = setTimeout(() => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(begin, { timeout: 2000 });
      else begin();
    }, Math.max(SETTLE_MS - performance.now(), 1000));
  }

  return () => {
    stopped = true;
    clearTimeout(timer);
    if (idle) cancelIdleCallback(idle);
    pause();
    window.removeEventListener('resize', render);
    document.removeEventListener('visibilitychange', onVisibility);
    density?.removeEventListener('change', onDensity);
    if (!gl) return;
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', link);
    if (!gl.isContextLost()) {
      gl.deleteBuffer(buffer);
      // O programa que ainda está ligando fica para o check(): apagado antes, a consulta de conclusão que o Chromium
      // abriu para ele continua perguntando por um programa que não existe, e o console enche de avisos do ANGLE
      // ("glGetProgramiv: Program object expected").
      if (!poll) gl.deleteProgram(program);
    }
  };
}
