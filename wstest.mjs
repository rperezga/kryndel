const ws = new WebSocket('wss://alphanet.nerdnest.xyz');
ws.onopen = () => { console.log('OPEN ok'); ws.close(); };
ws.onerror = e => { console.log('ERR:', e.error?.message || e.message || e); process.exit(); };
ws.onclose = e => { console.log('CLOSE', e.code, String(e.reason||'')); };
setTimeout(() => process.exit(), 10000);
