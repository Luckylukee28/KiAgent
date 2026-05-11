type MessageHandler = (data: { agent: string; message: string }) => void

let socket: WebSocket | null = null
let queue: { agent: string; message: string }[] = []
let processing = false

async function processQueue(onMessage: MessageHandler) {
  if (processing) return
  processing = true
  while (queue.length > 0) {
    const msg = queue.shift()!
    onMessage(msg)
    // Short thinking messages get less delay, full responses get more
    const isThinking = msg.message.endsWith('...') && msg.message.length < 80
    await new Promise((r) => setTimeout(r, isThinking ? 300 : 600))
  }
  processing = false
}

export function connectWS(onMessage: MessageHandler): WebSocket {
  socket = new WebSocket('ws://localhost:8000/ws')

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.agent && data.message) {
        queue.push(data)
        processQueue(onMessage)
      }
    } catch {}
  }

  socket.onerror = (e) => console.error('WS error', e)

  return socket
}

export function disconnectWS() {
  socket?.close()
  socket = null
  queue = []
  processing = false
}
