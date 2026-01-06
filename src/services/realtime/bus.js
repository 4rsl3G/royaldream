import { EventEmitter } from 'events';
export const bus = new EventEmitter();

export const EVT = {
  DASHBOARD_UPDATED: 'DASHBOARD_UPDATED',
  INVOICE_UPDATED: 'INVOICE_UPDATED',
  LOG: 'LOG',
  WA_UPDATED: 'WA_UPDATED'
};
