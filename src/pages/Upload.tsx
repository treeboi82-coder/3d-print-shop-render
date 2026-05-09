import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileUp, UploadCloud, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

const allowedExtensions = [".stl", ".obj", ".3mf", ".step", ".stp"];
const pricePerGram = 0.15;
const plaDensityGramsPerCm3 = 1.24;
const jordanGovernorates = [
  "Amman",
  "Irbid",
  "Zarqa",
  "Balqa",
  "Madaba",
  "Jerash",
  "Ajloun",
  "Mafraq",
  "Karak",
  "Tafilah",
  "Ma'an",
  "Aqaba",
];
const printMaterials = ["PLA", "PETG", "ABS", "TPU"];
const jordanPhoneRegex = /^(?:\+962|0)7[789]\d{7}$/;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? "http://localhost:4242" : window.location.origin);

type DashboardPaymentMethod = {
  id: string;
  label: string;
  type: "stripe" | "manual";
  enabled: boolean;
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

// Chunked upload function for large files
const uploadFileInChunks = async (file: File, orderId: string, onProgress?: (progress: number) => void) => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks to stay under 10MB limit
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const fileId = crypto.randomUUID();
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const base64Chunk = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(chunk);
    });
    
    const chunkData = {
      orderId,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      chunkIndex,
      totalChunks,
      chunkData: base64Chunk.split(',')[1], // Remove data URL prefix
      isLastChunk: chunkIndex === totalChunks - 1
    };
    
    const response = await fetch(`${apiBaseUrl}/upload-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunkData)
    });
    
    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`);
    }
    
    if (onProgress) {
      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      onProgress(progress);
    }
  }
  
  return fileId;
};

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const base64Chunk = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(chunk);
    });
    
    const chunkData = {
      orderId,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      chunkIndex,
      totalChunks,
      chunkData: base64Chunk.split(',')[1], // Remove data URL prefix
      isLastChunk: chunkIndex === totalChunks - 1
    };
    
    const response = await fetch(`${apiBaseUrl}/upload-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunkData)
    });
    
    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`);
    }
    
    if (onProgress) {
      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      onProgress(progress);
    }
  }
  
  return fileId;
};

const parseAsciiStlVolumeMm3 = (text: string) => {
  const vertexRegex = /vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const vertices: [number, number, number][] = [];
  let match = vertexRegex.exec(text);
  while (match) {
    vertices.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    match = vertexRegex.exec(text);
  }

  if (vertices.length < 3 || vertices.length % 3 !== 0) {
    throw new Error("Invalid ASCII STL geometry.");
  }

  let volume = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const [ax, ay, az] = vertices[i];
    const [bx, by, bz] = vertices[i + 1];
    const [cx, cy, cz] = vertices[i + 2];

    volume +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6;
  }

  return Math.abs(volume);
};

const parseBinaryStlVolumeMm3 = (buffer: ArrayBuffer) => {
  const data = new DataView(buffer);
  const triangles = data.getUint32(80, true);
  const expectedLength = 84 + triangles * 50;
  if (buffer.byteLength < expectedLength) {
    throw new Error("Invalid binary STL file.");
  }

  let offset = 84;
  let volume = 0;
  for (let i = 0; i < triangles; i += 1) {
    offset += 12; // skip normal

    const ax = data.getFloat32(offset, true);
    const ay = data.getFloat32(offset + 4, true);
    const az = data.getFloat32(offset + 8, true);
    offset += 12;

    const bx = data.getFloat32(offset, true);
    const by = data.getFloat32(offset + 4, true);
    const bz = data.getFloat32(offset + 8, true);
    offset += 12;

    const cx = data.getFloat32(offset, true);
    const cy = data.getFloat32(offset + 4, true);
    const cz = data.getFloat32(offset + 8, true);
    offset += 12;

    volume +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6;

    offset += 2; // attribute byte count
  }

  return Math.abs(volume);
};

const parseObjVolumeMm3 = (text: string) => {
  const vertices: [number, number, number][] = [];
  const faces: number[][] = [];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        vertices.push([x, y, z]);
      }
      continue;
    }

    if (line.startsWith("f ")) {
      const parts = line.split(/\s+/).slice(1);
      if (parts.length < 3) continue;

      const faceIndices: number[] = [];
      for (const part of parts) {
        const idxToken = part.split("/")[0];
        const idx = Number(idxToken);
        if (!Number.isFinite(idx) || idx === 0) continue;

        // OBJ indices are 1-based and can be negative (relative indexing).
        const zeroBased = idx > 0 ? idx - 1 : vertices.length + idx;
        if (zeroBased >= 0 && zeroBased < vertices.length) {
          faceIndices.push(zeroBased);
        }
      }

      if (faceIndices.length >= 3) {
        faces.push(faceIndices);
      }
    }
  }

  if (vertices.length < 3 || faces.length === 0) {
    throw new Error("Invalid OBJ geometry.");
  }

  let volume = 0;
  for (const face of faces) {
    const [baseX, baseY, baseZ] = vertices[face[0]];

    // Triangulate n-gons with fan triangulation.
    for (let i = 1; i < face.length - 1; i += 1) {
      const [bx, by, bz] = vertices[face[i]];
      const [cx, cy, cz] = vertices[face[i + 1]];

      volume +=
        (baseX * (by * cz - bz * cy) +
          baseY * (bz * cx - bx * cz) +
          baseZ * (bx * cy - by * cx)) /
        6;
    }
  }

  return Math.abs(volume);
};

const estimateWeightGramsFromStl = async (file: File) => {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";

  const buffer = await file.arrayBuffer();
  let volumeMm3 = 0;

  if (extension === ".stl") {
    try {
      volumeMm3 = parseBinaryStlVolumeMm3(buffer);
    } catch {
      const text = new TextDecoder().decode(buffer);
      volumeMm3 = parseAsciiStlVolumeMm3(text);
    }
  } else if (extension === ".obj") {
    const text = new TextDecoder().decode(buffer);
    volumeMm3 = parseObjVolumeMm3(text);
  } else {
    throw new Error("Automatic weight currently supports STL and OBJ files only.");
  }

  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) {
    throw new Error("Could not estimate model weight from this file.");
  }

  const volumeCm3 = volumeMm3 / 1000;
  return volumeCm3 * plaDensityGramsPerCm3;
};

const Upload = () => {
  const { toast } = useToast();
  const { language, setLanguage } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [printMaterial, setPrintMaterial] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentOptions, setPaymentOptions] = useState<DashboardPaymentMethod[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [color, setColor] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [estimatedWeightGrams, setEstimatedWeightGrams] = useState<number | null>(null);
  const [isEstimatingWeight, setIsEstimatingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/payment-config`)
      .then((res) => res.json())
      .then((data: { methods?: DashboardPaymentMethod[] }) => {
        const methods = (data.methods || []).filter((method) => method.enabled);
        setPaymentOptions(methods);
        if (methods.length > 0 && !paymentMethod) {
          setPaymentMethod(methods[0].label);
        }
      })
      .catch(() => {
        const fallback: DashboardPaymentMethod[] = [
          { id: "cash-on-delivery", label: "Cash on Delivery", type: "manual", enabled: true },
          { id: "card-online", label: "Card (Online)", type: "stripe", enabled: true },
        ];
        setPaymentOptions(fallback);
        if (!paymentMethod) {
          setPaymentMethod(fallback[0].label);
        }
      });
  }, []);

  const fileDetails = useMemo(() => {
    if (!selectedFile) return null;
    const extension = selectedFile.name.includes(".")
      ? `.${selectedFile.name.split(".").pop()?.toLowerCase()}`
      : "unknown";

    return {
      name: selectedFile.name,
      extension,
      size: formatSize(selectedFile.size),
    };
  }, [selectedFile]);

  const hasValidWeight = estimatedWeightGrams !== null && estimatedWeightGrams > 0;
  const parsedQuantity = Number(quantity);
  const hasValidQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const unitPrice = hasValidWeight ? estimatedWeightGrams * pricePerGram : 0;
  const subtotal = hasValidWeight && hasValidQuantity ? unitPrice * parsedQuantity : 0;
  
  // Calculate shipping cost based on governorate
  const shippingCosts: Record<string, number> = {
    'Amman': 2.0,
    'Irbid': 3.0,
    'Zarqa': 2.5,
    'Balqa': 3.0,
    'Ajloun': 4.0,
    'Jerash': 4.0,
    'Mafraq': 5.0,
    'Karak': 5.0,
    'Tafilah': 6.0,
    'Ma\'an': 6.0,
    'Aqaba': 7.0,
    'Madaba': 3.0
  };
  const shippingCost = governorate ? (shippingCosts[governorate] || 3.0) : 0;
  const totalPrice = subtotal + shippingCost;

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Could not read file."));
          return;
        }

        const base64 = result.split(",")[1];
        if (!base64) {
          reject(new Error("Invalid file encoding."));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Choose a 3D file before sending.",
      });
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      toast({
        title: "Missing info",
        description: "Please add your name and phone number.",
      });
      return;
    }

    const normalizedPhone = clientPhone.replace(/\s+/g, "");
    const normalizedQuantity = String(parsedQuantity);
    const normalizedColor = color.trim();
    const selectedPaymentOption = paymentOptions.find((method) => method.label === paymentMethod);
    const isStripePayment = selectedPaymentOption?.type === "stripe";
    const initialPaymentStatus = isStripePayment ? "Pending" : "Unpaid";

    if (!jordanPhoneRegex.test(normalizedPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Jordan phone number (e.g. 079xxxxxxx or +96279xxxxxxx).",
      });
      return;
    }

    if (!printMaterial || !paymentMethod || !governorate || !deliveryAddress.trim()) {
      toast({
        title: "Missing checkout details",
        description: "Print material, payment method, and Jordan delivery location are required.",
      });
      return;
    }

    if (!hasValidQuantity) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a quantity of at least 1.",
      });
      return;
    }

    if (!hasValidWeight) {
      toast({
        title: "Weight not available",
        description: "Please upload a valid STL or OBJ file so we can estimate weight automatically.",
      });
      return;
    }

    setIsSending(true);
    try {
      // Create order first
      const orderResponse = await fetch(`${apiBaseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: normalizedPhone,
          printMaterial,
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          quantity: Number(normalizedQuantity),
          color: normalizedColor,
          country: "Jordan",
          governorate,
          deliveryAddress: deliveryAddress.trim(),
          weightGrams: Number(estimatedWeightGrams.toFixed(2)),
          unitPrice: Number(unitPrice.toFixed(2)),
          shippingCost: Number(shippingCost.toFixed(2)),
          totalPrice: Number(totalPrice.toFixed(2)),
          fileName: selectedFile ? selectedFile.name : "",
          fileSize: selectedFile ? selectedFile.size : 0,
          fileType: selectedFile ? selectedFile.type : "",
          fileBase64: selectedFile && selectedFile.size <= 10 * 1024 * 1024 ? await readFileAsBase64(selectedFile) : "", // Only include base64 for small files
        }),
      });

      const orderData = (await orderResponse.json()) as { id?: string; error?: string };
      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Order creation failed.");
      }

      const orderId = orderData.id ? String(orderData.id) : "";

      if (!orderId) {
        throw new Error("Order could not be created.");
      }

      // Handle large file upload with chunked upload
      if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Uploading large file",
          description: "Your file is being uploaded in chunks. This may take a moment...",
        });
        
        await uploadFileInChunks(selectedFile, orderId, (progress) => {
          // You could update a progress indicator here if needed
          console.log(`Upload progress: ${progress.toFixed(1)}%`);
        });
        
        toast({
          title: "File uploaded successfully",
          description: "Your large file has been uploaded successfully.",
        });
      }

      let paymentProcessed = false;

      // Process online payments (Cliq, Zain Cash, Orange Money)
      if (paymentMethod === 'Cliq' || paymentMethod === 'Zain Cash' || paymentMethod === 'Orange Money') {
        try {
          const paymentEndpoint = paymentMethod === 'Cliq' ? '/payment/cliq' :
                                  paymentMethod === 'Zain Cash' ? '/payment/zain-cash' :
                                  '/payment/orange-money';
          
          const paymentResponse = await fetch(`${apiBaseUrl}${paymentEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              amount: totalPrice,
              phoneNumber: normalizedPhone
            })
          });

          const paymentData = (await paymentResponse.json()) as { success?: boolean; paymentId?: string; message?: string; error?: string };
          
          if (paymentResponse.ok && paymentData.success) {
            paymentProcessed = true;
            toast({
              title: "Payment initiated",
              description: paymentData.message || "Please complete payment on your phone.",
            });
          }
        } catch (paymentError) {
          console.warn("Payment processing failed:", paymentError);
          toast({
            title: "Payment processing failed",
            description: "Order created, but please contact support to complete payment.",
          });
        }
      }

      // Try to send email notification (optional)
      try {
        const fileBase64 = await readFileAsBase64(selectedFile);
        const { error } = await supabase.functions.invoke("send-upload-email", {
          body: {
            clientName: clientName.trim(),
            clientPhone: normalizedPhone,
            printMaterial,
            paymentMethod,
            quantity: normalizedQuantity,
            color: normalizedColor,
            country: "Jordan",
            governorate,
            deliveryAddress: deliveryAddress.trim(),
            unitPrice: unitPrice.toFixed(2),
            weightGrams: estimatedWeightGrams.toFixed(2),
            calculatedPrice: totalPrice.toFixed(2),
            paymentStatus: initialPaymentStatus,
            orderId,
            fileName: selectedFile.name,
            mimeType: selectedFile.type || "application/octet-stream",
            fileBase64,
          },
        });

        if (error) {
          console.warn("Email notification failed:", error.message);
        }
      } catch (emailError) {
        console.warn("Email function unavailable:", emailError);
      }

      toast({
        title: "Order submitted",
        description: paymentMethod === 'Cash on Delivery' 
          ? "Your order has been submitted. You will pay on delivery."
          : "Your order has been submitted. Please complete payment on your phone.",
      });

      setSelectedFile(null);
      setClientName("");
      setClientPhone("");
      setPrintMaterial("");
      setPaymentMethod("");
      setQuantity("1");
      setColor("");
      setGovernorate("");
      setDeliveryAddress("");
      setEstimatedWeightGrams(null);
      setWeightError(null);
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Could not send your file.",
      });
    } finally {
      setIsRedirectingToPayment(false);
      setIsSending(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setEstimatedWeightGrams(null);
    setWeightError(null);

    if (!file) return;

    setIsEstimatingWeight(true);
    try {
      const estimatedWeight = await estimateWeightGramsFromStl(file);
      setEstimatedWeightGrams(estimatedWeight);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Automatic weight estimation failed.";
      setWeightError(message);
      toast({
        title: "Weight estimation failed",
        description: message,
      });
    } finally {
      setIsEstimatingWeight(false);
    }
  };

  return (
    <div className="min-h-dvh bg-secondary p-2 md:p-6 text-ink">
      <div className="bg-panel border border-line shadow-panel min-h-[calc(100dvh-1rem)] md:min-h-[calc(100dvh-3rem)]">
        <header className="flex items-center justify-between border-b border-line px-4 md:px-6 py-4 text-xs font-mono uppercase tracking-wider">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-2 px-2 py-1 border border-line-soft hover:bg-panel-muted transition-colors"
              title="Change language"
            >
              <Globe className="size-3.5" />
              <span className="hidden sm:inline">{language === 'en' ? 'العربية' : 'English'}</span>
              <span className="sm:hidden">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
            <span className="font-bold text-sm tracking-widest">3D PRINT SHOP</span>
            <span className="hidden sm:inline px-2 py-0.5 bg-panel-muted border border-line-soft">
              {language === 'en' ? 'Checkout Center' : 'مركز الدفع'}
            </span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-4" />
            {language === 'en' ? 'Back to Home' : 'العودة للرئيسية'}
          </Link>
        </header>

        <main className="px-6 lg:px-16 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-3">
              {language === 'en' ? 'Upload + Payment' : 'رفع ودفع'}
            </p>
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight mb-4">
              {language === 'en' ? 'Checkout and Upload' : 'الدفع والرفع'}
            </h1>
            <p className="text-ink-muted font-mono max-w-[60ch] mb-8">
              {language === 'en' ? 'Upload your model file to calculate weight automatically, then complete required material and Jordan delivery details for checkout.' : 'قم برفع ملف النموذج لحساب الوزن تلقائياً، ثم أكمل تفاصيل المادة والتوصيل في الأردن للدفع.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <label
                htmlFor="model-upload"
                className="group block border border-dashed border-line bg-panel-muted hover:bg-panel transition-colors p-8 md:p-10 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center">
                  <UploadCloud className="size-10 text-accent mb-4" />
                  <span className="font-mono text-sm uppercase tracking-widest text-ink">
                    {language === 'en' ? 'Drag and drop your file' : 'اسحب وأفلت ملفك'}
                  </span>
                  <span className="font-mono text-xs text-ink-muted mt-2">
                    {language === 'en' ? 'or click to browse from your device' : 'أو انقر لتصفح من جهازك'}
                  </span>
                </div>
                <input
                  id="model-upload"
                  type="file"
                  className="sr-only"
                  accept={allowedExtensions.join(",")}
                  onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {language === 'en' ? 'Name' : 'الاسم'}
                  <input
                    type="text"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                    placeholder={language === 'en' ? 'Your name' : 'اسمك'}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {language === 'en' ? 'Phone (Jordan)' : 'الهاتف (الأردن)'}
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                    placeholder="079xxxxxxx or +96279xxxxxxx"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {language === 'en' ? 'Print Material' : 'مادة الطباعة'}
                  <select
                    value={printMaterial}
                    onChange={(event) => setPrintMaterial(event.target.value)}
                    className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                    required
                  >
                    <option value="">{language === 'en' ? 'Select material' : 'اختر المادة'}</option>
                    {printMaterials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {language === 'en' ? 'Payment Method' : 'طريقة الدفع'}
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                    required
                  >
                    <option value="">{language === 'en' ? 'Select payment method' : 'اختر طريقة الدفع'}</option>
                    {paymentOptions
                      .filter(method => {
                        // Disable Cash on Delivery for orders over 20 JOD
                        if (totalPrice > 20 && method.label === 'Cash on Delivery') {
                          return false;
                        }
                        return true;
                      })
                      .map((method) => (
                        <option key={method.id} value={method.label}>
                          {method.label}
                        </option>
                      ))}
                  </select>
                  {totalPrice > 20 && (
                    <p className="text-xs text-orange-600 font-mono mt-1">
                      ⚠ {language === 'en' ? 'Orders over 20 JOD require prepayment (Cash on Delivery not available)' : 'الطلبات التي تزيد عن 20 دينار تتطلب الدفع المسبق (الدفع عند الاستلام غير متاح)'}
                    </p>
                  )}
                </label>
              </div>

              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                {language === 'en' ? 'Quantity' : 'الكمية'}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {language === 'en' ? 'Governorate (Jordan)' : 'المحافظة (الأردن)'}
                  <select
                    value={governorate}
                    onChange={(event) => setGovernorate(event.target.value)}
                    className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                    required
                  >
                    <option value="">{language === 'en' ? 'Select governorate' : 'اختر المحافظة'}</option>
                    {jordanGovernorates.map((gov) => (
                      <option key={gov} value={gov}>
                        {gov}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                {language === 'en' ? 'Delivery Address (Jordan)' : 'عنوان التوصيل (الأردن)'}
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                  placeholder={language === 'en' ? 'Street, building, area...' : 'الشارع، المبنى، المنطقة...'}
                  required
                />
              </label>

              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                {language === 'en' ? 'Country' : 'البلد'}
                <input
                  type="text"
                  value="Jordan"
                  readOnly
                  className="px-4 py-3 border border-line bg-panel-muted text-ink normal-case tracking-normal text-sm cursor-not-allowed"
                />
              </label>

              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                {language === 'en' ? 'Color' : 'اللون'}
                <input
                  type="text"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                  placeholder={language === 'en' ? 'e.g. matte black' : 'مثال: أسود مطفي'}
                />
              </label>

              <div className="mt-2 font-mono text-xs text-ink-muted">
                {language === 'en' ? 'Supported formats' : 'الصيغ المدعومة'}: {allowedExtensions.join(", ")} (max 100 MB)
              </div>

              <button
                type="submit"
                disabled={isSending || isEstimatingWeight || isRedirectingToPayment}
                className="w-full md:w-auto bg-ink text-panel px-6 py-3 font-mono text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRedirectingToPayment
                  ? (language === 'en' ? 'Redirecting to Payment...' : 'جاري التحويل للدفع...')
                  : isSending
                  ? (language === 'en' ? 'Processing...' : 'جاري المعالجة...')
                  : isEstimatingWeight
                    ? (language === 'en' ? 'Calculating Weight...' : 'جاري حساب الوزن...')
                    : (language === 'en' ? 'Place Order' : 'تقديم الطلب')}
              </button>
            </form>
          </section>

          <aside className="lg:col-span-5 border border-line bg-panel-muted p-6 md:p-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink-muted mb-3">
              {language === 'en' ? 'Checkout Summary' : 'ملخص الطلب'}
            </h2>
            {!fileDetails ? (
              <div className="border border-line-soft p-6 bg-panel text-ink-muted font-mono text-sm">
                {language === 'en' ? 'No file selected yet.' : 'لم يتم اختيار ملف بعد.'}
              </div>
            ) : (
              <div className="border border-line-soft p-6 bg-panel">
                <div className="flex items-center gap-3 mb-4">
                  <FileUp className="size-5 text-accent" />
                  <p className="font-semibold tracking-tight text-lg">{fileDetails.name}</p>
                </div>
                <dl className="font-mono text-sm space-y-3">
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Type' : 'النوع'}</dt>
                    <dd>{fileDetails.extension}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Size' : 'الحجم'}</dt>
                    <dd>{fileDetails.size}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Weight' : 'الوزن'}</dt>
                    <dd>
                      {isEstimatingWeight
                        ? (language === 'en' ? 'Estimating...' : 'جاري التقدير...')
                        : hasValidWeight
                          ? `${estimatedWeightGrams.toFixed(2)} g`
                          : "--"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Rate' : 'السعر'}</dt>
                    <dd>{pricePerGram.toFixed(2)} JOD / g</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Unit Price' : 'سعر الوحدة'}</dt>
                    <dd>{hasValidWeight ? `${unitPrice.toFixed(2)} JOD` : "--"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Quantity' : 'الكمية'}</dt>
                    <dd>{hasValidQuantity ? parsedQuantity : "--"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Material' : 'المادة'}</dt>
                    <dd>{printMaterial || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Color' : 'اللون'}</dt>
                    <dd>{color.trim() || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Location' : 'الموقع'}</dt>
                    <dd>{governorate ? `${governorate}, Jordan` : "--"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line-soft pt-3">
                    <dt className="text-ink-muted uppercase">{language === 'en' ? 'Payment' : 'الدفع'}</dt>
                    <dd>{paymentMethod || "--"}</dd>
                  </div>
                  {hasValidWeight && governorate && (
                    <>
                      <div className="flex justify-between border-t border-line-soft pt-3">
                        <dt className="text-ink-muted uppercase">{language === 'en' ? 'Subtotal' : 'المجموع الفرعي'}</dt>
                        <dd>{subtotal.toFixed(2)} JOD</dd>
                      </div>
                      <div className="flex justify-between border-t border-line-soft pt-3">
                        <dt className="text-ink-muted uppercase">{language === 'en' ? 'Shipping' : 'الشحن'}</dt>
                        <dd>{shippingCost.toFixed(2)} JOD ({governorate})</dd>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-line-soft pt-3 font-semibold text-base">
                    <dt className="uppercase">{language === 'en' ? 'Total' : 'المجموع الكلي'}</dt>
                    <dd>{hasValidWeight ? `${totalPrice.toFixed(2)} JOD` : "--"}</dd>
                  </div>
                </dl>
                {hasValidWeight && totalPrice > 20 && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
                    <p className="font-mono text-xs text-orange-800">
                      ⚠ {language === 'en' ? 'Orders over 20 JOD require prepayment. This is a preorder - please complete payment using one of the available online payment methods.' : 'الطلبات التي تزيد عن 20 دينار تتطلب الدفع المسبق. هذا طلب مسبق - يرجى إكمال الدفع باستخدام إحدى طرق الدفع الإلكترونية المتاحة.'}
                    </p>
                  </div>
                )}
                <p className="font-mono text-xs text-ink-muted mt-5">
                  {language === 'en' ? 'Weight is estimated automatically from uploaded STL or OBJ geometry.' : 'يتم حساب الوزن تلقائياً من ملفات STL أو OBJ المرفوعة.'}
                </p>
                {weightError ? (
                  <p className="font-mono text-xs text-red-600 mt-2">{weightError}</p>
                ) : null}
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
};

export default Upload;
