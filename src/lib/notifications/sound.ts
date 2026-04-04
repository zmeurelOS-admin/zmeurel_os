/**
 * Sunet scurt pentru notificări importante. Încearcă `/sounds/notification.mp3` dacă există,
 * altfel fallback Web Audio (fără fișier în repo).
 */
export function playNotificationSound(opts: {
  type: string
  playSound: boolean
}): void {
  const { type, playSound } = opts
  if (!playSound || typeof window === 'undefined') return
  if (type !== 'order_new') return
  if (document.hidden || document.visibilityState === 'hidden') return

  void playOrderNewSound()
}

async function playOrderNewSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3')
    audio.volume = 0.35
    await audio.play()
  } catch {
    playWebAudioChime()
  }
}

function playWebAudioChime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 784
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.24)
    setTimeout(() => void ctx.close(), 400)
  } catch {
    // autoplay blocat sau browser fără Web Audio
  }
}
