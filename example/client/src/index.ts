import { parse } from 'event-stream-parser'

const main = async () => {
  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      name: 'John Doe',
    }),
  })

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const eventStream = await parse(response.body);
  const reader = eventStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(value.data);
  }
}

main()
