/**
 * Dùng một AudioContext dùng lại + mở khóa sau tương tác người dùng (trình duyệt chặn autoplay).
 */
let sharedCtx: AudioContext | null = null;

/** Gọi sau click/chạm đầu tiên trên app (vd. đăng nhập, bấm sidebar) để âm báo tin hoạt động. */
export function unlockMessageAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AC();
    }
    if (sharedCtx.state === "suspended") {
      void sharedCtx.resume();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Hai nốt ngắn liền nhau. Cần đã unlock (hoặc trình duyệt đã cho phép); nếu vẫn suspended thì bỏ qua.
 */
function playTonesOnContext(audioCtx: AudioContext) {
  const master = audioCtx.createGain();
  master.gain.value = 1;
  master.connect(audioCtx.destination);

  function tone(
    ctx: AudioContext,
    freq: number,
    startSec: number,
    durSec: number,
  ) {
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

  tone(audioCtx, 740, 0, 0.32);
  tone(audioCtx, 988, 0.26, 0.38);
}

export function playMessageBeep() {
  try {
    unlockMessageAudio();
    const audioCtx = sharedCtx;
    if (!audioCtx) return;

    if (audioCtx.state === "running") {
      playTonesOnContext(audioCtx);
      return;
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().then(() => {
        if (audioCtx.state === "running") playTonesOnContext(audioCtx);
      });
    }
  } catch {
    /* ignore */
  }
}
