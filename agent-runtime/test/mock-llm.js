// A stubbed model with the same contract as the real Anthropic call, so the full
// driver + orchestrator + real browser can be proven without an API key. It
// returns a scripted sequence that exercises every path: a login checkpoint, a
// few browser actions, an approval checkpoint before submit, then completion.

let n = 0;
function id() { return `tu_${++n}`; }

function block(name, input, text) {
  const content = [];
  if (text) content.push({ type: 'text', text });
  content.push({ type: 'tool_use', id: id(), name, input });
  return { content };
}

function makeMock() {
  let call = 0;
  // Each entry is what the model "decides" on that turn.
  const script = [
    () => block('request_human_login', { reason: 'A sign-in screen is shown', url: 'file://page' }, 'This needs a login first.'),
    () => block('computer', { action: 'left_click', coordinate: [120, 140] }, 'Filling in the name field.'),
    () => block('computer', { action: 'type', text: 'Krishan' }),
    () => block('request_approval', { summary: 'Send the supplier enquiry', details: 'Submits the contact form on the page.' }, 'Ready to submit, checking with you first.'),
    () => block('computer', { action: 'left_click', coordinate: [200, 320] }, 'Approved, submitting now.'),
    () => block('task_complete', { summary: 'Supplier enquiry sent', result: 'Reference AIV-123' }),
  ];
  return async function llm(/* messages, tools, system */) {
    const step = script[Math.min(call, script.length - 1)];
    call++;
    return step();
  };
}

module.exports = { makeMock };
