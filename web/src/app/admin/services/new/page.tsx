import { EMPTY_SERVICE, ServiceEditor } from "@/components/admin/service-editor";
import { PageHeader } from "@/components/ui/primitives";

export default function NewServicePage() {
  return (
    <>
      <PageHeader title="New service" />
      <ServiceEditor service={EMPTY_SERVICE} />
    </>
  );
}
