const twilio = require('twilio');

// Local in-memory log of all sent simulated messages
let simulatedMessages = [];

// Socket.io instance reference (will be bound in server.js)
let ioInstance = null;

function setIoInstance(io) {
  ioInstance = io;
}

/**
 * Sends a WhatsApp message (Twilio if credentials exist, otherwise logs in simulation).
 * @param {string} to - Recipient phone number
 * @param {string} body - Message text content
 * @param {string} eventType - Type of notification ('Applied', 'Confirmed', 'Rejected', 'NextUp', 'Emergency')
 * @param {object} patientInfo - Metadata about the patient
 */
async function sendWhatsApp(to, body, eventType, patientInfo = {}) {
  const messageData = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    to,
    body,
    eventType,
    patientId: patientInfo.patientId || 'N/A',
    patientName: patientInfo.name || 'N/A',
    timestamp: new Date()
  };

  // Push to local log (keep last 100 messages)
  simulatedMessages.unshift(messageData);
  if (simulatedMessages.length > 100) {
    simulatedMessages.pop();
  }

  // 1. Try sending via Twilio WhatsApp API
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  let realSent = false;
  let errorMsg = null;

  if (sid && token && fromNumber) {
    try {
      const client = twilio(sid, token);
      // Format number for WhatsApp if not already formatted
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

      await client.messages.create({
        body,
        from: formattedFrom,
        to: formattedTo
      });
      realSent = true;
      console.log(`[WhatsApp Production] Message sent to ${to} (Event: ${eventType})`);
    } catch (err) {
      console.error('[WhatsApp Production Error]:', err.message);
      errorMsg = err.message;
    }
  }

  // 2. Log in simulation console
  console.log('--------------------------------------------------');
  console.log(`[WhatsApp Simulator - ${eventType.toUpperCase()}]`);
  console.log(`To: ${to}`);
  console.log(`Message: "${body}"`);
  if (realSent) {
    console.log(`Status: Sent via Twilio`);
  } else {
    console.log(`Status: Logged in Simulation Mode (No Twilio config or error: ${errorMsg})`);
  }
  console.log('--------------------------------------------------');

  // 3. Emit real-time notification to the Admin UI
  if (ioInstance) {
    ioInstance.emit('new-simulated-whatsapp', messageData);
  }

  return messageData;
}

function getSimulatedMessages() {
  return simulatedMessages;
}

module.exports = {
  setIoInstance,
  sendWhatsApp,
  getSimulatedMessages
};
