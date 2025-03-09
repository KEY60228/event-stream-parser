export const parse = async (
  stream: ReadableStream<Uint8Array>
): Promise<ReadableStream<MessageEvent>> => {
  const parser = new SSEParser();
  return stream.pipeThrough(
    new TransformStream({
      start(controller) {
        parser.setOnEvent((event) => controller.enqueue(event));
      },
      transform(chunk) {
        parser.appendBuffer(chunk);
        parser.processBuffer();
      },
      flush() {
        parser.processBuffer();
      },
    })
  );
};

class SSEParser {
  // Data Buffer, must be initialized to the empty string
  private data: string = '';
  // Event Type Buffer, must be initialized to the empty string
  private eventType: string = '';
  // Last Event ID Buffer, must be initialized to the empty string
  private lastEventId: string = '';

  // Event streams in this format must always be encoded as UTF-8.
  // The UTF-8 decode algorithm strips one leading UTF-8 Byte Order Mark (BOM), if any.
  private textDecoder = new TextDecoder('utf-8', { ignoreBOM: false });
  // Since connections established to remote servers for such resources are expected to be long-lived, UAs should ensure that appropriate buffering is used.
  private buffer: string = '';

  // Event handler
  private onEvent: (event: MessageEvent) => void = () => {
    throw new Error('onEvent is not set');
  };

  public setOnEvent(onEvent: (event: MessageEvent) => void) {
    this.onEvent = onEvent;
  }

  public appendBuffer(chunk: Uint8Array) {
    this.buffer += this.textDecoder.decode(chunk, { stream: true });
  }

  public processBuffer() {
    // Lines must be separated by either a U+000D CARRIAGE RETURN U+000A LINE FEED (CRLF) character pair, a single U+000A LINE FEED (LF) character, or a single U+000D CARRIAGE RETURN (CR) character.
    const lines = this.buffer.split(/\r\n|\r|\n/);
    // Once the end of the file is reached, any pending data must be discarded. (If the file ends in the middle of an event, before the final empty line, the incomplete event is not dispatched.)
    this.buffer = lines.pop() || '';
    // The stream must then be parsed by reading everything line by line
    for (const line of lines) {
      this.parseLine(line);
    }
  }

  private parseLine(line: string) {
    // If the line is empty (a blank line), dispatch the event.
    if (line === '') {
      this.dispatchEvent();
      return;
    }

    // If the line starts with a U+003A COLON character (:), ignore the line.
    if (line.startsWith(':')) {
      return;
    }

    const { field, value } = this.parseField(line);
    switch (field) {
      case 'event': {
        // Set the event type buffer to field value.
        this.eventType = value;
        break;
      }
      case 'data': {
        // Append the field value to the data buffer, then append a single U+000A LINE FEED (LF) character to the data buffer.
        this.data += value;
        this.data += '\n';
        break;
      }
      case 'id': {
        // If the field value does not contain U+0000 NULL, then set the last event ID buffer to the field value.
        // Otherwise, ignore the field.
        if (!value.includes('\u0000')) {
          this.lastEventId = value;
        }
        break;
      }
      case 'retry': {
        // If the field value consists of only ASCII digits, then interpret the field value as an integer in base ten, and set the event stream's reconnection time to that integer.
        // Otherwise, ignore the field.
        const retry = parseInt(value, 10);
        if (!isNaN(retry)) {
          // TODO: set reconnection time
        }
        break;
      }
      default: {
        // The field is ignored.
      }
    }
  }

  private parseField(line: string): { field: string; value: string } {
    const index = line.indexOf(':');

    // If the string does not contain a U+003A COLON character (:),
    // process the field using the whole line as the field name, and the empty string as the field value.
    if (index === -1) {
      return { field: line, value: '' };
    }

    // If the line contains a U+003A COLON character (:),
    // Collect the characters on the line before the first U+003A COLON character (:), and let field be that string.
    const field = line.slice(0, index);
    // Collect the characters on the line after the first U+003A COLON character (:), and let value be that string.
    let value = line.slice(index + 1);
    // If value starts with a U+0020 SPACE character, remove it from value.
    if (value.charAt(0) === ' ') {
      value = value.slice(1);
    }

    return { field, value };
  }

  private dispatchEvent() {
    // TODO: Set the last event ID string of the event source to the value of the last event ID buffer.

    // If the data buffer is an empty string, set the data buffer and the event type buffer to the empty string and return.
    if (this.data.length === 0) {
      this.data = '';
      this.eventType = '';
      return;
    }

    // If the data buffer's last character is a U+000A LINE FEED (LF) character, then remove the last character from the data buffer.
    if (this.data.endsWith('\n')) {
      this.data = this.data.slice(0, -1);
    }

    // Initialize event's type attribute to "message", its data attribute to data,
    // its origin attribute to the serialization of the origin of the event stream's final URL (i.e., the URL after redirects),
    // and its lastEventId attribute to the last event ID string of the event source.
    // If the event type buffer has a value other than the empty string, change the type of the newly created event to equal the value of the event type buffer.
    const event = new MessageEvent(this.eventType || 'message', {
      data: this.data,
      // origin: this.origin, // TODO: set the origin
      lastEventId: this.lastEventId,
    });

    // Set the data buffer and the event type buffer to the empty string.
    this.data = '';
    this.eventType = '';

    // Queue a task
    this.onEvent(event);
  }
}
