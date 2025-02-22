
require('dotenv').config();
const TuyAPI = require('tuyapi');

const device = new TuyAPI({
  key: process.env.LOCALKEY,  // Load the localkey from .env
  id: process.env.DEVICEID
});

async function main() {
  try {
    await device.find();
    await device.connect();
    console.log('Connected to device!');

    const status = await device.get({ dps: 1 });
    console.log('Current status:', status);

    await device.set({ dps: 1, set: true });
    console.log('Switch turned ON');

    await new Promise(r => setTimeout(r, 5000));

    await device.set({ dps: 1, set: false });
    console.log('Switch turned OFF');

    await device.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
