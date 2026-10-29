// Procedural Web Audio synthesizer for pet interactions (zero external mp3 lag)

class SoundFX {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Playful happy bark / "woof!"
  markerClick() {
    try{
      this.init();if(!this.ctx)return;
      const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
      oscillator.type='square';oscillator.frequency.setValueAtTime(1600,now);
      gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+.035);
      oscillator.connect(gain);gain.connect(this.ctx.destination);oscillator.start(now);oscillator.stop(now+.04);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }catch{/* Audio may be unavailable; visual marker feedback still works. */}
  }

  bark() {
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      // Pitch drop: quick dog woof envelope
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      // Add a second subtle formant
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(190, now);
      osc2.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
      osc2.start(now);
      osc2.stop(now + 0.2);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }

  // Cute happy yip / purr on pet
  happyYip() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  // Treat chew crunch sound
  eatCrunch() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const offset = i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120 + Math.random() * 60, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.06);
      }
    } catch {}
  }

  // Ball bounce thud
  ballBounce() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.14);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  // Sickness / sad whimper
  whimper() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(420, now + 0.15);
      osc.frequency.linearRampToValueAtTime(360, now + 0.35);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  // Two-tone success chime (e.g. mini-game win or clean mark)
  chimeSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const [idx, freq] of [523.25, 783.99].entries()) {
        const offset = idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.3);
      }
    } catch {}
  }

  // Healing medicine chime
  medicineChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const [idx, freq] of [349.23, 440.0, 523.25, 659.25].entries()) {
        const offset = idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.16, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.4);
      }
    } catch {}
  }

  // Firm scold warning buzzer
  scoldBuzzer() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  }

  // Sweep / scoop clean sound
  sweepClean() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  }
}

export const sound = new SoundFX();
