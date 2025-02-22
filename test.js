const TuyAPI = require('tuyapi');

const device = new TuyAPI({
  key: 'Q~]w6H7u=H=aVXQV',
  ip: '192.168.31.33',
  version: '3.3'
});

async function main() {
  try {
    await device.find();
    await device.connect();
    console.log('Connected to device!');
    
    const status = await device.get({dps: 1});
    console.log('Current status:', status);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 