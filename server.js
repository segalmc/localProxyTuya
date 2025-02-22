require('dotenv').config(); // Add this line at the top

const express = require('express');
const TuyAPI = require('tuyapi');
const app = express();
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
