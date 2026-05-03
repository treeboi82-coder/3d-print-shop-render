import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const computeStripeSignature = async (payload: string, secret: string) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  return toHex(new Uint8Array(sig));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server is not configured for webhook verification." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSignature = req.headers.get("stripe-signature");
    if (!stripeSignature) {
      return new Response(JSON.stringify({ error: "Missing Stripe signature header." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.text();
    const signatureMap = Object.fromEntries(
      stripeSignature.split(",").map((entry) => {
        const [key, value] = entry.split("=");
        return [key, value];
      }),
    );

    const timestamp = signatureMap.t;
    const stripeV1 = signatureMap.v1;
    if (!timestamp || !stripeV1) {
      return new Response(JSON.stringify({ error: "Invalid Stripe signature format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = await computeStripeSignature(signedPayload, webhookSecret);
    if (expectedSignature !== stripeV1) {
      return new Response(JSON.stringify({ error: "Stripe signature verification failed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(payload) as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          payment_intent?: string;
          payment_status?: string;
          metadata?: Record<string, string>;
        };
      };
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const orderId = session?.metadata?.order_id;
      if (orderId) {
        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              payment_status: session.payment_status === "paid" ? "Paid" : "Pending",
              stripe_checkout_session_id: session.id ?? null,
              stripe_payment_intent_id: session.payment_intent ?? null,
            }),
          },
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          return new Response(JSON.stringify({ error: errorText }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
