(function(){
  const WS = {};
  WS.ws = null;
  WS.subs = { invoice:null, logs:false, dashboard:false, wa:false };
  WS.handlers = [];

  function wsUrl(){
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}`;
  }

  function connect(){
    WS.ws = new WebSocket(wsUrl());

    WS.ws.onopen = () => {
      window.APP_WS_ONLINE = true;
      trySetBadges(true);

      // subscribe by current mode
      if (WS.subs.invoice) WS.ws.send(JSON.stringify({ type:'sub_invoice', token: WS.subs.invoice }));
      if (WS.subs.logs) WS.ws.send(JSON.stringify({ type:'sub_logs', on:true }));
      if (WS.subs.dashboard) WS.ws.send(JSON.stringify({ type:'sub_dashboard', on:true }));
      if (WS.subs.wa) WS.ws.send(JSON.stringify({ type:'sub_wa', on:true }));
    };

    WS.ws.onclose = () => {
      window.APP_WS_ONLINE = false;
      trySetBadges(false);
      setTimeout(connect, 1200);
    };

    WS.ws.onerror = () => {};

    WS.ws.onmessage = (ev) => {
      let msg=null;
      try{ msg = JSON.parse(ev.data); }catch{}
      if(!msg) return;
      WS.handlers.forEach(fn => { try{ fn(msg); }catch{} });
    };
  }

  function trySetBadges(on){
    const wsBadge = document.getElementById('wsBadge');
    if(wsBadge){
      wsBadge.innerHTML = `<i class="ri-wifi-line"></i> WS: <b>${on?'ON':'OFF'}</b>`;
    }
  }

  WS.on = (fn) => WS.handlers.push(fn);

  WS.subInvoice = (token) => {
    WS.subs.invoice = token;
    if (WS.ws?.readyState === 1) WS.ws.send(JSON.stringify({ type:'sub_invoice', token }));
  };

  WS.subLogs = (on) => {
    WS.subs.logs = !!on;
    if (WS.ws?.readyState === 1) WS.ws.send(JSON.stringify({ type:'sub_logs', on: !!on }));
  };

  WS.subDashboard = (on) => {
    WS.subs.dashboard = !!on;
    if (WS.ws?.readyState === 1) WS.ws.send(JSON.stringify({ type:'sub_dashboard', on: !!on }));
  };

  WS.subWa = (on) => {
    WS.subs.wa = !!on;
    if (WS.ws?.readyState === 1) WS.ws.send(JSON.stringify({ type:'sub_wa', on: !!on }));
  };

  window.WSRT = WS;
  connect();
})();
