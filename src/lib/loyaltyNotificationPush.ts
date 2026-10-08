import { supabase } from '@/lib/supabase';

export async function sendLoyaltyNotificationPush(campaignId: string) {
  const { data, error } = await supabase.functions.invoke('send-loyalty-notification-push', {
    body: { campaign_id: campaignId },
  });

  if (error) {
    console.error('Failed to send loyalty notification push:', error);
    return { success: false, sent: 0, error: error.message };
  }

  return {
    success: Boolean(data?.success),
    sent: Number(data?.sent ?? 0),
    failed: Number(data?.failed ?? 0),
    skipped: Number(data?.skipped ?? 0),
    removed: Number(data?.removed ?? 0),
    error: data?.error ? String(data.error) : null,
  };
}
