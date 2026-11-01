import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Download, Share2, RefreshCw, Aperture } from 'lucide-react';
import type { DogProfile } from '../types/dog';

/**
 * THE PHOTO BOOTH.
 *
 * Turn the owner's camera on — phone front camera first, laptop webcam too —
 * and compose a portrait: the owner's live video beside the dog in one of his
 * authored poses, with his name and the moment stamped on the print. The
 * picture is made ON the device, handed over as a download or a share sheet,
 * and never uploaded by this feature. Local-first applies to photographs too.
 *
 * Mechanics are the standard ones: getUserMedia for the stream, a canvas
 * composite for the print, toBlob for the file, navigator.share (with a
 * download fallback) to hand it over. The camera stops the moment the booth
 * closes — a lens left open is a bug, not a feature.
 */

type Pose = 'stand' | 'sit' | 'bow' | 'paw';
const POSES: { id: Pose; label: string }[] = [
  { id: 'stand', label: 'Stand' },
  { id: 'sit', label: 'Sit' },
  { id: 'bow', label: 'Bow' },
  { id: 'paw', label: 'Paw' },
];

export const PhotoBooth: React.FC<{ dog: DogProfile; artUrl: string; onClose: () => void }> = ({ dog, artUrl, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const artRef = useRef<HTMLImageElement | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [pose, setPose] = useState<Pose>('sit');
  const [err, setErr] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [artReady, setArtReady] = useState(false);

  const artFor = (p: Pose) => (p === 'stand' ? artUrl : artUrl.replace('.webp', `-${p}.webp`));

  // The pose art loads like any illustration; a missing pose keeps the last
  // good one rather than printing a hole.
  useEffect(() => {
    const img = new Image();
    img.onload = () => { artRef.current = img; setArtReady(true); };
    img.onerror = () => { if (pose !== 'stand') setPose('stand'); };
    img.src = artFor(pose);
  }, [pose, artUrl]);

  // The camera lives exactly as long as the booth does.
  useEffect(() => {
    let dead = false;
    setErr('');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no mediaDevices');
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (dead) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      } catch {
        if (!dead) setErr('Camera unavailable. Allow camera access in the browser — or open this page on a phone and try again.');
      }
    })();
    return () => {
      dead = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  // THE PRINT. Cover-fit the video, the dog beside it, and a caption bar in
  // the household's own type: name, breed, and the moment.
  const compose = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const W = 1080, H = 1440, BAR = 150;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const paper = getComputedStyle(document.querySelector('.illustrated-stage') || document.body).getPropertyValue('--bg-surface').trim() || '#fbfaee';
    const ink = getComputedStyle(document.querySelector('.illustrated-stage') || document.body).getPropertyValue('--text-main').trim() || '#294434';
    const accent = getComputedStyle(document.querySelector('.illustrated-stage') || document.body).getPropertyValue('--accent').trim() || '#386344';
    // Cover-fit the frame; the front camera reads mirrored, like a mirror.
    const scale = Math.max(W / video.videoWidth, (H - BAR) / video.videoHeight);
    const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
    ctx.save();
    if (facing === 'user') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, (W - dw) / 2, (H - BAR - dh) / 2, dw, dh);
    ctx.restore();
    // The dog, bottom-right, standing on the caption bar's edge.
    const art = artRef.current;
    if (art) {
      const ah = (H - BAR) * 0.58, aw = art.width / art.height * ah;
      ctx.drawImage(art, W - aw - 24, H - BAR - ah + 18, aw, ah);
    }
    // Caption bar.
    ctx.fillStyle = paper;
    ctx.fillRect(0, H - BAR, W, BAR);
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - BAR, 10, BAR);
    ctx.fillStyle = ink;
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 52px "Josefin Sans", "Source Sans 3", sans-serif';
    const when = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    ctx.fillText(`${dog.name}${dog.thaiName ? ' · ' + dog.thaiName : ''}`, 34, H - BAR + 62);
    ctx.font = '30px "Source Sans 3", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(when, 34, H - BAR + 112);
    ctx.fillStyle = ink;
    const breed = `${dog.breed}`;
    ctx.fillText(breed, W - 34 - ctx.measureText(breed).width, H - BAR + 62);
    ctx.font = '24px "Source Sans 3", sans-serif';
    ctx.fillStyle = accent;
    const mark = 'TAMA-DOG-CHI';
    ctx.fillText(mark, W - 34 - ctx.measureText(mark).width, H - BAR + 112);
    canvas.toBlob(
      b => { if (b) { setShot(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(b); }); } },
      'image/jpeg', 0.92
    );
  };

  const download = () => {
    if (!shot) return;
    const a = document.createElement('a');
    a.href = shot;
    a.download = `${dog.name}-${new Date().toISOString().slice(0, 10)}.jpg`;
    a.click();
  };

  const share = async () => {
    if (!shot) return;
    const blob = await (await fetch(shot)).blob();
    const file = new File([blob], `${dog.name}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${dog.name} · Tama-Dog-Chi` }); } catch { /* owner cancelled the sheet */ }
    } else download();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/92 flex flex-col select-none" role="dialog" aria-label={`Photo booth with ${dog.name}`}>
      <div className="flex items-center justify-between px-3 py-2 border-hairline-b bg-black">
        <span className="label text-[12px] text-zinc-200"><Camera size={14} className="inline mr-1.5 -mt-0.5" aria-hidden="true" />Photo with {dog.name}</span>
        <button type="button" onClick={onClose} aria-label="Close the photo booth" className="btn btn-quiet text-zinc-300 px-2"><X size={18} /></button>
      </div>

      {shot ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-3">
          <img src={shot} alt={`Portrait of ${dog.name} with you, stamped ${new Date().toLocaleString()}`} className="max-h-[70vh] max-w-full border-hairline" />
          <div className="flex gap-2">
            <button type="button" onClick={share} className="btn btn-accent text-[13px] px-3"><Share2 size={14} aria-hidden="true" />Share</button>
            <button type="button" onClick={download} className="btn btn-quiet border-hairline text-[13px] px-3 text-zinc-200"><Download size={14} aria-hidden="true" />Download</button>
            <button type="button" onClick={() => setShot(null)} className="btn btn-quiet border-hairline text-[13px] px-3 text-zinc-300"><RefreshCw size={14} aria-hidden="true" />Retake</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
          <video ref={videoRef} playsInline muted autoPlay className={`max-h-full max-w-full ${facing === 'user' ? 'scale-x-[-1]' : ''}`} />
          {artReady && artRef.current && (
            <img src={artRef.current.src} alt="" aria-hidden="true" className="absolute bottom-[12%] right-[4%] h-[46%] pointer-events-none" />
          )}
          {err && (
            <div className="absolute inset-x-4 bottom-16 border-hairline bg-zinc-950/95 p-3">
              <p className="text-[12px] leading-snug text-zinc-200">{err}</p>
            </div>
          )}
        </div>
      )}

      {!shot && (
        <div className="border-hairline-t bg-black px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Dog pose">
            {POSES.map(p => (
              <button key={p.id} type="button" onClick={() => setPose(p.id)} aria-pressed={pose === p.id}
                className={`btn text-[11px] px-2 py-1 shrink-0 ${pose === p.id ? 'btn-accent' : 'btn-quiet border-hairline text-zinc-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}
              aria-label="Flip camera" title="Flip camera" className="btn btn-quiet border-hairline text-zinc-300 px-2 py-2">
              <RefreshCw size={16} />
            </button>
            <button type="button" onClick={compose} disabled={!!err} aria-label="Take the photo"
              className="btn btn-accent rounded-full w-14 h-14 min-h-0 p-0 flex items-center justify-center disabled:opacity-40">
              <Aperture size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
