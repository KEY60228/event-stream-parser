import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { SSEStreamingApi, streamSSE } from 'hono/streaming'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.json()
  const message = `Hello, ${body.name}!`

  const handleStream = async (stream: SSEStreamingApi) => {
    let joinedMessage = ''
    for (const char of message) {
      joinedMessage += char
      await stream.writeSSE({
        data: JSON.stringify({
          message: char,
          joinedMessage,
        }),
      })
    }
  }

  return streamSSE(c, handleStream)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
