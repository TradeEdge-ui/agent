import type { ReactNode } from "react";
import { Container } from "@/components/marketing/sections";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-3xl">
        <article className="prose-dark">{children}</article>
      </Container>
    </section>
  );
}
