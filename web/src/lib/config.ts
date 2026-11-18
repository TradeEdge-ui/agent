export const siteConfig = {
  name: "ARyzz AI Solutions",
  shortName: "ARyzz",
  description:
    "Websites, AI chatbots and workflow automation for Malaysian businesses — transparent pricing, clear deliverables and secure online payments.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_MY",
  currency: "MYR",
  timezone: "Asia/Kuala_Lumpur",
  // Public contact details come from Admin > Settings (business_settings) so
  // they can be changed without a deploy. These are only used when unset.
  fallbackEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};

export const mainNav = [
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/portfolio", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];
