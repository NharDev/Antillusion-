// Particles + debris for explosions.
const FX = (() => {
  const T = THREE;

  function sprite() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(cv);
  }

  class Particles {
    constructor(max, additive, tex) {
      this.max = max;
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 4);
      this.size = new Float32Array(max);
      this.vel = new Float32Array(max * 3);
      this.life = new Float32Array(max);
      this.maxLife = new Float32Array(max);
      this.grow = new Float32Array(max);
      this.drag = new Float32Array(max);
      this.grav = new Float32Array(max);
      this.base = new Float32Array(max * 4);
      this.next = 0;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      g.setAttribute('color', new T.BufferAttribute(this.col, 4));
      g.setAttribute('size', new T.BufferAttribute(this.size, 1));
      this.geo = g;
      this.uniforms = { tex: { value: tex }, scale: { value: 500 } };
      this.mat = new T.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
          void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D tex; varying vec4 vColor;
          void main(){ vec4 t=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(vColor.rgb, vColor.a*t.a); }`,
        transparent: true, depthWrite: false,
        blending: additive ? T.AdditiveBlending : T.NormalBlending,
      });
      this.points = new T.Points(g, this.mat);
      this.points.frustumCulled = false;
    }
    emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, drag, grav) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grow[i] = grow;
      this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
      this.drag[i] = drag; this.grav[i] = grav;
    }
    update(dt) {
      for (let i = 0; i < this.max; i++) {
        if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; continue; }
        this.life[i] -= dt;
        const k = Math.max(0, this.life[i] / this.maxLife[i]); // 1 -> 0
        const d = Math.max(0, 1 - this.drag[i] * dt);
        this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        this.size[i] += this.grow[i] * dt;
        // colour cools: fire goes orange -> dark red as it dies
        this.col[i * 4] = this.base[i * 4] * (0.4 + 0.6 * k);
        this.col[i * 4 + 1] = this.base[i * 4 + 1] * k;
        this.col[i * 4 + 2] = this.base[i * 4 + 2] * k * k;
        this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, k * 2.2);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
    }
    clear() { this.life.fill(0); }
  }

  let fire, smoke, sparks, debris = [], flashLight, scene, tex, scaleFor;
  const dGeo = new T.BoxGeometry(1, 1, 1);
  const dMat = new T.MeshLambertMaterial({ color: 0x2a2c30 });

  function init(sc) {
    scene = sc;
    tex = sprite();
    fire = new Particles(900, true, tex);
    smoke = new Particles(500, false, tex);
    sparks = new Particles(400, true, tex);
    scene.add(smoke.points, fire.points, sparks.points);
    flashLight = new T.PointLight(0xff9040, 0, 160, 1.5);
    scene.add(flashLight);
  }

  function setScale(h, fov) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    for (const p of [fire, smoke, sparks]) p.uniforms.scale.value = s;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  function dir() {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(th), u, s * Math.sin(th)];
  }

  function explode(pos, scale, color) {
    scale = scale || 1;
    const green = color === 'target';
    for (let i = 0; i < 170; i++) {
      const [dx, dy, dz] = dir(); const sp = rnd(3, 20) * scale;
      fire.emit(pos.x, pos.y, pos.z, dx * sp, dy * sp * 0.9 + 2, dz * sp, rnd(0.5, 1.5), rnd(2.5, 6) * scale, rnd(2, 6) * scale,
        1.0, green ? 0.85 : 0.75, green ? 0.55 : 0.35, 0.9, 1.6, -1.5);
    }
    for (let i = 0; i < 90; i++) {
      const [dx, dy, dz] = dir(); const sp = rnd(1, 9) * scale;
      smoke.emit(pos.x, pos.y, pos.z, dx * sp, Math.abs(dy) * sp + 2, dz * sp, rnd(2, 4.5), rnd(3, 6) * scale, rnd(2, 4) * scale,
        0.22, 0.22, 0.24, 0.85, 1.0, -1.2);
    }
    for (let i = 0; i < 90; i++) {
      const [dx, dy, dz] = dir(); const sp = rnd(10, 38) * scale;
      sparks.emit(pos.x, pos.y, pos.z, dx * sp, dy * sp, dz * sp, rnd(0.6, 1.8), rnd(0.35, 0.8), 0,
        1, 0.9, 0.5, 1, 0.4, 14);
    }
    flashLight.position.copy(pos);
    flashLight.intensity = 6 * scale;
    flashLight.color.setHex(green ? 0xffc080 : 0xff8a40);
    if (!green) {
      for (let i = 0; i < 12; i++) {
        const m = new T.Mesh(dGeo, dMat);
        const s = rnd(0.15, 0.5);
        m.scale.set(s * rnd(1, 3), s, s * rnd(1, 2));
        m.position.copy(pos);
        const [dx, dy, dz] = dir(); const sp = rnd(5, 16);
        m.userData = { v: new T.Vector3(dx * sp, Math.abs(dy) * sp + 3, dz * sp), w: new T.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), t: 5 };
        scene.add(m); debris.push(m);
      }
    }
  }

  function update(dt) {
    fire.update(dt); smoke.update(dt); sparks.update(dt);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 9);
    for (let i = debris.length - 1; i >= 0; i--) {
      const m = debris[i], u = m.userData;
      u.v.y -= 16 * dt;
      m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt; m.rotation.z += u.w.z * dt;
      if (m.position.y < 0.2) { m.position.y = 0.2; u.v.y *= -0.35; u.v.x *= 0.6; u.v.z *= 0.6; u.w.multiplyScalar(0.6); }
      u.t -= dt;
      if (u.t <= 0) { scene.remove(m); debris.splice(i, 1); }
    }
  }

  function clear() {
    fire.clear(); smoke.clear(); sparks.clear();
    debris.forEach((m) => scene.remove(m)); debris = [];
    flashLight.intensity = 0;
  }

  return { init, setScale, explode, update, clear };
})();
