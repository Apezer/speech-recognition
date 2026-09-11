const readline = require('node:readline');
readline.createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  const send = data => process.stdout.write(JSON.stringify({ id: request.id, ...data }) + '\n');
  if (request.command === 'hang') return;
  if (request.command === 'crash') return process.exit(2);
  if (request.command === 'fail') return send({ error: '模型加载失败' });
  send({ event: 'segment', segment: { start: 0, end: 1, text: '你好，Vico' } });
  send({ result: { text: '你好，Vico', command: request.command } });
});
