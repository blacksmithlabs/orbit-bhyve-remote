const axios = require('axios');
const WebSocket = require('ws');

const endpoint = 'https://api.orbitbhyve.com/v1';

const WS_TIMEOUT = 300000;

class WebSocketProxy {
    constructor() {
        this._ws = null;
        this._wsPing = null;
        this._wsHeartbeat = null;
    }

    _heartbeat() {
        clearTimeout(this._wsHeartbeat);

        this._wsHeartbeat = setTimeout(() => {
            console.log('Terminating WebSocket due to innactivity');
            clearInterval(this._wsPing);
            this._ws.terminate();
            this._ws = null;
        }, WS_TIMEOUT);
    }

    connect(token, deviceId) {
        if (this._ws) {
            return Promise.resolve(this._ws);
        }

        return new Promise((resolve, reject) => {
            console.log('Connecting WebSocket');
            this._ws = new WebSocket(`${endpoint}/events`);

            // Intercept send events for logging
            const origSend = this._ws.send.bind(this._ws);
            this._ws.send = (data, options, callback) => {
                if (data.event && data.event !== 'ping') {
                    this._heartbeat();
                }
                if (typeof data === 'object') {
                    data = JSON.stringify(data);
                }
                console.log('TX', data);
                origSend(data, options, callback);
            };

            this._wsPing = setInterval(() => {
                this._ws.send({event: 'ping'});
            }, 25000);

            this._ws.on('open', () => {
                console.log('WebSocket Connected');
                this._ws.send({
                    event: 'app_connection',
                    orbit_session_token: token,
                    subscribe_device_id: deviceId,
                });

                this._heartbeat();
                resolve(this._ws);
            });
            this._ws.on('close', () => {
                console.log('WebSocket Closed');
                clearInterval(this._wsPing);
            });
            this._ws.on('error', msg => {
                console.error('WebSocket Error', msg);
                this._ws.close();

                reject(msg);
            });

            this._ws.on('message', msg => {
                console.log('RX', msg);
            });
        });
    }
}

class API {
    constructor(config) {
        this._token = null;
        this._userId = null;
        this._config = config;

        this._ws = new WebSocketProxy();

        this._messageHandlers = [];

        axios.interceptors.request.use(config => {
            config.headers['orbit-api-key'] = this._token;
            config.headers['orbit-app-id'] = 'Orbit Support Dashboard';
            return config;
        });
    }

    init() {
        console.log('Initializing API');
        return axios.post(`${endpoint}/session`, {
            session: {
                email: this._config.email,
                password: this._config.password,
            }
        }).then(rsp => {
            this._token = rsp.data.orbit_api_key;
            this._userId = rsp.data.user_id;
            console.log('API Token', this._token);
            console.log('User ID', this._userId);
        });
    }

    sync() {
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send(JSON.stringify({
            event: "sync",
            device_id: this._config.deviceId,
        })));
    }

    setRainDelay(delay = 24) {
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send(JSON.stringify({
            event: "rain_delay",
            device_id: this._config.deviceId,
            delay,
        })));
    }

    clearRainDelay() {
        this.setRainDelay(0);
    }

    startZone(zoneId, minutes) {
        // Replies:
        // change_mode (same payload)
        // watering_in_progress
        // {
        //     event: 'watering_in_progress_notification',
        //     device_id: 'string',
        //     program: 'manual',
        //     current_station: Number,
        //     rain_sensor_hold: Boolean,
        //     run_time: minutes,
        //     started_watering_station_at: timestamp,
        //     timestamp: timestamp,
        // }
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send({
            event: "change_mode",
            mode: "manual",
            device_id: this._config.deviceId,
            timestamp: new Date().toISOString(),
            stations: [
                { station: zoneId, run_time: minutes }
            ],
        }));
    }

    stopZone() {
        // Replies
        // change_mode (same payload)
        // watering_complete
        // {
        //     event: 'watering_complete',
        //     device_id: 'string',
        //     timestamp: timestamp,
        // }
        // change_mode
        // {
        //     event: "change_mode",
        //     mode: "off",
        // }
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send({
            event: "change_mode",
            mode: "manual",
            device_id: this._config.deviceId,
            timestamp: new Date().toISOString(),
            stations: [],
        }));
    }

    modeAuto() {
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send({
            event: "change_mode",
            mode: "auto",
            device_id: this._config.deviceId,
            timestamp: new Date().toISOString(),
        }))
    }

    modeOff() {
        this._ws.connect(this._token, this._config.deviceId)
        .then(ws => ws.send({
            event: "change_mode",
            mode: "off",
            device_id: this._config.deviceId,
            timestamp: new Date().toISOString(),
        }));
    }
}

module.exports = API;
