/**
 * Minimal WebGL pipeline: draw an RGBA frame through a 3x3 color matrix.
 * Used by the lens window; the matrices come from a11y-core.
 */
export class GlFilter {
  private gl: WebGLRenderingContext;
  private matrixLoc: WebGLUniformLocation;
  private texWidth = 0;
  private texHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;

    const vs = this.shader(
      gl.VERTEX_SHADER,
      `attribute vec2 p;
       varying vec2 uv;
       void main() {
         uv = vec2((p.x + 1.0) / 2.0, (1.0 - p.y) / 2.0);
         gl_Position = vec4(p, 0.0, 1.0);
       }`,
    );
    const fs = this.shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float;
       varying vec2 uv;
       uniform sampler2D tex;
       uniform mat3 m;
       void main() {
         vec4 c = texture2D(tex, uv);
         gl_FragColor = vec4(clamp(m * c.rgb, 0.0, 1.0), 1.0);
       }`,
    );
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    }
    gl.useProgram(prog);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.matrixLoc = gl.getUniformLocation(prog, "m")!;
  }

  private shader(kind: number, source: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(kind)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? "shader failed");
    }
    return s;
  }

  /** matrix is row-major 3x3 from a11y-core; GLSL wants column-major. */
  draw(pixels: Uint8Array, width: number, height: number, matrix: number[]) {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    const colMajor = [
      matrix[0], matrix[3], matrix[6],
      matrix[1], matrix[4], matrix[7],
      matrix[2], matrix[5], matrix[8],
    ];
    gl.uniformMatrix3fv(this.matrixLoc, false, colMajor);
    if (width === this.texWidth && height === this.texHeight) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      this.texWidth = width;
      this.texHeight = height;
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

export const IDENTITY_MATRIX = [1, 0, 0, 0, 1, 0, 0, 0, 1];
