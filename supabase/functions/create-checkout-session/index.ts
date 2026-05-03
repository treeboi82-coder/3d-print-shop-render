import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type CheckoutPayload = {
  amount?: number;
  currency?: string;
  productName?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe is not configured on server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CheckoutPayload;
    const {
      amount,
      currency = "jod",
      productName = "3D Print Order",
      successUrl,
      cancelUrl,
      metadata = {},
    } = body;

    if (!amount || amount <= 0 || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: "Missing or invalid checkout fields." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount)));
    params.set("line_items[0][price_data][product_data][name]", productName);
    if (metadata.order_id) {
      params.set("client_reference_id", metadata.order_id);
    }

    Object.entries(metadata).forEach(([key, value]) => {
      params.set(`metadata[${key}]`, value);
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeData = await stripeResponse.json();
    return new Response(
      JSON.stringify({
        id: stripeData.id,
        url: stripeData.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
