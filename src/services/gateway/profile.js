import { postGateway } from './http.js';
export async function getProfile() {
  return postGateway('/get_profile', {});
}
