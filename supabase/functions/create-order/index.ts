import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type CreateOrderPayload = {
  clientName?: string;
  clientPhone?: string;
  printMaterial?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  quantity?: string;
  color?: string;
  country?: string;
  governorate?: string;
  deliveryAddress?: string;
  weightGrams?: string;
  unitPrice?: string;
  totalPrice?: string;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service role is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CreateOrderPayload;
    const {
      clientName,
      clientPhone,
      printMaterial,
      paymentMethod,
      paymentStatus,
      quantity,
      color,
      country,
      governorate,
      deliveryAddress,
      weightGrams,
      unitPrice,
      totalPrice,
    } = body;

    if (!clientName || !clientPhone || !printMaterial || !paymentMethod || !quantity || !governorate || !deliveryAddress) {
      return new Response(JSON.stringify({ error: "Missing required order fields." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_name: clientName,
        client_phone: clientPhone,
        print_material: printMaterial,
        payment_method: paymentMethod,
        payment_status: paymentStatus || "Unpaid",
        quantity: Number(quantity),
        color: color || null,
        country: country || "Jordan",
        governorate,
        delivery_address: deliveryAddress,
        weight_grams: weightGrams ? Number(weightGrams) : null,
        unit_price: unitPrice ? Number(unitPrice) : null,
        total_price: totalPrice ? Number(totalPrice) : null,
      }),
    });

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inserted = (await insertResponse.json()) as Array<{ id: string }>;
    return new Response(
      JSON.stringify({
        id: inserted[0]?.id,
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
