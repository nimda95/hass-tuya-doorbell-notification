const WebSocket = require('ws');
const { MD5, AES, enc, mode, pad } = require('crypto-js');
const https = require('https');

let ws;
let pingInterval;

const SERVERS = {
    CN: 'wss://mqe.tuyacn.com:8285/',
    US: 'wss://mqe.tuyaus.com:8285/',
    EU: 'wss://mqe.tuyaeu.com:8285/',
    IN: 'wss://mqe.tuyain.com:8285/',
};

const config = {
    accessId: process.env.TUYA_CLIENT_ID,
    accessKey: process.env.TUYA_CLIENT_SECRET,
    url: SERVERS[process.env.TUYA_REGION?.toUpperCase()],
    devId: process.env.DOORBELL_DEVICE_ID,
    hassUrl: process.env.HASS_WEBHOOK_URL,
    subscriptionType: 'Failover',
    ackTimeoutMillis: 1000,
    isStartUp: true
};

const buildTopicUrl = (websocketUrl, accessId, query) => {
    return `${websocketUrl}ws/v2/consumer/persistent/${accessId}/out/event/${accessId}-sub${query}`;
}

const buildQuery = (query) => {
    return Object.keys(query).map((key) => `${key}=${encodeURIComponent(query[key])}`).join('&');
}

const buildPassword = (accessId, accessKey) => {
    const key = MD5(accessKey).toString();
    return MD5(`${accessId}${key}`).toString().substr(8, 16);
}

const decryptData = (data, accessKey) => {
    try {
        const realKey = enc.Utf8.parse(accessKey.substring(8, 24));
        const json = AES.decrypt(data, realKey, {
            mode: mode.ECB,
            padding: pad.Pkcs7,
        });
        const dataStr = enc.Utf8.stringify(json).toString();
        return JSON.parse(dataStr);
    } catch (e) {
        return '';
    }
}

const decodeMessage = (data) => {
    const { payload, ...others } = JSON.parse(data);
    const pStr = Buffer.from(payload, 'base64').toString('utf-8');
    const pJson = JSON.parse(pStr);
    pJson.data = decryptData(pJson.data, config.accessKey);
    return { payload: pJson, ...others };
}

const notifyHass = (payload) => {
    const endpointParts = config.hassUrl.split('/');
    const options = {
        protocol: endpointParts[0],
        method: 'POST',
        hostname: endpointParts[2].split(':')[0],
        port: endpointParts[2].split(':').length == 2 ? endpointParts[2].split(':')[1] : (endpointParts[0] == 'https:' ? 443 : 80),
        path: `/${endpointParts.slice(3, endpointParts.length).join('/')}`,
    };
    const request = https.request(options);
    request.write(JSON.stringify(payload));
    request.end();
}

const handleMessage = (decodedMessage) => {
    if (decodedMessage?.payload?.data?.devId == config.devId && decodedMessage?.payload?.data?.bizCode === 'event_notify') {
        if (process.env.DEBUG) {
            console.log(decodedMessage?.payload?.data, { messageId: decodedMessage.messageId });
        }
        notifyHass(decodedMessage?.payload?.data);
    }
}

const ackMessage = (ws, messageId) => {
    ws.send(JSON.stringify({ messageId }));
}

const connect = () => {

    const topicUrl = buildTopicUrl(config.url, config.accessId, `?${buildQuery({ subscriptionType: config.subscriptionType, ackTimeoutMillis: config.ackTimeoutMillis })}`)

    const password = buildPassword(config.accessId, config.accessKey);
    const username = config.accessId;

    const ws = new WebSocket(topicUrl, {
        rejectUnauthorized: false,
        headers: { username, password },
    });

    ws.on('error', () => {
        clearInterval(pingInterval);
        if(config.isStartUp) {
            connect()
        }
    });
    ws.on('open', () => {
        pingInterval = setInterval(() => ws.ping() );
    });
    ws.on('close', () => {
        clearInterval(pingInterval);
        if(config.isStartUp) {
            connect()
        }
    });

    ws.on('message', (data) => {
        const decodedMessage = decodeMessage(data);
        handleMessage(decodedMessage);
        ackMessage(ws, decodedMessage.messageId);
    });
    
    return ws;
}

const main = () => {

    const requiredEnvVariables = [ "TUYA_CLIENT_ID", "TUYA_CLIENT_SECRET", "TUYA_REGION", "DOORBELL_DEVICE_ID", "HASS_WEBHOOK_URL" ]
    const invalidEnvVariables = [];
    requiredEnvVariables.forEach(envVariable => {
        if (!envVariable) {
            invalidEnvVariables.push(envVariable);
        }
    });
    if(invalidEnvVariables.length) {
        throw (`Found these env variables to be invalid: ${invalidEnvVariables.join(', ')}`);
    }

    console.info(`All config env variables seem to exist`)

    ws = connect();
};

main();

const handleSignals = signalName => {
    console.log(`Received code ${signalName}, closing gracefuly ...`);
    config.isStartUp = false;
    ws.close();
    process.exit(0);
}

['SIGTERM', 'SIGINT', 'SIGPWR'].map(signal => process.once(signal, handleSignals));