import { useEffect, useRef, useState } from "react";
import { FiPause, FiPlay } from "react-icons/fi";

function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  isMine: boolean;
  showSentLabel?: boolean;
};

export function ChatAudioMessage({ src, isMine }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      void a.play();
    }
  }

  const barCount = 26;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className={`audio-msg-wrap ${isMine ? "audio-msg-wrap--mine" : "audio-msg-wrap--other"}`}>
      <div className={`audio-msg-pill ${isMine ? "audio-msg-pill--mine" : "audio-msg-pill--other"}`}>
        <audio ref={audioRef} src={src} preload="metadata" />
        <button
          type="button"
          className="audio-msg-play"
          onClick={toggle}
        >
          {playing ? <FiPause size={18} /> : <FiPlay size={18} style={{ marginLeft: 2 }} />}
        </button>
        <div className={`audio-msg-wave ${playing ? "audio-msg-wave--playing" : ""}`} aria-hidden>
          {Array.from({ length: barCount }, (_, i) => {
            const h = 5 + ((i * 11 + (i % 4) * 3) % 16);
            const lit = (i + 1) / barCount <= progress;
            return (
              <span
                key={i}
                className={`audio-msg-bar ${lit ? "audio-msg-bar--lit" : ""}`}
                style={{ height: h }}
              />
            );
          })}
        </div>
        <span className="audio-msg-dur">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
