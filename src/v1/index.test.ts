import { describe, expect, it } from 'vitest';
import { parse } from './index';

const defaultType = 'message';

const createReadableStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(new TextEncoder().encode(chunk));
      });
      controller.close();
    },
  });
};

const collectMessages = async (stream: ReadableStream<MessageEvent>): Promise<MessageEvent[]> => {
  const messages: MessageEvent[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    messages.push(value);
  }

  return messages;
};

describe('SSE Parser', () => {
  it('Normal - should parse a basic message', async () => {
    const type1 = 'message';
    const data1 = 'message1';
    const type2 = 'custom';
    const data2 = 'message2';

    const input = createReadableStream([`event: ${type1}\ndata: ${data1}\n\n`, `event: ${type2}\ndata: ${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(type1);
    expect(messages[0].data).toBe(data1);
    expect(messages[1].type).toBe(type2);
    expect(messages[1].data).toBe(data2);
  })

  it('Normal - should parse a message without type', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = createReadableStream([`data: ${data1}\n\n`, `data: ${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data1);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(data2);
  })

  it('Normal - should parse a message with multiple event types in a single event', async () => {
    const type1 = 'notification';
    const data1 = 'notification message';
    const type2 = 'alert';

    const input = createReadableStream([
      `event: ${type1}\ndata: ${data1}\nevent: ${type2}\n\n`,
    ]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(type2);
    expect(messages[0].data).toBe(data1);
  });

  it('Normal - should parse a message with valid event ID', async () => {
    const id = '123456';
    const data = 'message with valid ID';

    const input = createReadableStream([
      `id: ${id}\ndata: ${data}\n\n`
    ]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].lastEventId).toBe(id);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data);
  })

  it('Normal - should parse a message with invalid event IDs', async () => {
    const id = '123\u0000456';
    const data = 'message with invalid ID';

    const input = createReadableStream([
      `id: ${id}\ndata: ${data}\n\n`
    ]);

    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].lastEventId).toBe('');
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data);
  });

  it('Normal - should parse a message with valid retry field', async () => {
    const retry = 1000;
    const data = 'message with valid retry';

    const input = createReadableStream([
      `retry: ${retry}\ndata: ${data}\n\n`,
    ]);

    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data);
  });

  it('Normal - should parse a message with invalid retry field', async () => {
    const retry = '10min';
    const data = 'message with invalid retry';

    const input = createReadableStream([
      `retry: ${retry}\ndata: ${data}\n\n`,
    ]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data);
  });

  it('Normal - should parse a message with multiple data fields', async () => {
    const data1 = 'message1';
    const data2 = 'message2';
    const data3 = 'message3';

    const input = createReadableStream([`data: ${data1}\n`, `data: ${data2}\n`, `data: ${data3}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}\n${data2}\n${data3}`);
  })

  it('Normal - should parse a message with comment', async () => {
    const data1 = 'message1';
    const data2 = 'message2';
    const comment = 'comment';

    const input = createReadableStream([`data: ${data1}\n`, `data: ${data2}\n`, `: ${comment}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}\n${data2}`);
  })

  it('Normal - should parse a message with commented out data', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = createReadableStream([`:data: ${data1}\n\n`, `data: ${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data2}`);
  })

  it('Normal - should parse a message without a space after the colon', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = createReadableStream([`data:${data1}\n`, `data:${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}\n${data2}`);
  })

  it('Normal - should parse a message even if the data field is empty', async () => {
    const data1 = '';
    const data2 = '';

    const input = createReadableStream([`data:${data1}\n\n`, `data:${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe('');
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe('');
  })

  it('Normal - should parse a message with multiple consecutive empty lines', async () => {
    const input = createReadableStream([
      'data: first message\n\n\n\n',
      'data: second message\n\n'
    ]);

    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe('first message');
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe('second message');
  });

  it('Normal - should parse a message with unnecessary fields', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = createReadableStream([`data: ${data1}\n\n`, `data: ${data2}\n\n`, `other: something\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}`);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(`${data2}`);
  })

  it('Normal - should parse a message even if the chunk is not terminated with a newline', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = createReadableStream(['data', `: ${data1}\n\n`, 'da', `ta: ${data2}\n\n`]);
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}`);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(`${data2}`);
  })

  it('Normal - should parse a message even if the chunk is separated in bytes', async () => {
    const data1 = 'message1';
    const data2 = 'message2';

    const input = new ReadableStream({
      start(controller) {
        const event = new TextEncoder().encode(`data:${data1}\n\ndata:${data2}\n\n`);
        for (let i = 0; i < event.length; i += 1) {
          controller.enqueue(new Uint8Array([event[i]]));
        }
        controller.close();
      }
    })
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(`${data1}`);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(`${data2}`);
  })

  it('Normal - should parse a message with UTF-8 special characters', async () => {
    const data1 = 'emoji😊and special chars✨';
    const data2 = 'multibyte string test🎉';

    const input = createReadableStream([
      `data: ${data1}\n\n`,
      `data: ${data2}\n\n`
    ]);

    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data1);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(data2);
  });

  it('Normal - should parse a message with UTF-8 special characters even if the chunk is separated in bytes', async () => {
    const data1 = 'emoji😊and special chars✨';
    const data2 = 'multibyte string test🎉';

    const input = new ReadableStream({
      start(controller) {
        const event = new TextEncoder().encode(`data:${data1}\n\ndata:${data2}\n\n`);
        for (let i = 0; i < event.length; i += 1) {
          controller.enqueue(new Uint8Array([event[i]]));
        }
        controller.close();
      }
    })
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data1);
    expect(messages[1].type).toBe(defaultType);
    expect(messages[1].data).toBe(data2);
  });

  it('Normal - should parse a message with UTF-8 BOM', async () => {
    const data = 'message with UTF-8 BOM';

    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0xEF, 0xBB, 0xBF]));
        const event = new TextEncoder().encode(`data: ${data}\n\n`);
        for (let i = 0; i < event.length; i += 1) {
          controller.enqueue(new Uint8Array([event[i]]));
        }
        controller.close();
      }
    })
    const parsedStream = await parse(input);
    const messages = await collectMessages(parsedStream);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(defaultType);
    expect(messages[0].data).toBe(data);
  })
})
