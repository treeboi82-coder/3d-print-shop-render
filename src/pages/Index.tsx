import { Phone, Instagram, MapPin, Clock, ArrowUpRight, Star, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import heroPrint from "@/assets/hero-print.jpg";
import workMiniature from "@/assets/f1-track.png";
import workPrototype from "@/assets/work-prototype.jpg";
import workArchitecture from "@/assets/work-architecture.jpg";

const works = [
  { src: workMiniature, label: "f1 track design", spec: "SLA · 25µm" },
  { src: workPrototype, label: "Mechanical Prototype", spec: "FDM · PETG" },
  { src: workArchitecture, label: "Architectural Model", spec: "SLA · 50µm" },
];

const reviews = [
  {
    name: "Joubran Mounayer",
    text: "Amazing quality! My 3D printed model for a DnD campaign came out astonishingly well with attention to minimal details. Really amazing place!!",
    when: "5 months ago",
  },
  {
    name: "Sara Masoud",
    text: "Great service and quality, very respectful and friendly employees. Highly recommend.",
    when: "5 months ago",
  },
  {
    name: "Raed Hassan",
    text: "Best service, fast delivery, and the employees are very helpful and respectful. The products are very good.",
    when: "8 months ago",
  },
];

const Index = () => {
  const { language, setLanguage, t } = useLanguage();

  const services = [
    {
      code: "PROCESS.01",
      title: t.services.fdmTitle,
      desc: t.services.fdmDesc,
    },
    {
      code: "PROCESS.02",
      title: t.services.slicingTitle,
      desc: t.services.slicingDesc,
    },
    {
      code: "PROCESS.03",
      title: t.services.modelingTitle,
      desc: t.services.modelingDesc,
    },
    {
      code: "PROCESS.04",
      title: t.services.postProcessingTitle,
      desc: t.services.postProcessingDesc,
    },
  ];

  return (
    <div className="min-h-dvh bg-secondary p-2 md:p-6 text-ink">
      <div className="bg-panel border border-line shadow-panel">
        {/* Header */}
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
            <span className="hidden sm:inline px-2 py-0.5 bg-panel-muted border border-line-soft">AMM.JO</span>
          </div>
          <nav className="hidden md:flex gap-10 text-ink-muted">
            <a href="#services" className="hover:text-ink transition-colors">{t.common.services || 'Services'}</a>
            <a href="#work" className="hover:text-ink transition-colors">{t.common.work || 'Work'}</a>
            <a href="#reviews" className="hover:text-ink transition-colors">{t.common.reviews || 'Reviews'}</a>
            <a href="#visit" className="hover:text-ink transition-colors">{t.common.visit || 'Visit'}</a>
            <Link to="/upload" className="hover:text-ink transition-colors">{t.common.checkout || 'Checkout'}</Link>
          </nav>
          <div className="flex items-center gap-2 md:gap-3 text-accent">
            <span className="size-1.5 bg-accent rounded-full animate-pulse" aria-hidden />
            <span className="tracking-widest">{t.index.openToday}</span>
          </div>
        </header>

        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
          <div className="lg:col-span-7 flex flex-col px-6 lg:px-16 py-12 lg:py-24 justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-10 border-l-2 border-accent pl-4 py-1">
                {t.index.protocol}: Additive Manufacturing<br />
                {t.index.location}: Amman, JO · Al-Jalil St., Office 208
              </div>
              <h1 className="text-5xl lg:text-7xl font-semibold tracking-tight text-balance leading-[0.95] mb-8">
                {t.index.heroTitle}
              </h1>
              <p className="max-w-[48ch] text-base lg:text-lg text-ink-muted leading-relaxed font-mono">
                {t.index.heroSubtitle}
              </p>
            </div>

            <div className="mt-16 lg:mt-20 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 border-t border-line pt-10">
              <div className="flex flex-col justify-end">
                <div className="font-mono text-[10px] text-ink-muted mb-3 uppercase tracking-widest">
                  {t.index.clientVerification}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-mono tabular-nums tracking-tighter">4.8</span>
                  <span className="text-sm font-mono text-ink-muted uppercase tracking-widest">{t.index.outOf}</span>
                </div>
                <div className="flex items-center gap-1 mt-2" aria-label="4.8 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-3 fill-accent text-accent" />
                  ))}
                </div>
                <div className="text-xs font-mono text-ink-muted mt-2">
                  <span className="text-ink font-bold tabular-nums">49</span> {t.index.verifiedReviews}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href="tel:+962799458828"
                  className="bg-ink text-panel px-6 py-4 font-mono text-sm uppercase tracking-widest hover:bg-accent transition-colors flex justify-between items-center group"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="size-4" /> {t.index.call}: 079 945 8828
                  </span>
                  <ArrowUpRight className="size-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                </a>
                <a
                  href="#visit"
                  className="border border-line px-6 py-3 font-mono text-sm uppercase tracking-widest hover:bg-panel-muted transition-colors text-ink-muted hover:text-ink flex justify-between items-center"
                >
                  {t.index.visitShop}
                  <ArrowUpRight className="size-4" />
                </a>
                <Link
                  to="/upload"
                  className="border border-line px-6 py-3 font-mono text-sm uppercase tracking-widest hover:bg-panel-muted transition-colors text-ink-muted hover:text-ink flex justify-between items-center"
                >
                  {t.index.checkoutUpload}
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Hero viewport */}
          <div className="lg:col-span-5 bg-panel-muted relative p-6 lg:p-8 flex flex-col">
            <div className="absolute inset-0 grid-dots opacity-60 pointer-events-none" aria-hidden />
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-4 z-20 relative">
              <span>Viewport.Alpha</span>
              <span>Scale 1:1</span>
            </div>

            <div className="relative flex-1 bg-panel border border-line p-1 z-20 shadow-sm min-h-[420px]">
              <div className="w-full h-full relative overflow-hidden bg-panel-muted">
                <img
                  src={heroPrint}
                  alt="High-detail 3D printed mechanical component"
                  width={1024}
                  height={1280}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1/2 left-0 w-full h-px bg-accent/60 mix-blend-multiply" />
                <div className="absolute top-0 left-1/2 w-px h-full bg-accent/60 mix-blend-multiply" />
                <div className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 border border-accent rounded-full" />
              </div>

              <div className="absolute bottom-5 right-5 bg-panel/95 backdrop-blur-sm border border-line p-4 font-mono text-xs shadow-lg">
                <div className="flex justify-between gap-8 border-b border-line-soft pb-2 mb-2">
                  <span className="text-ink-muted uppercase">Material:</span>
                  <span className="font-medium">PLA Premium</span>
                </div>
                <div className="flex justify-between gap-8 border-b border-line-soft pb-2 mb-2">
                  <span className="text-ink-muted uppercase">Layer:</span>
                  <span className="font-medium tabular-nums">100µm</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-ink-muted uppercase">Finish:</span>
                  <span className="font-medium">Matte</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="border-t border-line">
          <div className="px-6 lg:px-16 py-10 border-b border-line flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                Section.02
              </div>
              <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">{t.index.capabilities}</h2>
            </div>
            <div className="hidden md:block font-mono text-xs text-ink-muted uppercase tracking-widest">
              4 {t.index.processes} / {t.index.endToEnd}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line">
            {services.map((s) => (
              <article
                key={s.code}
                className="p-8 lg:p-10 hover:bg-panel-muted transition-colors flex flex-col gap-3"
              >
                <span className="font-mono text-[10px] text-ink-muted uppercase tracking-widest">
                  {s.code}
                </span>
                <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed font-mono">{s.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Work */}
        <section id="work" className="border-t border-line bg-panel-muted">
          <div className="px-6 lg:px-16 py-10 border-b border-line flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                Section.03
              </div>
              <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">{t.index.selectedOutput}</h2>
            </div>
            <div className="hidden md:block font-mono text-xs text-ink-muted uppercase tracking-widest">
              {t.index.liveArchive}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
            {works.map((w) => (
              <figure key={w.label} className="bg-panel-muted p-6 lg:p-8 flex flex-col gap-4 group">
                <div className="relative aspect-square bg-panel border border-line overflow-hidden">
                  <img
                    src={w.src}
                    alt={w.label}
                    width={800}
                    height={800}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 size-3 border-t border-l border-accent" />
                  <div className="absolute top-3 right-3 size-3 border-t border-r border-accent" />
                  <div className="absolute bottom-3 left-3 size-3 border-b border-l border-accent" />
                  <div className="absolute bottom-3 right-3 size-3 border-b border-r border-accent" />
                </div>
                <figcaption className="flex items-center justify-between font-mono text-xs uppercase tracking-widest">
                  <span className="text-ink">{w.label}</span>
                  <span className="text-ink-muted">{w.spec}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section id="reviews" className="border-t border-line">
          <div className="px-6 lg:px-16 py-10 border-b border-line flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                Section.04
              </div>
              <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">{t.index.clientTelemetry}</h2>
            </div>
            <div className="hidden md:flex items-center gap-2 font-mono text-xs text-ink-muted uppercase tracking-widest">
              <span className="text-ink font-bold">4.8</span> {t.index.avg} · <span>49 {t.index.reviews}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
            {reviews.map((r) => (
              <blockquote key={r.name} className="p-8 lg:p-10 flex flex-col gap-4">
                <div className="flex items-center gap-1" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-base leading-relaxed text-ink">"{r.text}"</p>
                <footer className="font-mono text-xs uppercase tracking-widest text-ink-muted mt-auto pt-4 border-t border-line-soft flex justify-between">
                  <span className="text-ink">{r.name}</span>
                  <span>{r.when}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* Visit / Contact */}
        <section id="visit" className="border-t border-line bg-panel-muted">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
            <div className="lg:col-span-5 p-8 lg:p-16">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                Section.05
              </div>
              <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-8">
                {t.index.visitWorkshop}
              </h2>
              <p className="text-ink-muted font-mono text-sm leading-relaxed mb-10 max-w-[40ch]">
                {t.index.workshopDescription}
              </p>

              <dl className="space-y-6 font-mono text-sm">
                <div className="flex gap-4 border-t border-line-soft pt-4">
                  <MapPin className="size-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">{t.index.address}</dt>
                    <dd>Al-Jneini Bldg, Office 208<br />Al-Jalil St., Amman 11192, Jordan</dd>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-line-soft pt-4">
                  <Phone className="size-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">{t.index.phone}</dt>
                    <dd>
                      <a href="tel:+962799458828" className="hover:text-accent transition-colors">
                        +962 79 945 8828
                      </a>
                    </dd>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-line-soft pt-4">
                  <Clock className="size-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">{t.index.hours}</dt>
                    <dd>Open today · {t.index.closes} 9:00 PM</dd>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-line-soft pt-4">
                  <Instagram className="size-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">{t.index.instagram}</dt>
                    <dd>
                      <a
                        href="https://instagram.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-accent transition-colors"
                      >
                        @3dprintshop_amman
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7 relative min-h-[400px]">
              <iframe
                title="3D Print Shop location in Amman"
                src="https://www.openstreetmap.org/export/embed.html?bbox=35.870%2C31.985%2C35.890%2C32.000&layer=mapnik&marker=31.9925%2C35.8800"
                className="absolute inset-0 w-full h-full grayscale contrast-125"
                loading="lazy"
              />
              <div className="absolute top-6 left-6 bg-panel border border-line p-4 font-mono text-xs shadow-panel max-w-xs">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted mb-2">
                  {t.index.coordinates}
                </div>
                <div className="tabular-nums">31.9925° N · 35.8800° E</div>
                <div className="text-ink-muted mt-1">XW99+9C Amman</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-line grid grid-cols-2 lg:grid-cols-4 divide-x divide-line bg-panel font-mono text-[11px]">
          <div className="p-4 lg:p-6 flex flex-col gap-1.5">
            <span className="text-ink-muted uppercase tracking-widest">{t.index.studio}</span>
            <span className="font-bold text-sm tracking-tight text-ink">3D Print Shop</span>
            <span className="text-ink-muted">Amman, Jordan</span>
          </div>
          <div className="p-4 lg:p-6 flex flex-col gap-1.5">
            <span className="text-ink-muted uppercase tracking-widest">{t.index.contact}</span>
            <a href="tel:+962799458828" className="font-bold text-sm tracking-tight text-ink hover:text-accent">
              079 945 8828
            </a>
            <span className="text-ink-muted">Open · Closes 9 PM</span>
          </div>
          <div className="p-4 lg:p-6 flex flex-col gap-1.5">
            <span className="text-ink-muted uppercase tracking-widest">{t.index.follow}</span>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="font-bold text-sm tracking-tight text-ink hover:text-accent">
              Instagram
            </a>
            <span className="text-ink-muted">@3dprintshop_amman</span>
          </div>
          <div className="p-4 lg:p-6 flex flex-col justify-center items-center bg-ink text-panel">
            <div className="uppercase tracking-[0.2em] opacity-80 mb-1">{t.index.systemsNominal}</div>
            <div className="tabular-nums opacity-50">© {new Date().getFullYear()} {t.index.allRights}</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
