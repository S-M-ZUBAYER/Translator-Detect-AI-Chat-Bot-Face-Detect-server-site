const MAX_HEADER_BYTES = 2048;

function encodeBinaryFrame(header, payload) {
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
  if (headerBuffer.length > MAX_HEADER_BYTES) {
    throw new Error('Binary frame header is too large.');
  }

  const frame = Buffer.allocUnsafe(4 + headerBuffer.length + payload.length);
  frame.writeUInt32BE(headerBuffer.length, 0);
  headerBuffer.copy(frame, 4);
  payload.copy(frame, 4 + headerBuffer.length);
  return frame;
}

function decodeBinaryFrame(data) {
  const frame = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (frame.length < 5) throw new Error('Invalid binary frame.');

  const headerLength = frame.readUInt32BE(0);
  if (
    headerLength < 2
    || headerLength > MAX_HEADER_BYTES
    || frame.length < 4 + headerLength
  ) {
    throw new Error('Invalid binary frame header.');
  }

  const header = JSON.parse(frame.subarray(4, 4 + headerLength).toString('utf8'));
  return {
    header,
    payload: frame.subarray(4 + headerLength),
  };
}

module.exports = { decodeBinaryFrame, encodeBinaryFrame };
