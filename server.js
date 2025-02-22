require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });; // Add this line at the top

const express = require('express');
const TuyAPI = require('tuyapi');
const app = express();
const dgram = require('dgram');
const os = require('os');
app.use(express.json());

const device = new TuyAPI({
  key: process.env.LOCALKEY,  // Load the localkey from .env
  id: process.env.DEVICEID,
  version: '3.4'
});

let isConnected = false;
let deviceState = null; // This will store the current state of the device (true for on, false for off)

async function connectDevice() {
  if (!isConnected) {
    try {
      await device.find();
      await device.connect();
      isConnected = true;
      console.log('Connected to device!');
      // Get the initial state of the device when connected
      deviceState = await device.get({ dps: 1 });
    } catch (error) {
      console.error('Error connecting to device:', error);
    }
  }
}

// Get the device status from the stored state
app.get('/status', async (req, res) => {
  try {
    await connectDevice();
    // If the deviceState is null, fetch the current status
    if (deviceState === null) {
      deviceState = await device.get({ dps: 1 });
    }
    res.json({ status: deviceState });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change the device state (on/off)
app.post('/switch', async (req, res) => {
  try {
    const { state } = req.body; // state: true for on, false for off
    await connectDevice();
    await device.set({ dps: 1, set: state });
    deviceState = state; // Update the local state variable
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Function to get the server's local IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return '127.0.0.1';
}

// Create and configure the UDP server
const udpServer = dgram.createSocket('udp4');
const UDP_PORT = 6000;
const BROADCAST_ADDR = '255.255.255.255';

// Enable broadcasting
udpServer.bind(UDP_PORT, () => {
  udpServer.setBroadcast(true);
  console.log(`UDP server listening on ${BROADCAST_ADDR}:${UDP_PORT}`);
});

// Handle incoming UDP messages
udpServer.on('message', (msg, rinfo) => {
  if(msg.indexOf("proxyTuya") === -1) return;
  console.log(`Received UDP message from ${rinfo.address}:${rinfo.port}`);
  const localIP = getLocalIPAddress();
  const response = Buffer.from(localIP);
  udpServer.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error('Error sending UDP response:', err);
    } else {
      console.log(`Sent IP address ${localIP} to ${rinfo.address}:${rinfo.port}`);
    }
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  device.disconnect();
  console.log('Disconnected from device');
  process.exit();
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
