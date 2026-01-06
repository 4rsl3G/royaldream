import { AuditLog } from '../models/index.js';

export async function logAudit({ actor = 'system', actor_id = null, action, target = null, target_id = null, meta = null, req = null }) {
  try {
    await AuditLog.create({
      actor, actor_id, action, target, target_id,
      meta,
      ip: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null
    });
  } catch {}
}
