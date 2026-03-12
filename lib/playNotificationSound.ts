/**
 * เล่นเสียงแจ้งเตือนสั้นๆ (Web Audio API)
 * บราวเซอร์ส่วนใหญ่บล็อกเสียงจนกว่าผู้ใช้จะมีการโต้ตอบ — เรียก unlockAudioForNotifications() ตอนกดปุ่มเปิดเสียงหรือกดที่หน้าแผนที่ก่อน
 */
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

function playTone(ctx: AudioContext): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {
    // ignore
  }
}

/**
 * ปลดล็อกเสียงแจ้งเตือน — เรียกจากเหตุการณ์ที่ผู้ใช้กด (เช่น ปุ่มเปิดเสียง) เพื่อให้บราวเซอร์อนุญาตเล่นเสียงได้
 * ควรเรียกเมื่อผู้ใช้กดเปิดเสียงแจ้งเตือนหรือกดที่พื้นที่แผนที่ครั้งแรก
 */
export function unlockAudioForNotifications(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => playTone(ctx)).catch(() => {});
  } else {
    playTone(ctx);
  }
}

/**
 * เล่นเสียงแจ้งเตือน (ประกาศ/โดเนท) — โทนเดียว 880Hz sine
 * ถ้า context ยังถูก suspend (ยังไม่เคย unlock) จะลอง resume แล้วเล่น — ถ้าผู้ใช้เคยกดเปิดเสียงแล้วจะได้ยิน
 */
export function playNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => playTone(ctx)).catch(() => {});
    return;
  }
  playTone(ctx);
}

/**
 * เล่นเสียงกระดิ่งแจ้งเตือน (การแจ้งเตือนในแอป) — คนละเสียงกับประกาศ: สองบี๊บ 660Hz
 */
function playBellTone(ctx: AudioContext): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {
    // ignore
  }
}

/**
 * เล่นเสียงกระดิ่งเมื่อมีแจ้งเตือนใหม่ (สองบี๊บสั้น — แยกจากเสียงประกาศ)
 */
export function playBellNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const play = () => {
    playBellTone(ctx!);
    setTimeout(() => {
      if (ctx!.state === "running") playBellTone(ctx!);
    }, 180);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(play).catch(() => {});
    return;
  }
  play();
}
