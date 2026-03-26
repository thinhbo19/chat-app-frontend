/**
 * Hai nốt ngắn liền nhau, dai hon va to hon de de nghe khi co tin moi.
 */
export function playMessageBeep() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    function tone(freq: number, startSec: number, durSec: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(master);
      const t0 = ctx.currentTime + startSec;
      const t1 = t0 + durSec;
      const peak = 0.22;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.04);
      gain.gain.linearRampToValueAtTime(peak * 0.85, t0 + durSec * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.start(t0);
      osc.stop(t1 + 0.03);
    }

    tone(740, 0, 0.32);
    tone(988, 0.26, 0.38);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    /* ignore */
  }
}
