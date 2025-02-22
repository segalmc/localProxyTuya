const TuyAPI = require('tuyapi');

const device = new TuyAPI({
  key: 'Q~]w6H7u=H=aVXQV',
  ip: '192.168.31.33',
  version: '3.3'
});

// Get command line arguments
const command = process.argv[2];

async function main() {
  try {
    switch(command) {
      case 'connect':
        await device.find();
        await device.connect();
        console.log('Connected to device!');
        break;

      case 'on':
        await device.find();
        await device.connect();
        await device.set({dps: 1, set: true});
        console.log('Turned ON');
        break;

      case 'off':
        await device.find();
        await device.connect();
        await device.set({dps: 1, set: false});
        console.log('Turned OFF');
        break;

      case 'status':
        await device.find();
        await device.connect();
        const status = await device.get({dps: 1});
        console.log(JSON.stringify({status}));
        break;

      default:
        console.error('Unknown command:', command);
        process.exit(1);
    }
    
    await device.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main(); 