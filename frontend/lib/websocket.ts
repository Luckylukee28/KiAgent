type MessageHandler = (data: { agent: string; message: string }) => void

let socket: WebSocket | null = null

export function connectWS(onMessage: MessageHandler): WebSocket {
  socket = new WebSocket('ws://localhost:8000/ws')

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.agent && data.message) {
        onMessage(data)
      }
    } catch {}
  }

  socket.onerror = (e) => console.error('WS error', e)

  return socket
}

export function disconnectWS() {
  socket?.close()
  socket = null
}
