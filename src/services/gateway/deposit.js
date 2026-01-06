import { postGateway } from './http.js';

export async function createDeposit({ reff_id, nominal, type = 'ewallet', metode = 'qris' }) {
  return postGateway('/deposit/create', { reff_id, nominal, type, metode });
}
export async function cancelDeposit({ id }) {
  return postGateway('/deposit/cancel', { id });
}
export async function depositStatus({ id }) {
  return postGateway('/deposit/status', { id });
}
export async function depositMetode({ type = 'ewallet', metode = 'qris' }) {
  return postGateway('/deposit/metode', { type, metode });
}
