# Server-Sent Events (SSE) Parser / Event Stream Parser

A lightweight Server-Sent Events (SSE) parser implementation following the HTML Living Standard specification. This package is designed to work with the Web Streams API and is fully compatible with modern browsers and Node.js.

## Installation

```bash
npm install event-stream-parser
# or
yarn add event-stream-parser
# or
pnpm add event-stream-parser
```

## Usage

You can import the package in two ways:

```typescript
// Using v1 explicitly
import { parse } from 'event-stream-parser/v1';
// Using default import (same as v1)
import { parse } from 'event-stream-parser';

// Example with fetch
const response = await fetch('https://api.example.com/events', {
  headers: {
    Accept: 'text/event-stream',
  },
});

if (!response.body) {
  throw new Error('Response body is null');
}

const eventStream = await parse(response.body);

eventStream.pipeTo(
  new WritableStream({
    write(event) {
      console.log('Event type:', event.type);
      console.log('Event data:', event.data);
      console.log('Last event ID:', event.lastEventId);
    },
  })
);
```

## Features

- 🚀 Lightweight and zero dependencies
- 🌊 Works with Web Streams API
- 📦 Full TypeScript support
- ✨ Follows SSE specification
- 🔍 Handles all SSE fields (event, data, id, retry)

## API

### parse(stream: ReadableStream<Uint8Array>): Promise<ReadableStream<MessageEvent>>

Parses a readable stream of SSE data and returns a readable stream of `MessageEvent` objects.

#### Parameters

- `stream`: A `ReadableStream<Uint8Array>` containing the SSE data

#### Returns

- A `Promise<ReadableStream<MessageEvent>>` that yields parsed SSE events

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
