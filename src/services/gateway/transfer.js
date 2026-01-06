import { postGateway } from './http.js';

export async function bankList() {
  return postGateway('/transfer/bank_list', {});
}
export async function cekRekening({ bank_code, account_number }) {
  return postGateway('/transfer/cek_rekening', { bank_code, account_number });
}
export async function createTransfer(payload) {
  return postGateway('/transfer/create', payload);
}
export async function transferStatus({ id }) {
  return postGateway('/transfer/status', { id });
}
