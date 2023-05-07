require('dotenv').config();

const Max = require('max-api');
const WebSocket = require('websocket').client;

const hyperateApiKey = process.env.HYPERATE_API_KEY;
const hyperateChannel = process.env.HYPERATE_CHANNEL;


// Start up message
Max.post(`The current filename is ${__filename}`);


const heartRate = {
  lastHR: null,
  currentHR: null,
  lastHRTime: null,
  currentHRTime: null,

  setHR: function(hr) {
    this.lastHR = this.currentHR;
    this.currentHR = hr;
    this.lastHRTime = this.currentHRTime;
    this.currentHRTime = (new Date()).getTime();
  },

  getHeartRate: function() {
    return this.currentHR;
  },

  // this calculation is probably wrong, consider it a placeholder
  //
  getHeartRateVariability: function() {
    if (this.lastHRTime) {
      const rrInterval = this.currentHRTime - this.lastHRTime;
      const averageHR = (this.lastHR + this.currentHR) / 2;
      return rrInterval / averageHR;
    } else {
      return null;
    }
  }

};



const ws = new WebSocket();
ws.connect(`wss://app.hyperate.io/socket/websocket?token=${hyperateApiKey}`);

// Handle WebSocket connection events
ws.on('connect', (connection) => {
  console.log('WebSocket connected!');

  // Join channel
  const message = {"topic": `hr:${hyperateChannel}`, "event": "phx_join", "payload": {}, "ref": 0};
  connection.send(JSON.stringify(message));

  // Send a heart beat every 10 seconds to keep connection
  setInterval(() => {
    const message = {"topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": 0};
    connection.send(JSON.stringify(message));
  }, 10000);

  connection.on('message', (message) => {
    data = JSON.parse(message.utf8Data);

    switch(data.event) {
      case 'hr_update':
        const hr = data.payload.hr;
        heartRate.setHR(hr);
        const hrv = heartRate.getHeartRateVariability();
        Max.outlet('hr', hr, 'hrv', hrv);
        break;
      case 'phx_reply':
        if(Object.keys(data.payload.response).length === 0 && data.payload.status === 'ok') {
          break;
        } else {
          // log via default
        }
      default:
        console.log('unknown data', data);
    }
  });
});

// Handle WebSocket error events
ws.on('connectFailed', (error) => {
  console.error('WebSocket connection error:', error.toString());
});
