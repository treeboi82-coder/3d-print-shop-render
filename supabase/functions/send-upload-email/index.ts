import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type UploadPayload = {
  clientName?: string;
  clientPhone?: string;
  printMaterial?: string;
  paymentMethod?: string;
  quantity?: string;
  color?: string;
  country?: string;
  governorate?: string;
  deliveryAddress?: string;
  unitPrice?: string;
  weightGrams?: string;
  calculatedPrice?: string;
  paymentStatus?: string;
  checkoutUrl?: string | null;
  orderId?: string;
  fileName?: string;
  mimeType?: string;
  fileBase64?: string;
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const toEmail = Deno.env.get("UPLOAD_RECEIVER_EMAIL");
    const fromEmail = Deno.env.get("UPLOAD_FROM_EMAIL") ?? "Print Shop <onboarding@resend.dev>";

    if (!resendApiKey || !toEmail) {
      return new Response(
        JSON.stringify({ error: "Email service not configured on server." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as UploadPayload;
    const {
      clientName,
      clientPhone,
      printMaterial,
      paymentMethod,
      quantity,
      color,
      country,
      governorate,
      deliveryAddress,
      unitPrice,
      weightGrams,
      calculatedPrice,
      paymentStatus,
      checkoutUrl,
      orderId,
      fileName,
      mimeType,
      fileBase64,
    } = body;

    if (!clientName || !clientPhone || !printMaterial || !paymentMethod || !quantity || !governorate || !deliveryAddress || !fileName || !fileBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `New 3D file upload from ${clientName}`,
        html: `
          <h2>New 3D Upload Request</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Order ID:</strong> ${orderId || "N/A"}</p>
          <p><strong>Phone:</strong> ${clientPhone}</p>
          <p><strong>File:</strong> ${fileName}</p>
          <p><strong>Print Material:</strong> ${printMaterial}</p>
          <p><strong>Color:</strong> ${color || "Not specified"}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Country:</strong> ${country || "Jordan"}</p>
          <p><strong>Governorate:</strong> ${governorate}</p>
          <p><strong>Delivery Address:</strong> ${deliveryAddress}</p>
          <p><strong>Estimated Weight:</strong> ${weightGrams || "N/A"} g</p>
          <p><strong>Unit Price:</strong> ${unitPrice || "N/A"} JOD</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Calculated Price:</strong> ${calculatedPrice || "N/A"} JOD</p>
          <p><strong>Payment Status:</strong> ${paymentStatus || "Unpaid"}</p>
          <p><strong>Checkout Link:</strong> ${checkoutUrl || "N/A"}</p>
        `,
        attachments: [
          {
            filename: fileName,
            content: fileBase64,
            type: mimeType || "application/octet-stream",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
