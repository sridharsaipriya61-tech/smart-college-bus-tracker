import { supabaseAdmin, q } from './supabaseAdmin.js';

/**
 * Keep `profiles.bus_id` and `buses.driver_id` in lockstep.
 * Without this, a driver assigned a bus by the admin would still be rejected
 * when pushing GPS, because the bus row still named a different driver.
 */
export async function assignBus(userId, busId) {
  const bus = busId
    ? await q(supabaseAdmin.from('buses').select('id').eq('id', busId).maybeSingle())
    : null;

  if (bus) {
    // Clear any previous owner of this bus's driver slot.
    await supabaseAdmin
      .from('buses')
      .update({ driver_id: userId, updated_at: new Date().toISOString() })
      .eq('id', busId);
    // And free any other driver who was pointing at this bus.
    await supabaseAdmin
      .from('profiles')
      .update({ bus_id: null, updated_at: new Date().toISOString() })
      .eq('bus_id', busId)
      .neq('id', userId);
  } else {
    // Unassign: this bus no longer has a driver.
    await supabaseAdmin
      .from('buses')
      .update({ driver_id: null, updated_at: new Date().toISOString() })
      .eq('driver_id', userId);
  }
}
