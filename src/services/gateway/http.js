import axios from 'axios';
import qs from 'qs';
import { getGatewayConfig } from '../settingsService.js';

function form(data) {
  return qs.stringify(data, { encodeValuesOnly: true });
}

export async function postGateway(path, body) {
  const cfg = await getGatewayConfig();
  if (!cfg.api_key) throw new Error('API Key belum diset di Settings');

  const base = cfg.api_url.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : '/' + path}`;

  const { data } = await axios.post(url, form({ api_key: cfg.api_key, ...body }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 25000
  });
  return data;
}
