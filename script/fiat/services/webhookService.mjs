const normalizePaymentStatus = (value) => {
  switch (String(value || "").toLowerCase()) {
    case "successful":
    case "completed":
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "processing":
    case "pending":
      return "processing";
    default:
      return "pending";
  }
};

const getHeaderValue = (value) =>
  Array.isArray(value) ? value[0] || null : value || null;

const normalizeWithdrawalStatus = (value) => {
  switch (String(value || "").toLowerCase()) {
    case "successful":
    case "completed":
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "processing":
    case "pending":
      return "processing";
    default:
      return "pending";
  }
};

const insertLedgerIfMissing = async ({ entry, supabase }) => {
  const { data: existing, error: existingError } = await supabase
    .from("fiat_wallet_ledger_entries")
    .select("id")
    .eq("reference_kind", entry.reference_kind)
    .eq("reference_id", entry.reference_id)
    .eq("entry_kind", entry.entry_kind)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return;
  }

  const { error } = await supabase
    .from("fiat_wallet_ledger_entries")
    .insert(entry);

  if (error) {
    throw error;
  }
};

export const createWebhookService = ({ flutterwave, supabase }) => {
  const handlePaymentWebhook = async ({ body, request }) => {
    flutterwave.verifyWebhookSignature(request);

    const eventType = body.event || body.type || "payment.webhook";
    const providerEventId =
      body?.data?.id?.toString() ||
      body?.data?.tx_ref ||
      body?.data?.txRef ||
      null;

    const { error: eventError } = await supabase
      .from("payment_webhook_events")
      .upsert(
        {
          event_type: eventType,
          payload: body,
          processed_at: new Date().toISOString(),
          provider: "flutterwave",
          provider_event_id: providerEventId
        },
        {
          onConflict: "provider,provider_event_id"
        }
      );

    if (eventError) {
      throw eventError;
    }

    const checkoutReference = body?.data?.tx_ref || body?.data?.txRef || null;

    if (checkoutReference) {
      const paymentStatus = normalizePaymentStatus(
        body?.data?.status || eventType
      );
      const updatePayload = {
        metadata: {
          webhook: body
        },
        paid_at:
          paymentStatus === "succeeded" ? new Date().toISOString() : null,
        provider_transaction_id: body?.data?.id?.toString() || null,
        status: paymentStatus
      };

      const { error } = await supabase
        .from("payment_transactions")
        .update(updatePayload)
        .eq("checkout_reference", checkoutReference)
        .eq("purpose", "fiat_wallet_deposit");

      if (error) {
        throw error;
      }
    }

    return {
      message: "Payment webhook processed.",
      success: true
    };
  };

  const handlePayoutWebhook = async ({ body, request }) => {
    flutterwave.verifyWebhookSignature(request);

    const eventType = body.event || body.type || "payout.webhook";
    const providerEventId =
      body?.data?.id?.toString() || body?.data?.reference || null;

    const { error: eventError } = await supabase
      .from("payout_webhook_events")
      .upsert(
        {
          event_type: eventType,
          payload: body,
          processed_at: new Date().toISOString(),
          provider: "flutterwave",
          provider_event_id: providerEventId,
          signature:
            getHeaderValue(request.headers["verif-hash"]) ||
            getHeaderValue(request.headers["x-flutterwave-signature"])
        },
        {
          onConflict: "provider,provider_event_id"
        }
      );

    if (eventError) {
      throw eventError;
    }

    const payoutId =
      body?.data?.id?.toString() || body?.data?.reference || body?.data?.tx_ref;

    if (!payoutId) {
      return {
        message: "Payout webhook logged without a payout reference.",
        success: true
      };
    }

    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("fiat_withdrawals")
      .select("*")
      .or(`provider_payout_id.eq.${payoutId},reference.eq.${payoutId}`)
      .limit(1)
      .maybeSingle();

    if (withdrawalError) {
      throw withdrawalError;
    }

    if (!withdrawal) {
      return {
        message: "Payout webhook logged, no matching withdrawal found.",
        success: true
      };
    }

    const nextStatus = normalizeWithdrawalStatus(
      body?.data?.status || eventType
    );

    if (nextStatus === "completed") {
      const { error } = await supabase
        .from("fiat_withdrawals")
        .update({
          completed_at: new Date().toISOString(),
          metadata: {
            webhook: body
          },
          status: "completed"
        })
        .eq("id", withdrawal.id);

      if (error) {
        throw error;
      }

      await insertLedgerIfMissing({
        entry: {
          description: "Withdrawal completed",
          entry_kind: "withdrawal_commit",
          locked_delta_kobo: -withdrawal.amount_kobo,
          metadata: {},
          profile_id: withdrawal.profile_id,
          reference_id: withdrawal.id,
          reference_kind: "fiat_withdrawal",
          wallet_id: withdrawal.wallet_id
        },
        supabase
      });
    }

    if (nextStatus === "failed") {
      const { error } = await supabase
        .from("fiat_withdrawals")
        .update({
          failed_at: new Date().toISOString(),
          failure_reason: body?.data?.complete_message || "Withdrawal failed.",
          metadata: {
            webhook: body
          },
          status: "failed"
        })
        .eq("id", withdrawal.id);

      if (error) {
        throw error;
      }

      await insertLedgerIfMissing({
        entry: {
          available_delta_kobo: withdrawal.amount_kobo,
          description: "Withdrawal funds returned",
          entry_kind: "withdrawal_release",
          locked_delta_kobo: -withdrawal.amount_kobo,
          metadata: {},
          profile_id: withdrawal.profile_id,
          reference_id: withdrawal.id,
          reference_kind: "fiat_withdrawal",
          wallet_id: withdrawal.wallet_id
        },
        supabase
      });
    }

    return {
      message: "Payout webhook processed.",
      success: true
    };
  };

  return {
    handlePaymentWebhook,
    handlePayoutWebhook
  };
};
