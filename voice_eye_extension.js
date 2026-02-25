class VoiceEyeExtension {
  constructor() {
    /* ===== 音量関係 ===== */
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.volume = 0;
    this.audioInitialized = false;

    /* ===== カメラ・目関係 ===== */
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;

    this.results = null;
    this.faceMesh = null;

    this.initCamera();
    this.initFaceMesh();
  }

  /* =====================
      Scratch 情報
  ===================== */
  getInfo() {
    return {
      id: 'voiceEye',
      name: 'Voice & Eye Sensor',
      blocks: [
        {
          opcode: 'getVolume',
          blockType: Scratch.BlockType.REPORTER,
          text: '声の音量'
        },
        {
          opcode: 'leftEAR',
          blockType: Scratch.BlockType.REPORTER,
          text: '左目の縦横比'
        },
        {
          opcode: 'rightEAR',
          blockType: Scratch.BlockType.REPORTER,
          text: '右目の縦横比'
        }
      ]
    };
  }

  /* =====================
      音量処理
  ===================== */
  async initMic() {
    if (this.audioInitialized) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    this.dataArray = new Uint8Array(this.analyser.fftSize);
    source.connect(this.analyser);

    this.audioInitialized = true;
    this.updateVolume();
  }

  updateVolume() {
    if (!this.analyser) return;

    this.analyser.getByteTimeDomainData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sum += v * v;
    }

    const rms = Math.sqrt(sum / this.dataArray.length);
    this.volume = Math.min(100, Math.floor(rms * 200));

    requestAnimationFrame(() => this.updateVolume());
  }

  getVolume() {
    this.initMic();
    return this.volume;
  }

  /* =====================
      カメラ初期化
  ===================== */
  async initCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video.srcObject = stream;
  }

  async initFaceMesh() {
    await this.loadScript(
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
    );

    this.faceMesh = new FaceMesh.FaceMesh({
      locateFile: f =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.faceMesh.onResults(r => {
      this.results = r;
    });

    this.loop();
  }

  async loop() {
    if (this.faceMesh) {
      await this.faceMesh.send({ image: this.video });
    }
    requestAnimationFrame(() => this.loop());
  }

  loadScript(src) {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  /* =====================
      目の計算
  ===================== */
  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  calcEAR(p, h1, h2, v1, v2) {
    const horizontal = this.dist(p[h1], p[h2]);
    const vertical = this.dist(p[v1], p[v2]);
    return horizontal > 0 ? vertical / horizontal : 0;
  }

  leftEAR() {
    const face = this.results?.multiFaceLandmarks?.[0];
    if (!face) return 0;
    return this.calcEAR(face, 33, 133, 159, 145);
  }

  rightEAR() {
    const face = this.results?.multiFaceLandmarks?.[0];
    if (!face) return 0;
    return this.calcEAR(face, 362, 263, 386, 374);
  }
}

Scratch.extensions.register(new VoiceEyeExtension());
