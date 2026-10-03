import { Flash } from "@/components/admin/Flash";
import { requireOwner } from "@/lib/auth";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireOwner();
  const { error } = await searchParams;
  return (
    <>
      <div className="admin-head">
        <h1>Add a product</h1>
      </div>
      <Flash error={error} />
      <ProductForm />
    </>
  );
}
