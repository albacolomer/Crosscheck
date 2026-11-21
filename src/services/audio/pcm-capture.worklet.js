class PcmCapture extends globalThis.AudioWorkletProcessor {
  constructor() {
    super()
    this.frameSize = Math.round(globalThis.sampleRate / 10)
    this.buffer = new ArrayBuffer(this.frameSize * 2)
    this.view = new DataView(this.buffer)
    this.offset = 0
    this.finished = false

    this.port.onmessage = ({ data }) => {
      if (data !== 'flush') return
      this.finished = true
      this.sendFrame()
      this.port.postMessage('flushed')
    }
  }

  sendFrame() {
    if (this.offset === 0) return
    const data = this.buffer.slice(0, this.offset * 2)
    this.port.postMessage(data, [data])
    this.offset = 0
  }

  process(inputs) {
    if (this.finished) return false
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (const sample of channel) {
      const clamped = Math.min(1, Math.max(-1, sample))
      const value = clamped < 0 ? clamped * 32768 : clamped * 32767
      this.view.setInt16(this.offset * 2, value, true)
      this.offset += 1
      if (this.offset === this.frameSize) this.sendFrame()
    }

    return true
  }
}

globalThis.registerProcessor('crosscheck-pcm-capture', PcmCapture)
