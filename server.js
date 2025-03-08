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
let deviceState = null;
let autoOffTimer = null;
const AUTO_OFF_DELAY = 30 * 60 * 1000; // 30 minutes in milliseconds

// Add device event listeners
device.on('connected', () => {
  console.log('Connected to device via event!');
  isConnected = true;
});

device.on('disconnected', () => {
  console.log('Disconnected from device via event!');
  isConnected = false;
  
  // Try to reconnect after a short delay
  setTimeout(async () => {
    try {
      await connectDevice();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  }, 5000);
});

device.on('error', error => {
  console.error('Device error via event:', error);
});

// Function to handle auto-off timer
function handleAutoOffTimer() {
  // Clear existing timer if any
  if (deviceState === false && autoOffTimer) {
    clearTimeout(autoOffTimer);
    autoOffTimer = null;
  }
  
  // Only set new timer if device is on
  if (!autoOffTimer && deviceState === true) {
    autoOffTimer = setTimeout(async () => {
      try {
        console.log('Auto-off timer expired. Turning device off...');
        await device.set({ dps: 1, set: false });
        deviceState = false;
      } catch (error) {
        console.error('Error in auto-off timer:', error);
      }
    }, AUTO_OFF_DELAY);
  }
}

// Listen for data updates
device.on('data', data => {
  console.log('Received data update:', data);
  if (data && data.dps && data.dps['1'] !== undefined) {
    deviceState = data.dps['1'];
    console.log('Device state updated to:', deviceState);
    handleAutoOffTimer(); // Handle timer when state changes
  }
});

// Simplify connectDevice function
async function connectDevice() {
  if (!isConnected) {
    try {
      await Promise.race([
        device.find(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Find device timeout')), 5000)
        )
      ]);
      
      await Promise.race([
        device.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connect timeout')), 5000)
        )
      ]);
      
      // Get initial state
      const status = await Promise.race([
        device.get({ dps: 1 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initial status check timeout')), 5000)
        )
      ]);
      
      if (status === undefined || status === null) {
        throw new Error('Invalid initial device status');
      }
      
      deviceState = status;
    } catch (error) {
      console.error('Error connecting to device:', error);
      isConnected = false;
      throw error;
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
    handleAutoOffTimer(); // Handle timer when state changes
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

// Simplify shutdown handler
process.on('SIGINT', () => {
  if (autoOffTimer) {
    clearTimeout(autoOffTimer);
  }
  device.disconnect();
  console.log('Disconnected from device');
  process.exit();
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
  connectDevice(); // Initial connection and start status checks
});
